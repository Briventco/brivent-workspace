import React from 'react';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((part) => part.charAt(0).toUpperCase()).join('');
}

export const Avatar: React.FC<{ name: string; className?: string }> = ({
  name,
  className = 'w-9 h-9 text-sm',
}) => (
  <span
    aria-hidden="true"
    className={`inline-flex items-center justify-center rounded-full bg-brivent-100 text-brivent-800 font-semibold shrink-0 ${className}`}
  >
    {initials(name)}
  </span>
);
