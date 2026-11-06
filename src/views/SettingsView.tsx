import React from 'react';
import { format } from 'date-fns';
import { PasswordChangeForm } from '../components/auth/PasswordChangeForm';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { ROLE_LABELS } from '../api/types';
import { useAuth, useSession } from '../context/AuthContext';
import { personTitle } from '../lib/people';

export const SettingsView: React.FC = () => {
  const { signOut } = useAuth();
  const { user } = useSession();

  const details = [
    { label: 'Email', value: user.email },
    { label: 'Department', value: user.department?.name ?? 'Not set' },
    { label: 'Position', value: user.position?.name ?? 'Not set' },
    { label: 'Access level', value: ROLE_LABELS[user.role] },
        { label: 'Member since', value: format(new Date(user.createdAt), 'd MMMM yyyy') },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Your account, password and session." />

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="t-h2">My profile</h2>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-4">
                <Avatar name={user.fullName} id={user.id} size="xl" />
                <div className="min-w-0">
                  <p className="t-h2 truncate">{user.fullName}</p>
                  <p className="mt-1 text-text-2 truncate">{personTitle(user)}</p>
                </div>
              </div>
              <dl className="mt-6 space-y-3">
                {details.map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-text-2">{label}</dt>
                    <dd className="font-semibold text-right break-all">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-text-2">
                To change these details, ask your administrator.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="t-h2">Log out</h2>
            </CardHeader>
            <CardBody>
              <p className="text-text-2 mb-4">
                This logs you out on all your devices.
              </p>
              <Button variant="secondary" icon="logout" onClick={signOut}>
                Log out
              </Button>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="t-h2">Change password</h2>
          </CardHeader>
          <CardBody>
            <PasswordChangeForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
};
