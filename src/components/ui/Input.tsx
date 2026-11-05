import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

const fieldStyles =
  'block w-full rounded-lg border bg-white text-sm px-3.5 py-2 transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500';

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = `${inputId}-hint`;
    const hint = error ?? helperText;

    return (
      <div className="w-full">
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
        <input
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint ? hintId : undefined}
          className={`${fieldStyles} ${
            error
              ? 'border-rose-400 text-rose-900'
              : 'border-slate-300 text-slate-900 placeholder-slate-500'
          } ${className}`}
          {...props}
        />
        {hint && (
          <p
            id={hintId}
            className={`mt-1.5 text-sm ${error ? 'text-rose-700' : 'text-slate-600'}`}
          >
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
