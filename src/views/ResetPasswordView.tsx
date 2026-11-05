import React from 'react';
import { resetPassword } from '../api/auth';
import { AuthLayout } from '../components/auth/AuthLayout';
import { LinkPasswordForm } from '../components/auth/LinkPasswordForm';
import { Link } from '../lib/router';

export const ResetPasswordView: React.FC = () => (
  <AuthLayout title="Reset your password" subtitle="Choose a new password for your account">
    <LinkPasswordForm
      submit={resetPassword}
      submitLabel="Reset password"
      successNotice="Password reset, please log in."
      invalidLinkMessage={
        <>
          This link has expired or has already been used.{' '}
          <Link to="/forgot-password" className="font-medium underline rounded">
            Forgot password?
          </Link>
        </>
      }
    />
  </AuthLayout>
);
