import React from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const baseStyles =
  'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-brivent-600 text-white hover:bg-brivent-700 shadow-xs',
  secondary: 'bg-slate-800 text-white hover:bg-slate-900 shadow-xs',
  outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-xs',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-5 py-2.5 gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    disabled={disabled || isLoading}
    aria-busy={isLoading || undefined}
    {...props}
  >
    {isLoading ? <Spinner className="w-4 h-4" /> : leftIcon}
    {children}
    {!isLoading && rightIcon}
  </button>
);
