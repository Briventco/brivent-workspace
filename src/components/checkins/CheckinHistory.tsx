import React, { useState } from 'react';
import { listMyCheckins } from '../../api/checkins';
import { Checkin } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useApiQuery } from '../../lib/useApiQuery';
import {
  addDays,
  formatDayHeading,
  formatTime,
  isWeekend,
  watDate,
  watDayStart,
  weekStart,
} from '../../lib/wat';
import { AsyncState } from '../ui/AsyncState';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { Select } from '../ui/Select';
import { Answer, BlockerBox, LateTag, LinkedTasks, Replies } from './CheckinParts';

type Range = 'thisWeek' | 'lastWeek' | 'thisMonth';

const RANGE_OPTIONS = [
  { value: 'thisWeek', label: 'This week' },
  { value: 'lastWeek', label: 'Last week' },
  { value: 'thisMonth', label: 'Last 30 days' },
];

function rangeDates(range: Range): { from: string; to: string } {
  const monday = weekStart();
  if (range === 'lastWeek') {
    return { from: watDate(addDays(monday, -7)), to: watDate(addDays(monday, -1)) };
  }
  const from = range === 'thisWeek' ? monday : addDays(new Date(), -30);
  return { from: watDate(from), to: watDate() };
}

/** Weekdays with no check-in. Today isn't over, and days before the account existed don't count. */
function missedDays(from: string, to: string, createdAt: string, checkins: Checkin[]): string[] {
  const submitted = new Set(checkins.map((checkin) => checkin.date));
  const first = [from, watDate(new Date(createdAt))].sort()[1];
  const today = watDate();
  const days: string[] = [];
  for (let date = first; date <= to && date < today; date = watDate(addDays(watDayStart(date), 1))) {
    if (!submitted.has(date) && !isWeekend(watDayStart(date))) days.push(date);
  }
  return days;
}

const HistoryCard: React.FC<{ checkin: Checkin }> = ({ checkin }) => {
  const { user } = useSession();
  return (
    <Card className="card-pad space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="t-h3">{formatDayHeading(watDayStart(checkin.date))}</h3>
        <span className="flex items-center gap-2 text-small text-text-2">
          {checkin.isLate && <LateTag />}
          {formatTime(new Date(checkin.submittedAt))}
        </span>
      </div>
      <Answer label="Finished">{checkin.workCompleted}</Answer>
      <Answer label="Today">{checkin.priorities}</Answer>
      {checkin.blockers && <BlockerBox checkin={checkin} />}
      {checkin.blockerHandledBy && (
        <p className="text-small text-text-2">Handled by {checkin.blockerHandledBy.name}</p>
      )}
      <LinkedTasks checkin={checkin} />
      <Replies replies={checkin.replies} youId={user.id} />
    </Card>
  );
};

const MissedCard: React.FC<{ date: string }> = ({ date }) => (
  <Card className="card-pad flex items-center justify-between gap-2">
    <div>
      <h3 className="t-h3">{formatDayHeading(watDayStart(date))}</h3>
      <p className="text-small text-text-2">No check-in that day</p>
    </div>
    <span className="badge st-todo">
      <Icon name="remove" size="sm" />
      Missed
    </span>
  </Card>
);

export const CheckinHistory: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const { user } = useSession();
  const [range, setRange] = useState<Range>('thisWeek');
  const { from, to } = rangeDates(range);
  const today = watDate();

  const query = useApiQuery((signal) => listMyCheckins(from, to, signal), [from, to, refreshKey]);

  return (
    <section id="past-check-ins" aria-label="My past check-ins">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="t-h3">My past check-ins</h2>
        <div className="w-36">
          <Select
            label="Show"
            hideLabel
            value={range}
            options={RANGE_OPTIONS}
            onChange={(e) => setRange(e.target.value as Range)}
          />
        </div>
      </div>
      <AsyncState query={query} loadingLabel="Loading your check-ins…" errorTitle="Couldn't load check-ins">
        {(checkins) => {
          const past = checkins.filter((checkin) => checkin.date !== today);
          const items = [
            ...past.map((checkin) => ({ date: checkin.date, checkin })),
            ...missedDays(from, to, user.createdAt, checkins).map((date) => ({
              date,
              checkin: null,
            })),
          ].sort((a, b) => b.date.localeCompare(a.date));

          if (items.length === 0) {
            return <p className="text-text-2">Nothing here yet. Past check-ins will show up here.</p>;
          }
          return (
            <div className="space-y-3">
              {items.map(({ date, checkin }) =>
                checkin ? (
                  <HistoryCard key={date} checkin={checkin} />
                ) : (
                  <MissedCard key={date} date={date} />
                ),
              )}
            </div>
          );
        }}
      </AsyncState>
    </section>
  );
};
