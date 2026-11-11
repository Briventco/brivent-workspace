import React, { useState } from 'react';
import { ImageUploads, PhotoUpload } from '../../../lib/useImageUploads';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

const Thumbnail: React.FC<{ item: PhotoUpload; onRemove: () => void; onRetry: () => void }> = ({
  item,
  onRemove,
  onRetry,
}) => {
  // HEIC previews don't decode in most browsers, so those show an icon until the upload's back.
  const [canPreview, setCanPreview] = useState(true);
  const src = item.attachment?.thumbnailUrl ?? item.previewUrl;
  const percent = Math.round(item.progress * 100);

  return (
    <li className={`tray-photo ${item.status === 'failed' ? 'is-failed' : ''}`}>
      {canPreview ? (
        <img src={src} alt={item.file.name} onError={() => setCanPreview(false)} />
      ) : (
        <span className="tray-photo-icon" aria-label={item.file.name} role="img">
          <Icon name="image" />
        </span>
      )}
      {item.status === 'uploading' && (
        <span
          className="tray-progress"
          role="progressbar"
          aria-label={`Uploading ${item.file.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <i style={{ width: `${percent}%` }} />
        </span>
      )}
      {item.status === 'failed' && (
        <button
          type="button"
          className="tray-retry"
          onClick={onRetry}
          title={item.error ?? undefined}
          aria-label={`Retry ${item.file.name}. ${item.error ?? ''}`}
        >
          <Icon name="refresh" size="sm" />
          Retry
        </button>
      )}
      <IconButton
        icon="close"
        size="sm"
        label={`Remove ${item.file.name}`}
        className="tray-remove"
        onClick={onRemove}
      />
    </li>
  );
};

/** The photos going with the next message, each uploading as soon as it's picked. */
export const PhotoTray: React.FC<{ uploads: ImageUploads }> = ({ uploads }) => {
  const failed = uploads.uploads.find(({ status }) => status === 'failed');
  return (
    <div className="mx-2 mt-2">
      <ul className="tray" aria-label="Photos to send">
        {uploads.uploads.map((item) => (
          <Thumbnail
            key={item.key}
            item={item}
            onRemove={() => uploads.remove(item.key)}
            onRetry={() => uploads.retry(item.key)}
          />
        ))}
      </ul>
      {failed && (
        <p role="alert" className="mt-1 text-small text-danger">
          {failed.error ?? "A photo didn't upload."} Retry it, or remove it to send the rest.
        </p>
      )}
    </div>
  );
};
