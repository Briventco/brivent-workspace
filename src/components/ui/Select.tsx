import React, { useId } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: SelectOption[];
  helperText?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, helperText, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const hintId = `${selectId}-hint`;
    const hint = error ?? helperText;

    return (
      <div className="w-full">
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
        <select
          id={selectId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint ? hintId : undefined}
          className={`block w-full rounded-lg border text-sm px-3.5 py-2 bg-white transition-colors duration-150 disabled:bg-slate-100 disabled:text-slate-500 ${
            error ? 'border-rose-400 text-rose-900' : 'border-slate-300 text-slate-900'
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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

Select.displayName = 'Select';
