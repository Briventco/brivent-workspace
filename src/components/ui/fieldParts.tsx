import React from 'react';
import { Icon } from './Icon';

interface FieldProps {
  id: string;
  label: string;
  hideLabel?: boolean;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export const describedById = (id: string, error?: string, hint?: string) =>
  error || hint ? `${id}-hint` : undefined;

/** The label, control and message every form field shares. */
export const Field: React.FC<FieldProps> = ({
  id,
  label,
  hideLabel = false,
  optional = false,
  error,
  hint,
  children,
}) => (
  <div className="field w-full">
    <label htmlFor={id} className={hideLabel ? 'sr-only' : 'label'}>
      {label}
      {optional && <span className="font-normal text-text-3"> (optional)</span>}
    </label>
    {children}
    {error ? (
      <p id={`${id}-hint`} className="err">
        <Icon name="error" size="sm" />
        {error}
      </p>
    ) : (
      hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )
    )}
  </div>
);
