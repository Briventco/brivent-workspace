import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { validateNewPassword } from '../../lib/validation';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface FieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

const EMPTY_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

function validate(form: typeof EMPTY_FORM): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.currentPassword) errors.currentPassword = 'Enter your current password.';
  errors.newPassword = validateNewPassword(form.newPassword);
  if (!errors.newPassword && form.newPassword === form.currentPassword) {
    errors.newPassword = 'Your new password must be different from your current one.';
  }
  if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = "Those passwords don't match.";
  }
  return errors;
}

export const PasswordChangeForm: React.FC<{
  currentPasswordLabel?: string;
  submitFullWidth?: boolean;
}> = ({ currentPasswordLabel = 'Current password', submitFullWidth = false }) => {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (field: keyof FieldErrors) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setIsSubmitting(true);
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setForm(EMPTY_FORM);
      toast.success('Password changed. Your other sessions have been signed out.');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CURRENT_PASSWORD') {
        setErrors({ currentPassword: error.message });
      } else if (error instanceof ApiError && error.code === 'PASSWORD_UNCHANGED') {
        setErrors({ newPassword: error.message });
      } else if (error instanceof ApiError && error.fieldErrors.newPassword) {
        setErrors({ newPassword: error.fieldErrors.newPassword });
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <Input
        label={currentPasswordLabel}
        type="password"
        autoComplete="current-password"
        value={form.currentPassword}
        onChange={update('currentPassword')}
        error={errors.currentPassword}
      />
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        value={form.newPassword}
        onChange={update('newPassword')}
        error={errors.newPassword}
        helperText="At least 12 characters."
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={update('confirmPassword')}
        error={errors.confirmPassword}
      />
      <Button type="submit" isLoading={isSubmitting} className={submitFullWidth ? 'w-full' : ''}>
        Change password
      </Button>
    </form>
  );
};
