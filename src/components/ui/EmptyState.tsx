import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, children }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-dashed border-slate-300 bg-white">
    <div className="p-3 bg-brivent-50 text-brivent-600 rounded-xl mb-4">{icon}</div>
    <h2 className="text-base font-semibold text-slate-900 mb-1">{title}</h2>
    <p className="text-sm text-slate-600 max-w-md">{description}</p>
    {children && <div className="mt-6">{children}</div>}
  </div>
);
