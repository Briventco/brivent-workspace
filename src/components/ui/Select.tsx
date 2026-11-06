import React, { useId } from 'react';
import { describedById, Field } from './fieldParts';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: SelectOption[];
  helperText?: string;
  /** Keeps the label for screen readers where the context already shows what it is. */
  hideLabel?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, helperText, hideLabel = false, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <Field id={selectId} label={label} hideLabel={hideLabel} error={error} hint={helperText}>
        <select
          id={selectId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById(selectId, error, helperText)}
          className={`select ${error ? 'is-error' : ''} ${className}`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
    );
  },
);

Select.displayName = 'Select';
