import React, { useState } from 'react';
import { LinkPreview } from '../../api/types';
import { IconButton } from '../ui/Button';

/** Images come from other sites, so only https ones load, and only if they actually work. */
const safeImage = (url: string | null) => (url && /^https:\/\//i.test(url) ? url : null);

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

interface LinkPreviewCardProps {
  preview: LinkPreview;
  /** Only the sender can hide a preview. */
  onHide?: () => void;
  /** It arrived after the message was on screen, so it eases in rather than appearing. */
  isNew: boolean;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ preview, onHide, isNew }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const image = imageFailed ? null : safeImage(preview.imageUrl);
  const icon = iconFailed ? null : safeImage(preview.faviconUrl);
  const site = preview.siteName ?? hostOf(preview.url);

  return (
    <div className={`link-card ${isNew ? 'is-new' : ''}`}>
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="link-card-body"
        aria-label={`${preview.title ?? site}, from ${site}`}
      >
        {image && (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="link-card-image"
          />
        )}
        <span className="link-card-text">
          <span className="link-card-site">
            {icon && (
              <img
                src={icon}
                alt=""
                width={16}
                height={16}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setIconFailed(true)}
              />
            )}
            <span className="truncate">{site}</span>
          </span>
          {preview.title && <span className="link-card-title">{preview.title}</span>}
          {preview.description && <span className="link-card-description">{preview.description}</span>}
        </span>
      </a>
      {onHide && (
        <IconButton icon="close" size="sm" label={`Hide the preview of ${site}`} className="link-card-hide" onClick={onHide} />
      )}
    </div>
  );
};
