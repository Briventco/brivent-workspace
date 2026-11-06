import React from 'react';
import { AuthLayout } from '../components/auth/AuthLayout';
import { PasswordChangeForm } from '../components/auth/PasswordChangeForm';
import { Button } from '../components/ui/Button';
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
      <Button variant="ghost" icon="logout" block onClick={signOut} className="mt-3">
        Sign out
      </Button>
    </AuthLayout>
  );
};
