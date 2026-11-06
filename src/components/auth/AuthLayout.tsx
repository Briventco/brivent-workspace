import React from 'react';
import logo from '../../assets/brivent/logos/brivent-logo-cobalt-lavender.svg';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => (
  <main className="min-h-screen bg-ink flex flex-col justify-center py-12 px-4">
    <div className="mx-auto w-full max-w-[420px]">
      <img src={logo} alt="Brivent" className="h-8 mx-auto mb-8" />
      <div className="bg-surface rounded-xl shadow-lg p-6">
        <h1 className="t-h1">{title}</h1>
        <p className="mt-1 mb-5 text-text-2">{subtitle}</p>
        {children}
      </div>
    </div>
  </main>
);
