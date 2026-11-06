import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { Role, ROLES, ROLE_LABELS } from '../../api/types';
import { createUser, EmailedLinkResult } from '../../api/users';
import { validateEmail } from '../../lib/validation';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Select } from '../ui/Select';
import { EmailResultModal } from './EmailResultModal';
import {
  NO_PLACEMENT,
  PlacementErrors,
  placementErrors,
  PlacementFields,
  PlacementValue,
  toPlacementIds,
} from './PlacementFields';

interface AddUserModalProps {
  canAssignSuperAdmin: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface FieldErrors extends PlacementErrors {
  fullName?: string;
  email?: string;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  canAssignSuperAdmin,
  onClose,
  onCreated,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [placement, setPlacement] = useState<PlacementValue>(NO_PLACEMENT);
  const [refreshKey, setRefreshKey] = useState(0);
  const [role, setRole] = useState<Role>('TEAM_MEMBER');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<EmailedLinkResult | null>(null);

  const roleOptions = ROLES.filter((r) => r !== 'SUPER_ADMIN' || canAssignSuperAdmin).map(
    (value) => ({ value, label: ROLE_LABELS[value] }),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors: FieldErrors = {
      fullName: fullName.trim() ? undefined : 'Enter their full name.',
      email: validateEmail(email),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    try {
      setResult(
        await createUser({
          fullName: fullName.trim(),
          email: email.trim(),
          role,
          ...toPlacementIds(placement),
        }),
      );
      onCreated();
    } catch (error) {
      const placementError = placementErrors(error);
      if (placementError) {
        setErrors(placementError);
        setRefreshKey((key) => key + 1);
      } else if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_EXISTS') {
        setErrors({ email: error.message });
      } else if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const { name, email: emailError } = error.fieldErrors;
        setErrors({ fullName: name, email: emailError });
        if (!name && !emailError) setFormError(error.message);
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <EmailResultModal
        result={result}
        sentTitle="Invite sent"
        sentMessage={`Invite sent to ${result.user.email}. The link lasts 48 hours.`}
        failedMessage={`${result.user.fullName} has been added, but the invite to ${result.user.email} failed. You can also try again with Resend invite.`}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal
      isOpen
      onClose={isSubmitting ? () => {} : onClose}
      title="Invite someone"
      description="They'll get an email with a link to set their own password."
    >
      <form onSubmit={handleSubmit} noValidate className="contents">
        <ModalBody>
          {formError && <Banner>{formError}</Banner>}
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            autoComplete="off"
            data-autofocus
          />
          <Input
            label="Work email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="off"
          />
          <PlacementFields
            value={placement}
            onChange={setPlacement}
            errors={errors}
            refreshKey={refreshKey}
          />
          <Select
            label="Access level"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={roleOptions}
            helperText="Decides what they can do in the workspace."
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Send invite
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
