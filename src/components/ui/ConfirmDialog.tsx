import React from 'react';
import { Button, ButtonVariant } from './Button';
import { Modal, ModalBody, ModalFooter } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  isLoading = false,
  onConfirm,
  onClose,
}) => (
  <Modal isOpen={isOpen} onClose={isLoading ? () => {} : onClose} title={title} maxWidth="sm">
    <ModalBody>
      <p className="text-text-2">{description}</p>
    </ModalBody>
    <ModalFooter>
      <Button variant="secondary" onClick={onClose} disabled={isLoading} data-autofocus>
        Cancel
      </Button>
      <Button variant={confirmVariant} onClick={onConfirm} isLoading={isLoading}>
        {confirmLabel}
      </Button>
    </ModalFooter>
  </Modal>
);
