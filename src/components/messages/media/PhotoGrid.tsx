import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Attachment } from '../../../api/types';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

const SHOWN = 4;
const SWIPE_TO_CLOSE = 90;

interface ViewerProps {
  photos: Attachment[];
  start: number;
  author: string;
  onClose: () => void;
  onExpired: () => void;
}

/** Full screen, with next and previous, download, and Esc or a swipe down to close. */
const PhotoViewer: React.FC<ViewerProps> = ({ photos, start, author, onClose, onExpired }) => {
  const [index, setIndex] = useState(start);
  const [dragY, setDragY] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const photo = photos[index];
  const count = photos.length;
  const step = (by: number) => setIndex((current) => (current + by + count) % count);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
    // Set up once for the life of the viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${count} from ${author}`}
      className="photo-viewer"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => (touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchMove={(e) => {
        const start = touchStart.current;
        if (!start) return;
        const dy = e.touches[0].clientY - start.y;
        if (dy > 0 && Math.abs(dy) > Math.abs(e.touches[0].clientX - start.x)) setDragY(dy);
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (dragY > SWIPE_TO_CLOSE) onClose();
        else if (start && dragY < 10) {
          const dx = e.changedTouches[0].clientX - start.x;
          if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
        }
        setDragY(0);
      }}
    >
      <div className="photo-viewer-bar">
        <span className="text-small">
          {author} · {index + 1} of {count}
        </span>
        <span className="grow" />
        <a
          href={photo.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-icon btn-ghost photo-viewer-button"
          aria-label="Download photo"
          title="Download photo"
        >
          <Icon name="download" />
        </a>
        <IconButton
          ref={closeRef}
          icon="close"
          label="Close"
          className="photo-viewer-button"
          onClick={onClose}
        />
      </div>
      <img
        key={photo.id}
        src={photo.url}
        alt={`Photo ${index + 1} of ${count} from ${author}`}
        width={photo.width ?? undefined}
        height={photo.height ?? undefined}
        onError={onExpired}
        className="photo-viewer-image"
        style={dragY ? { transform: `translateY(${dragY}px)`, opacity: 1 - dragY / 400 } : undefined}
      />
      {count > 1 && (
        <>
          <IconButton
            icon="chevron_left"
            label="Previous photo"
            className="photo-viewer-button photo-viewer-prev"
            onClick={() => step(-1)}
          />
          <IconButton
            icon="chevron_right"
            label="Next photo"
            className="photo-viewer-button photo-viewer-next"
            onClick={() => step(1)}
          />
        </>
      )}
    </div>,
    document.body,
  );
};

interface PhotoGridProps {
  photos: Attachment[];
  author: string;
  /** A signed address has run out, so the message needs fetching again for fresh ones. */
  onExpired: () => void;
}

/** 1, 2, 3 or 4 photos laid out to fit, then "+N" on the fourth. Space is held before they load. */
export const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, author, onExpired }) => {
  const [open, setOpen] = useState<number | null>(null);
  const count = photos.length;
  const shown = photos.slice(0, SHOWN);
  const extra = count - SHOWN;
  const [only] = photos;

  const tile = (photo: Attachment, index: number, className = '') => (
    <button
      key={photo.id}
      type="button"
      onClick={() => setOpen(index)}
      className={`photo-tile ${className}`}
      aria-label={`Open photo ${index + 1} of ${count}`}
    >
      <img
        src={photo.thumbnailUrl ?? photo.url}
        alt=""
        loading="lazy"
        decoding="async"
        width={photo.width ?? undefined}
        height={photo.height ?? undefined}
        onError={onExpired}
      />
      {index === SHOWN - 1 && extra > 0 && (
        <span className="photo-more" aria-hidden="true">
          +{extra}
        </span>
      )}
    </button>
  );

  return (
    <>
      {count === 1 ? (
        <div
          className="photo-single"
          style={{ aspectRatio: only.width && only.height ? `${only.width} / ${only.height}` : '4 / 3' }}
        >
          {tile(only, 0, 'h-full')}
        </div>
      ) : (
        <div className={`photo-grid photo-grid-${Math.min(count, SHOWN)}`}>
          {shown.map((photo, index) => tile(photo, index))}
        </div>
      )}
      {open !== null && (
        <PhotoViewer
          photos={photos}
          start={open}
          author={author}
          onClose={() => setOpen(null)}
          onExpired={onExpired}
        />
      )}
    </>
  );
};
