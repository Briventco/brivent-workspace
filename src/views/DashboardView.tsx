import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useSession } from '../context/AuthContext';

export const DashboardView: React.FC = () => {
  const { user } = useSession();
  const firstName = user.fullName.trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} />
      <EmptyState
        icon={<LayoutDashboard className="w-6 h-6" aria-hidden="true" />}
        title="Coming soon"
        description="Your tasks, projects and team updates will come together here."
      />
    </>
  );
};
