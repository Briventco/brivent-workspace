import React from 'react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, className = '', ...props }) => (
  <label className={`inline-flex items-center gap-2 text-body text-text ${className}`}>
    <input type="checkbox" className="check" {...props} />
    {label}
  </label>
);
