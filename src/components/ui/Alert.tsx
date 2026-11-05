import React from 'react';
import { AlertCircle } from 'lucide-react';

/** Inline form-level error. */
export const Alert: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    role="alert"
    className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
  >
    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </div>
);
