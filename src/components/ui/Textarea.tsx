import React, { useId } from 'react';
import { describedById, Field } from './fieldParts';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hideLabel?: boolean;
  optional?: boolean;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hideLabel, optional, error, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;

    return (
      <Field
        id={textareaId}
        label={label}
        hideLabel={hideLabel}
        optional={optional}
        error={error}
        hint={helperText}
      >
        <textarea
          id={textareaId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById(textareaId, error, helperText)}
          className={`textarea ${error ? 'is-error' : ''} ${className}`}
          {...props}
        />
      </Field>
    );
  },
);

Textarea.displayName = 'Textarea';
