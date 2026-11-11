import React, { useState } from 'react';
import { AvatarUrls } from '../../api/types';

const SIZE_CLASS = { xs: 'av-xs', sm: 'av-sm', md: '', lg: 'av-lg', xl: 'av-xl' };
const USES_LARGE = new Set(['lg', 'xl']);
const TINTS = 7;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part.charAt(0).toUpperCase()).join('');
}

/** The same person always gets the same tint. */
export function tintFor(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % TINTS) + 1;
}

interface AvatarProps {
  name: string;
  /** Picks the colour. Pass the user id wherever there is one. */
  id?: string;
  size?: keyof typeof SIZE_CLASS;
  /** Their picture, if they have one. Initials show otherwise, and while it loads. */
  avatar?: AvatarUrls | null;
}

/**
 * One avatar for everyone, everywhere. The initials are always there underneath, so the circle
 * holds its size while a picture loads, and a picture that fails simply leaves the initials.
 */
export const Avatar: React.FC<AvatarProps> = ({ name, id, size = 'md', avatar }) => {
  const [failed, setFailed] = useState<string | null>(null);
  const src = avatar ? (USES_LARGE.has(size) ? avatar.large : avatar.small) : null;
  const showsPhoto = src !== null && failed !== src;

  return (
    <span
      aria-hidden="true"
      className={`av a${tintFor(id ?? name)} ${SIZE_CLASS[size]} ${showsPhoto ? 'has-photo' : ''}`}
    >
      {initials(name)}
      {showsPhoto && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(src)}
        />
      )}
    </span>
  );
};
