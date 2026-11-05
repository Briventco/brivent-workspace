import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const TONES = {
  error: { Icon: AlertCircle, role: 'alert', styles: 'border-rose-200 bg-rose-50 text-rose-800' },
  success: {
    Icon: CheckCircle2,
    role: 'status',
    styles: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
};

/** Inline form-level message. */
export const Alert: React.FC<{ tone?: keyof typeof TONES; children: React.ReactNode }> = ({
  tone = 'error',
  children,
}) => {
  const { Icon, role, styles } = TONES[tone];
  return (
    <div
      role={role}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${styles}`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
};
