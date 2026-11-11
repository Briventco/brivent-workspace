import React, { useCallback, useEffect, useRef, useState } from 'react';
import { avatarFileProblem, AVATAR_TYPES, removeMyAvatar, uploadAvatar } from '../../api/avatars';
import { errorMessage } from '../../api/client';
import { useAuth, useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../ui/Avatar';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';

/** The crop square on screen, and the size it's saved at: the server keeps 512px. */
const VIEW = 256;
const OUTPUT = 512;
const MAX_ZOOM = 3;
const NUDGE = 10;

interface Crop {
  zoom: number;
  /** The image's top-left corner inside the square, in screen pixels. */
  x: number;
  y: number;
}

/** Keeps the square covered: the picture can't be dragged so far that an edge shows. */
function clamp(crop: Crop, width: number, height: number): Crop {
  const scale = Math.max(VIEW / width, VIEW / height) * crop.zoom;
  const shownWidth = width * scale;
  const shownHeight = height * scale;
  return {
    zoom: crop.zoom,
    x: Math.min(0, Math.max(VIEW - shownWidth, crop.x)),
    y: Math.min(0, Math.max(VIEW - shownHeight, crop.y)),
  };
}

function centred(width: number, height: number, zoom = 1): Crop {
  const scale = Math.max(VIEW / width, VIEW / height) * zoom;
  return { zoom, x: (VIEW - width * scale) / 2, y: (VIEW - height * scale) / 2 };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    // Safari can't write WebP and hands back a PNG instead, which the server also accepts.
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('crop failed'))), 'image/webp', 0.9),
  );
}

interface CropModalProps {
  file: File;
  onClose: () => void;
  onSaved: () => void;
}

const CropModal: React.FC<CropModalProps> = ({ file, onClose, onSaved }) => {
  const { replaceSession } = useAuth();
  const toast = useToast();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    // Revoking the address below makes a still-loading image fail, so an image this effect has
    // already moved on from must not report anything.
    let isCurrent = true;
    img.onload = () => {
      if (!isCurrent) return;
      setImage(img);
      setCrop(centred(img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => {
      if (isCurrent) setError("That file couldn't be opened as a picture. Try another one.");
    };
    img.src = url;
    return () => {
      isCurrent = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const update = useCallback(
    (next: Crop) => image && setCrop(clamp(next, image.naturalWidth, image.naturalHeight)),
    [image],
  );

  const setZoom = (zoom: number) => {
    if (!image) return;
    // Zoom around the centre of the square, so the face stays where it was.
    const before = Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight) * crop.zoom;
    const after = Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight) * zoom;
    const centreX = (VIEW / 2 - crop.x) / before;
    const centreY = (VIEW / 2 - crop.y) / before;
    update({ zoom, x: VIEW / 2 - centreX * after, y: VIEW / 2 - centreY * after });
  };

  const save = async () => {
    if (!image) return;
    setError(null);
    const scale = Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight) * crop.zoom;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    canvas
      .getContext('2d')!
      .drawImage(image, -crop.x / scale, -crop.y / scale, VIEW / scale, VIEW / scale, 0, 0, OUTPUT, OUTPUT);

    setProgress(0);
    try {
      replaceSession(await uploadAvatar(await toBlob(canvas), setProgress));
      toast.success('Profile picture updated.');
      onSaved();
    } catch (failure) {
      // The old picture is untouched until the server confirms the new one.
      setProgress(null);
      setError(errorMessage(failure));
    }
  };

  const isUploading = progress !== null;
  const shownScale = image
    ? Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight) * crop.zoom
    : 1;

  return (
    <Modal
      isOpen
      onClose={isUploading ? () => {} : onClose}
      title="Position your picture"
      description="Drag to move it, and zoom so your face fills the circle."
    >
      <ModalBody className="space-y-4">
        {error && <Banner>{error}</Banner>}
        <div className="flex justify-center">
          <div
            role="img"
            aria-label="Picture preview. Use the arrow keys to move it."
            tabIndex={0}
            className="crop-frame"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, crop };
            }}
            onPointerMove={(e) => {
              const start = drag.current;
              if (!start) return;
              update({ ...start.crop, x: start.crop.x + e.clientX - start.x, y: start.crop.y + e.clientY - start.y });
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onKeyDown={(e) => {
              const move = { ArrowLeft: [NUDGE, 0], ArrowRight: [-NUDGE, 0], ArrowUp: [0, NUDGE], ArrowDown: [0, -NUDGE] }[e.key];
              if (!move) return;
              e.preventDefault();
              update({ ...crop, x: crop.x + move[0], y: crop.y + move[1] });
            }}
          >
            {image && (
              <img
                src={image.src}
                alt=""
                draggable={false}
                style={{
                  width: image.naturalWidth * shownScale,
                  height: image.naturalHeight * shownScale,
                  transform: `translate(${crop.x}px, ${crop.y}px)`,
                }}
              />
            )}
          </div>
        </div>
        <label className="block">
          <span className="label">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            disabled={!image || isUploading}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </label>
        {isUploading && (
          <div role="status" aria-label={`Uploading, ${Math.round(progress * 100)}%`}>
            <p className="text-small text-text-2 mb-1">Uploading… {Math.round(progress * 100)}%</p>
            <div className="bar">
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button onClick={save} isLoading={isUploading} loadingLabel="Saving" disabled={!image}>
          Save picture
        </Button>
      </ModalFooter>
    </Modal>
  );
};

/** Settings > My profile: the picture, with upload, change and remove. */
export const ProfilePicture: React.FC = () => {
  const { user } = useSession();
  const { replaceSession } = useAuth();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const choose = (chosen: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!chosen) return;
    const issue = avatarFileProblem(chosen);
    setProblem(issue);
    if (!issue) setFile(chosen);
  };

  const remove = async () => {
    setIsRemoving(true);
    try {
      replaceSession(await removeMyAvatar());
      toast.success('Profile picture removed.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsRemoving(false);
      setIsConfirming(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={user.fullName} id={user.id} avatar={user.avatar} size="xl" />
      <div className="min-w-0 grow">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" icon="upload" onClick={() => input.current?.click()}>
            {user.avatar ? 'Change picture' : 'Upload picture'}
          </Button>
          {user.avatar && (
            <Button variant="ghost" size="sm" onClick={() => setIsConfirming(true)}>
              Remove
            </Button>
          )}
        </div>
        <p className="mt-1 text-caption text-text-2">JPEG, PNG or WebP, up to 5 MB.</p>
        {problem && (
          <p role="alert" className="mt-1 text-small text-danger">
            {problem}
          </p>
        )}
        <input
          ref={input}
          type="file"
          accept={AVATAR_TYPES.join(',')}
          className="sr-only"
          aria-label="Choose a profile picture"
          tabIndex={-1}
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </div>

      {file && <CropModal file={file} onClose={() => setFile(null)} onSaved={() => setFile(null)} />}

      <ConfirmDialog
        isOpen={isConfirming}
        title="Remove your picture?"
        description="Your initials will show instead, everywhere you appear."
        confirmLabel="Remove"
        confirmVariant="danger"
        isLoading={isRemoving}
        onConfirm={remove}
        onClose={() => setIsConfirming(false)}
      />
    </div>
  );
};
