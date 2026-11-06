import React, { useState } from 'react';
import { errorMessage } from '../api/client';
import { AuthLayout } from '../components/auth/AuthLayout';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { readLoginHandoff } from '../lib/loginHandoff';
import { Link } from '../lib/router';
import { validateEmail } from '../lib/validation';

export const LoginView: React.FC = () => {
  const { signIn } = useAuth();
  const [handoff] = useState(readLoginHandoff);
  const [notice, setNotice] = useState(handoff?.notice ?? '');
  const [email, setEmail] = useState(handoff?.email ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setNotice('');

    const nextErrors = {
      email: validateEmail(email),
      password: password ? undefined : 'Enter your password.',
    };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      setFormError(errorMessage(error));
      setPassword('');
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Brivent Workspace" subtitle="Sign in with your work account">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {notice && <Banner tone="success">{notice}</Banner>}
        {formError && <Banner>{formError}</Banner>}
        <Input
          label="Work email"
          type="email"
          autoComplete="username"
          autoFocus={!email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          autoFocus={Boolean(email)}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Button type="submit" block isLoading={isSubmitting}>
          Sign in
        </Button>
        <p className="text-body text-center">
          <Link to="/forgot-password" className="font-semibold rounded">
            Forgot password?
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
