import React from 'react';
import { useSession } from '../../context/AuthContext';
import { formatLongDate, greeting } from '../../lib/wat';

export const DashboardGreeting: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useSession();
  const firstName = user.fullName.trim().split(/\s+/)[0];

  return (
    <header className="mb-5 md:mb-6">
      <p className="text-small text-text-2">{formatLongDate()}</p>
      <h1 className="t-h1 md:text-display">
        {greeting()}, {firstName}
      </h1>
      {children && <p className="mt-1 text-text-2">{children}</p>}
    </header>
  );
};
