import React, { useState } from 'react';
import { errorMessage } from '../../api/client';
import { User } from '../../api/types';
import { resetUserPassword } from '../../api/users';
import { useToast } from '../../context/ToastContext';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { TemporaryPassword } from './TemporaryPassword';

interface ResetPasswordModalProps {
  user: User;
  onClose: () => void;
  onReset: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  user,
  onClose,
  onReset,
}) => {
  const toast = useToast();
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    setError('');
    setIsResetting(true);
    try {
      setTemporaryPassword(await resetUserPassword(user.id));
      toast.success(`${user.fullName}'s password has been reset.`);
      onReset();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsResetting(false);
    }
  };

  if (temporaryPassword) {
    return (
      <Modal isOpen onClose={onClose} title="Temporary password">
        <p className="text-sm text-slate-700">
          Send <strong>{user.fullName}</strong> this temporary password through a secure channel.
          They'll be asked to replace it when they sign in. It won't be shown again.
        </p>
        <TemporaryPassword password={temporaryPassword} />
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} data-autofocus>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={isResetting ? () => {} : onClose}
      title="Reset password?"
      maxWidth="sm"
    >
      <p className="text-sm text-slate-700">
        {user.fullName} will be signed out everywhere and given a new temporary password.
      </p>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={isResetting} data-autofocus>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleReset} isLoading={isResetting}>
          Reset password
        </Button>
      </div>
    </Modal>
  );
};
