import React, { useId, useState } from 'react';
import { describedById, Field } from './fieldParts';
import { Icon, IconName } from './Icon';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hideLabel?: boolean;
  optional?: boolean;
  error?: string;
  helperText?: string;
  icon?: IconName;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { label, hideLabel, optional, error, helperText, icon, type, className = '', id, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [isRevealed, setIsRevealed] = useState(false);
    const isPassword = type === 'password';

    return (
      <Field
        id={inputId}
        label={label}
        hideLabel={hideLabel}
        optional={optional}
        error={error}
        hint={helperText}
      >
        <div className={`input-wrap ${icon ? '' : 'no-lead'}`}>
          {icon && <Icon name={icon} />}
          <input
            id={inputId}
            ref={ref}
            type={isPassword && isRevealed ? 'text' : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedById(inputId, error, helperText)}
            className={`input ${error ? 'is-error' : ''} ${isPassword ? 'has-trail' : ''} ${className}`}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              className="trail btn btn-icon btn-ghost btn-sm"
              aria-label={isRevealed ? 'Hide characters' : 'Show characters'}
              aria-pressed={isRevealed}
              onClick={() => setIsRevealed((revealed) => !revealed)}
            >
              <Icon name="visibility" />
            </button>
          )}
        </div>
      </Field>
    );
  },
);

Input.displayName = 'Input';
