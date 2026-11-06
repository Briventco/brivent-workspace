import React, { useState } from 'react';
import { getTodayCheckin } from '../../api/checkins';
import { listOpenTasks } from '../../api/tasks';
import { useApiQuery } from '../../lib/useApiQuery';
import { AsyncState } from '../ui/AsyncState';
import { CheckinForm } from './CheckinForm';
import { CheckinHistory } from './CheckinHistory';

export const MyCheckin: React.FC = () => {
  const today = useApiQuery(getTodayCheckin, []);
  const tasks = useApiQuery((signal) => listOpenTasks('mine', {}, signal), []);
  const [savedCount, setSavedCount] = useState(0);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div className="min-w-0">
        <AsyncState query={today} loadingLabel="Loading your check-in…" errorTitle="Couldn't load your check-in">
          {(checkin) => (
            <CheckinForm
              checkin={checkin}
              tasks={tasks.data ?? []}
              onSaved={() => setSavedCount((n) => n + 1)}
            />
          )}
        </AsyncState>
        <p className="mt-3 text-center lg:hidden">
          <a href="#past-check-ins" className="font-semibold">
            See my past check-ins
          </a>
        </p>
      </div>
      <CheckinHistory refreshKey={savedCount} />
    </div>
  );
};
