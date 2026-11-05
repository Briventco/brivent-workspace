import React from 'react';
import { setPassword } from '../api/auth';
import { AuthLayout } from '../components/auth/AuthLayout';
import { LinkPasswordForm } from '../components/auth/LinkPasswordForm';

export const SetPasswordView: React.FC = () => (
  <AuthLayout title="Set your password" subtitle="Choose a password to finish joining Brivent Workspace">
    <LinkPasswordForm
      submit={setPassword}
      submitLabel="Set password"
      successNotice="Password set, please log in."
      invalidLinkMessage="This link has expired or has already been used. Ask your administrator to send you a new invite."
    />
  </AuthLayout>
);
