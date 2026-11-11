import React, { useState } from 'react';
import { getTodayCheckin } from '../../api/checkins';
import { listOpenTasks } from '../../api/tasks';
import { useApiQuery } from '../../lib/useApiQuery';
import { AsyncState } from '../ui/AsyncState';
import { SkeletonBlock } from '../ui/Skeleton';
import { CheckinForm } from './CheckinForm';
import { CheckinHistory } from './CheckinHistory';

export const MyCheckin: React.FC = () => {
  const today = useApiQuery(getTodayCheckin, [], 'checkins:today');
  const tasks = useApiQuery((signal) => listOpenTasks('mine', {}, signal), [], 'tasks:open:mine');
  const [savedCount, setSavedCount] = useState(0);

  // The form waits for the task list too, since the linked-task picker changes its height. If the
  // tasks fail, the form still opens, just without suggestions.
  const hasTasksAnswer = tasks.data !== undefined || Boolean(tasks.error);
  const form = { ...today, data: hasTasksAnswer ? today.data : undefined };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div className="min-w-0">
        <AsyncState
          query={form}
          errorTitle="Couldn't load your check-in"
          loading={<SkeletonBlock label="Loading your check-in…" minHeight={540} lines={4} />}
        >
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
