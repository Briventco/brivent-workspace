import React, { useState } from 'react';
import { forgotPassword } from '../api/auth';
import { ApiError, errorMessage } from '../api/client';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Link } from '../lib/router';
import { validateEmail } from '../lib/validation';

export const ForgotPasswordView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextError = validateEmail(email);
    setEmailError(nextError);
    if (nextError) return;

    setIsSubmitting(true);
    try {
      setSentMessage(await forgotPassword(email.trim()));
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors.email) {
        setEmailError(error.fieldErrors.email);
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Forgot password?" subtitle="We'll email you a link to choose a new one">
      <div className="space-y-4">
        {sentMessage ? (
          <Banner tone="success">{sentMessage}</Banner>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {formError && <Banner>{formError}</Banner>}
            <Input
              label="Work email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={emailError}
            />
            <Button type="submit" block isLoading={isSubmitting}>
              Send reset link
            </Button>
          </form>
        )}
        <p className="text-body text-center">
          <Link to="/login" className="font-semibold rounded">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};
