import React from 'react';
import { Icon, IconName } from './Icon';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  trailingIcon?: IconName;
  block?: boolean;
  isLoading?: boolean;
  /** The progress word shown while loading, such as "Sending invite". */
  loadingLabel?: string;
}

const SIZE_CLASS: Record<ButtonSize, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

/** Heights are 30, 36 and 44. One primary per view. */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  block = false,
  isLoading = false,
  loadingLabel,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`btn btn-${variant} ${SIZE_CLASS[size]} ${block ? 'btn-block' : ''} ${
      isLoading ? 'is-loading' : ''
    } ${className}`}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    {...props}
  >
    {/* The label stays in the layout while loading, so the button keeps its width. */}
    <span className="grid">
      <span className={`[grid-area:1/1] inline-flex items-center justify-center gap-1.5 ${isLoading ? 'invisible' : ''}`}>
        {icon && <Icon name={icon} />}
        {children}
        {trailingIcon && <Icon name={trailingIcon} />}
      </span>
      {isLoading && (
        <span className="[grid-area:1/1] inline-flex items-center justify-center gap-1.5">
          <Spinner />
          {loadingLabel}
        </span>
      )}
    </span>
  </button>
);

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Icon-only buttons always need a name. */
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary';
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    aria-label={label}
    title={label}
    className={`btn btn-icon btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
    {...props}
  >
    <Icon name={icon} />
  </button>
);
