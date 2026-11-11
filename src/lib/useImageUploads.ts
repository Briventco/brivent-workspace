import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import { uploadAttachment } from '../api/messages';
import { Attachment, MAX_PHOTOS } from '../api/types';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export interface PhotoUpload {
  key: string;
  file: File;
  /** A local preview. HEIC can't be shown by most browsers, so the tray falls back to an icon. */
  previewUrl: string;
  progress: number;
  status: 'uploading' | 'done' | 'failed';
  attachment: Attachment | null;
  error: string | null;
}

/** Checked here only to save a wasted upload: the server reads the real type from the file. */
export function photoProblem(file: File): string | null {
  if (file.type === 'image/gif') return "GIFs can't be sent yet. Use a JPEG, PNG, WebP or HEIC photo.";
  const isHeic = /\.hei[cf]$/i.test(file.name);
  if (!PHOTO_TYPES.includes(file.type) && !isHeic) return `${file.name} isn't a photo we can send.`;
  if (file.size > MAX_PHOTO_BYTES) return `${file.name} is over 15 MB. Choose a smaller photo.`;
  return null;
}

/**
 * Photos waiting in the composer. Each one uploads as soon as it's picked, so sending only has to
 * pass the ids along.
 */
export function useImageUploads(conversationId: string) {
  const [uploads, setUploads] = useState<PhotoUpload[]>([]);
  const latest = useRef(uploads);
  latest.current = uploads;

  // Previews are local object URLs, released when they leave the tray.
  useEffect(() => () => latest.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl)), []);

  const patch = (key: string, changes: Partial<PhotoUpload>) =>
    setUploads((list) => list.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  const start = useCallback(
    (item: PhotoUpload) => {
      patch(item.key, { status: 'uploading', progress: 0, error: null });
      uploadAttachment(conversationId, 'IMAGE', item.file, item.file.name, (progress) =>
        patch(item.key, { progress }),
      ).then(
        (attachment) => patch(item.key, { status: 'done', progress: 1, attachment }),
        (error: unknown) => patch(item.key, { status: 'failed', error: errorMessage(error) }),
      );
    },
    [conversationId],
  );

  /** Adds what fits, and says what didn't. */
  const add = useCallback(
    (files: File[]): string | null => {
      const room = MAX_PHOTOS - latest.current.length;
      const problems: string[] = [];
      const accepted: PhotoUpload[] = [];
      for (const file of files) {
        const problem = photoProblem(file);
        if (problem) problems.push(problem);
        else if (accepted.length < room) {
          accepted.push({
            key: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file),
            progress: 0,
            status: 'uploading',
            attachment: null,
            error: null,
          });
        }
      }
      if (files.length - problems.length > room) {
        problems.push(`You can send up to ${MAX_PHOTOS} photos at a time.`);
      }
      setUploads((list) => [...list, ...accepted]);
      accepted.forEach(start);
      return problems[0] ?? null;
    },
    [start],
  );

  const remove = useCallback((key: string) => {
    const item = latest.current.find((upload) => upload.key === key);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setUploads((list) => list.filter((upload) => upload.key !== key));
  }, []);

  const retry = useCallback(
    (key: string) => {
      const item = latest.current.find((upload) => upload.key === key);
      if (item) start(item);
    },
    [start],
  );

  /** Empties the tray once the photos are on their way in a message. */
  const clear = useCallback(() => {
    latest.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    setUploads([]);
  }, []);

  const isBusy = uploads.some(({ status }) => status !== 'done');
  const attachments = uploads.flatMap(({ attachment }) => (attachment ? [attachment] : []));

  return { uploads, add, remove, retry, clear, isBusy, attachments };
}

export type ImageUploads = ReturnType<typeof useImageUploads>;
