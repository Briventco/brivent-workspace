import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ApiError, errorMessage } from '../../api/client';
import { Role, ROLES, ROLE_LABELS, User } from '../../api/types';
import { createUser } from '../../api/users';
import { useToast } from '../../context/ToastContext';
import { validateEmail, validateNewPassword } from '../../lib/validation';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters, no 0/O or 1/I.

function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const characters = Array.from(bytes, (byte) => ALPHABET[byte & 31]).join('');
  return characters.match(/.{4}/g)!.join('-');
}

interface AddUserModalProps {
  canAssignSuperAdmin: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface FieldErrors {
  fullName?: string;
  email?: string;
  temporaryPassword?: string;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  canAssignSuperAdmin,
  onClose,
  onCreated,
}) => {
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('TEAM_MEMBER');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<User | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const roleOptions = ROLES.filter((r) => r !== 'SUPER_ADMIN' || canAssignSuperAdmin).map(
    (value) => ({ value, label: ROLE_LABELS[value] }),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors: FieldErrors = {
      fullName: fullName.trim() ? undefined : 'Enter their full name.',
      email: validateEmail(email),
      temporaryPassword: validateNewPassword(temporaryPassword),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    try {
      const user = await createUser({
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        temporaryPassword,
      });
      setCreated(user);
      toast.success(`${user.fullName} has been added.`);
      onCreated();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_EXISTS') {
        setErrors({ email: error.message });
      } else if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const { name, email: emailError, temporaryPassword: passwordError } = error.fieldErrors;
        setErrors({ fullName: name, email: emailError, temporaryPassword: passwordError });
        if (!name && !emailError && !passwordError) setFormError(error.message);
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setIsCopied(true);
    } catch {
      toast.error("Couldn't copy it. Select the password and copy it manually.");
    }
  };

  if (created) {
    return (
      <Modal isOpen onClose={onClose} title="User added">
        <p className="text-sm text-slate-700">
          Send <strong>{created.fullName}</strong> this temporary password through a secure channel.
          They'll sign in with {created.email} and be asked to replace it. It won't be shown again.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 pl-3.5">
          <code className="flex-1 min-w-0 break-all font-mono text-sm text-slate-900">
            {temporaryPassword}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            leftIcon={
              isCopied ? (
                <Check className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )
            }
          >
            {isCopied ? 'Copied' : 'Copy'}
          </Button>
        </div>
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
      onClose={onClose}
      title="Add user"
      description="They'll be asked to replace the temporary password when they first sign in."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}
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
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          options={roleOptions}
        />
        <div>
          <Input
            label="Temporary password"
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            error={errors.temporaryPassword}
            helperText="At least 12 characters."
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
          <button
            type="button"
            onClick={() => setTemporaryPassword(generatePassword())}
            className="mt-1.5 text-sm font-medium text-brivent-700 hover:underline rounded"
          >
            Generate a password
          </button>
        </div>
        <div className="pt-2 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Add user
          </Button>
        </div>
      </form>
    </Modal>
  );
};
