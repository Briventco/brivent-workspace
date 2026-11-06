import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { Role, ROLES, ROLE_LABELS, User } from '../../api/types';
import { updateUser, UserChanges } from '../../api/users';
import { useToast } from '../../context/ToastContext';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Select } from '../ui/Select';

interface EditUserModalProps {
  user: User;
  isSelf: boolean;
  canAssignSuperAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  isSelf,
  canAssignSuperAdmin,
  onClose,
  onSaved,
}) => {
  const toast = useToast();
  const [fullName, setFullName] = useState(user.fullName);
  const [role, setRole] = useState<Role>(user.role);
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roleOptions = ROLES.filter(
    (r) => r !== 'SUPER_ADMIN' || canAssignSuperAdmin || user.role === 'SUPER_ADMIN',
  ).map((value) => ({ value, label: ROLE_LABELS[value] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setNameError('Enter their full name.');
      return;
    }
    setNameError(undefined);

    const changes: UserChanges = {};
    if (trimmedName !== user.fullName) changes.fullName = trimmedName;
    if (role !== user.role) changes.role = role;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      await updateUser(user.id, changes);
      toast.success(`${trimmedName} has been updated.`);
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.name) {
        setNameError(error.fieldErrors.name);
      } else {
        setFormError(errorMessage(error));
      }
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={isSubmitting ? () => {} : onClose} title="Edit user" description={user.email}>
      <form onSubmit={handleSubmit} noValidate className="contents">
        <ModalBody>
          {formError && <Banner>{formError}</Banner>}
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={nameError}
            autoComplete="off"
            data-autofocus
          />
          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={roleOptions}
            disabled={isSelf}
            helperText={isSelf ? "You can't change your own role." : undefined}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Save changes
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
