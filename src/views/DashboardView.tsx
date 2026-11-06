import React from 'react';
import { ApiError } from '../api/client';
import { getTaskSummary } from '../api/tasks';
import { DashboardGreeting } from '../components/dashboard/DashboardGreeting';
import { ManagerDashboard } from '../components/dashboard/ManagerDashboard';
import { MemberDashboard } from '../components/dashboard/MemberDashboard';
import { ErrorState, NoAccess } from '../components/ui/AsyncState';
import { Skeleton, SkeletonList } from '../components/ui/Skeleton';
import { useSession } from '../context/AuthContext';
import { useApiQuery } from '../lib/useApiQuery';

const DashboardSkeleton: React.FC = () => (
  <div role="status" aria-label="Loading your dashboard…">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-[104px] rounded-lg" />
      ))}
    </div>
    <SkeletonList rows={3} />
  </div>
);

export const DashboardView: React.FC = () => {
  const { can } = useSession();
  const summary = useApiQuery(getTaskSummary, []);

  if (!can('viewOwnTasks')) return <DashboardGreeting />;

  if (summary.error instanceof ApiError && summary.error.isForbidden) return <NoAccess />;
  if (summary.error) {
    return (
      <>
        <DashboardGreeting />
        <ErrorState
          icon="cloud_off"
          title="Couldn't load your dashboard"
          message="Check your connection and try again. Nothing has been lost."
          onRetry={summary.reload}
        />
      </>
    );
  }
  if (!summary.data) {
    return (
      <>
        <DashboardGreeting />
        <DashboardSkeleton />
      </>
    );
  }

  return can('viewTeamDashboard') ? (
    <ManagerDashboard summary={summary.data} onChanged={summary.reload} />
  ) : (
    <MemberDashboard summary={summary.data} />
  );
};
