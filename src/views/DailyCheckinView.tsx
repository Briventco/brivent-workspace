import React from 'react';
import { MyCheckin } from '../components/checkins/MyCheckin';
import { TeamReview } from '../components/checkins/TeamReview';
import { NoAccess } from '../components/ui/AsyncState';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { useSession } from '../context/AuthContext';
import { navigate, useSearch } from '../lib/router';

type Tab = 'team' | 'mine';

const COPY: Record<Tab, { title: string; description: string }> = {
  team: {
    title: 'Daily check-ins',
    description: 'Blockers first, then everyone else. Reply here and it shows on their check-in.',
  },
  mine: {
    title: 'Daily check-in',
    description: 'Three short answers, once a day. Your lead reads these instead of chasing you on WhatsApp.',
  },
};

export const DailyCheckinView: React.FC = () => {
  const { can } = useSession();
  const search = useSearch();
  const canReview = can('viewTeamCheckins');

  const requested = new URLSearchParams(search).get('tab');
  const tab: Tab = requested === 'mine' || requested === 'team' ? requested : canReview ? 'team' : 'mine';

  if (tab === 'team' && !canReview) {
    return (
      <NoAccess
        title="Team check-ins are for leads"
        description="You can see and edit your own check-ins any time."
        backTo="/daily"
        backLabel="Go to my check-in"
      />
    );
  }

  return (
    <>
      <PageHeader
        title={COPY[tab].title}
        description={COPY[tab].description}
        actions={
          canReview && (
            <Tabs
              label="Check-in views"
              tabs={[
                { value: 'team' as Tab, label: 'Team review' },
                { value: 'mine' as Tab, label: 'My check-in' },
              ]}
              value={tab}
              onChange={(next) => navigate(`/daily?tab=${next}`, { replace: true })}
            />
          )
        }
      />
      {tab === 'team' ? <TeamReview /> : <MyCheckin />}
    </>
  );
};
