import React from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { PasswordChangeForm } from '../components/auth/PasswordChangeForm';
import { useAuth, useSession } from '../context/AuthContext';

export const ForcePasswordChangeView: React.FC = () => {
  const { signOut } = useAuth();
  const { user } = useSession();

  return (
    <AuthLayout
      title="Set a new password"
      subtitle={`${user.email} is using a temporary password. Replace it to continue.`}
    >
      <PasswordChangeForm currentPasswordLabel="Temporary password" submitFullWidth />
      <button
        type="button"
        onClick={signOut}
        className="mt-4 w-full text-center text-sm font-medium text-slate-600 hover:text-slate-900 rounded"
      >
        Sign out
      </button>
    </AuthLayout>
  );
};
