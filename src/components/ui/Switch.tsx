import React from 'react';

interface SwitchProps {
  /** The name read out by screen readers. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({ label, checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`switch ${checked ? 'on' : ''}`}
  />
);
