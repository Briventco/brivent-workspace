import React from 'react';

const SIZE_CLASS = { xs: 'av-xs', sm: 'av-sm', md: '', lg: 'av-lg', xl: 'av-xl' };
const TINTS = 7;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part.charAt(0).toUpperCase()).join('');
}

/** The same person always gets the same tint. */
function tintFor(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % TINTS) + 1;
}

interface AvatarProps {
  name: string;
  /** Picks the colour. Pass the user id wherever there is one. */
  id?: string;
  size?: keyof typeof SIZE_CLASS;
}

export const Avatar: React.FC<AvatarProps> = ({ name, id, size = 'md' }) => (
  <span aria-hidden="true" className={`av a${tintFor(id ?? name)} ${SIZE_CLASS[size]}`}>
    {initials(name)}
  </span>
);
