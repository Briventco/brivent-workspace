import React, { useEffect, useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { goToLogin } from '../../lib/loginHandoff';
import { Link } from '../../lib/router';
import { validateNewPassword } from '../../lib/validation';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/** Reads the emailed token once, then takes it out of the address bar and browser history. */
function useEmailedToken(): string {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);

  return token;
}

interface LinkPasswordFormProps {
  submit: (token: string, newPassword: string) => Promise<{ email?: string }>;
  submitLabel: string;
  successNotice: string;
  /** What to do next when the link is expired, used or replaced. */
  invalidLinkMessage: React.ReactNode;
}

const DeadEnd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-4">
    <Banner>{children}</Banner>
    <p className="text-body text-center">
      <Link to="/login" className="font-semibold rounded">
        Back to sign in
      </Link>
    </p>
  </div>
);

export const LinkPasswordForm: React.FC<LinkPasswordFormProps> = ({
  submit,
  submitLabel,
  successNotice,
  invalidLinkMessage,
}) => {
  const token = useEmailedToken();
  const { forgetSession } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState('');
  const [isLinkDead, setIsLinkDead] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors = {
      newPassword: validateNewPassword(newPassword),
      confirmPassword: confirmPassword === newPassword ? undefined : "Those passwords don't match.",
    };
    setErrors(nextErrors);
    if (nextErrors.newPassword || nextErrors.confirmPassword) return;

    setIsSubmitting(true);
    try {
      const { email } = await submit(token, newPassword);
      // Whoever was signed in to this tab isn't necessarily the person this link is for.
      forgetSession();
      goToLogin({ notice: successNotice, email });
    } catch (error) {
      setIsSubmitting(false);
      if (error instanceof ApiError && (error.code === 'INVALID_TOKEN' || error.fieldErrors.token)) {
        setIsLinkDead(true);
      } else if (error instanceof ApiError && error.fieldErrors.newPassword) {
        setErrors({ newPassword: error.fieldErrors.newPassword });
      } else {
        setFormError(errorMessage(error));
      }
    }
  };

  if (!token) {
    return <DeadEnd>This link is incomplete. Open it again from your email.</DeadEnd>;
  }
  if (isLinkDead) return <DeadEnd>{invalidLinkMessage}</DeadEnd>;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Banner>{formError}</Banner>}
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        autoFocus
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={errors.newPassword}
        helperText="At least 12 characters."
      />
      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
      />
      <Button type="submit" block isLoading={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
};
