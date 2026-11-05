import React from 'react';
import { format } from 'date-fns';
import { LogOut } from 'lucide-react';
import { ROLE_LABELS } from '../api/types';
import { PasswordChangeForm } from '../components/auth/PasswordChangeForm';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth, useSession } from '../context/AuthContext';

export const SettingsView: React.FC = () => {
  const { signOut } = useAuth();
  const { user } = useSession();

  const details = [
    { label: 'Email', value: user.email },
    { label: 'Role', value: ROLE_LABELS[user.role] },
    { label: 'Member since', value: format(new Date(user.createdAt), 'd MMMM yyyy') },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Your account, password and session." />

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-900">My profile</h2>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-4">
                <Avatar name={user.fullName} className="w-14 h-14 text-lg" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-900 truncate">{user.fullName}</p>
                  <p className="text-sm text-slate-600">{ROLE_LABELS[user.role]}</p>
                </div>
              </div>
              <dl className="mt-6 space-y-3 text-sm">
                {details.map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-slate-600">{label}</dt>
                    <dd className="font-medium text-slate-900 text-right break-all">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-slate-600">
                To change these details, ask your administrator.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-900">Log out</h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-slate-700 mb-4">
                This logs you out on all your devices.
              </p>
              <Button
                variant="outline"
                onClick={signOut}
                leftIcon={<LogOut className="w-4 h-4" aria-hidden="true" />}
              >
                Log out
              </Button>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-900">Change password</h2>
          </CardHeader>
          <CardBody>
            <PasswordChangeForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
};
