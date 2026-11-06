import React from 'react';
import { IconName } from './iconNames';

export type { IconName };

const OUTLINE = import.meta.glob('../../assets/brivent/icons/outline/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FILLED = import.meta.glob('../../assets/brivent/icons/filled/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const SIZE_CLASS = { sm: 'sm', md: '', lg: 'lg', xl: 'xl' };

interface IconProps {
  name: IconName;
  /** 16px in badges and dense rows, 20px in navigation and buttons, 24px and 32px for display. */
  size?: keyof typeof SIZE_CLASS;
  /** Only for the active nav item, Done status and Urgent priority. */
  filled?: boolean;
  /** Only for an icon that stands alone. Next to a word, leave it out. */
  label?: string;
  className?: string;
}

/** Material Symbols Rounded, inlined so it takes the text colour and never flashes as a word. */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  filled = false,
  label,
  className = '',
}) => {
  const set = filled ? FILLED : OUTLINE;
  const folder = filled ? 'filled' : 'outline';
  return (
    <span
      className={`ms ${SIZE_CLASS[size]} ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: set[`../../assets/brivent/icons/${folder}/${name}.svg`] }}
    />
  );
};
