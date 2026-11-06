import React, { useState } from 'react';
import { errorMessage } from '../../api/client';
import { User } from '../../api/types';
import { EmailedLinkResult, resetUserPassword } from '../../api/users';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { EmailResultModal } from './EmailResultModal';

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
  const [result, setResult] = useState<EmailedLinkResult | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    setError('');
    setIsResetting(true);
    try {
      setResult(await resetUserPassword(user.id));
      onReset();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsResetting(false);
    }
  };

  if (result) {
    return (
      <EmailResultModal
        result={result}
        sentTitle="Reset email sent"
        sentMessage={`A password reset email was sent to ${user.email}. The link lasts 1 hour.`}
        failedMessage={`${user.fullName}'s password has been reset, but the email to ${user.email} failed.`}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal
      isOpen
      onClose={isResetting ? () => {} : onClose}
      title="Reset password?"
      maxWidth="sm"
    >
      <ModalBody>
        <p className="text-text-2">
          {user.fullName}'s current password will stop working immediately and they'll be signed
          out everywhere. We'll email them a link to choose a new one.
        </p>
        {error && <Banner>{error}</Banner>}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isResetting} data-autofocus>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleReset} isLoading={isResetting}>
          Reset password
        </Button>
      </ModalFooter>
    </Modal>
  );
};
