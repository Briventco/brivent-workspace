import React from 'react';
import { Icon } from './Icon';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  on?: boolean;
  /** Shows the arrow of a chip that opens a menu. */
  hasMenu?: boolean;
}

/** A filter. An active one is filled and carries a check. */
export const Chip: React.FC<ChipProps> = ({
  on = false,
  hasMenu = false,
  children,
  className = '',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    aria-pressed={hasMenu ? undefined : on}
    className={`chip ${on ? 'on' : ''} ${className}`}
    {...props}
  >
    {on && <Icon name="check" size="sm" />}
    {children}
    {hasMenu && <Icon name="expand_more" size="sm" />}
  </button>
);
