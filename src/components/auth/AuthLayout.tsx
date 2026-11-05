import React from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => (
  <main className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4">
    <div className="mx-auto w-full max-w-md">
      <div className="text-center mb-8">
        <img src="/logo.svg" alt="" className="w-12 h-12 mx-auto mb-4" />
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
      </div>
      <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8">{children}</div>
    </div>
  </main>
);
