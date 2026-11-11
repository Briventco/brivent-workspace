import React, { useState } from 'react';
import { listMeetings, Meeting, MeetingScope } from '../api/meetings';
import { listOpenTasks } from '../api/tasks';
import { DayAgenda, DayStrip } from '../components/meetings/DayAgenda';
import { dayOf } from '../components/meetings/meetingHelpers';
import { MeetingFormPanel } from '../components/meetings/MeetingFormPanel';
import { MeetingPanel } from '../components/meetings/MeetingPanel';
import { WeekGrid } from '../components/meetings/WeekGrid';
import { ErrorState } from '../components/ui/AsyncState';
import { Button, IconButton } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonList } from '../components/ui/Skeleton';
import { SegmentedControl } from '../components/ui/Tabs';
import { useSession } from '../context/AuthContext';
import { navigate, useSearch } from '../lib/router';
import { useApiQuery } from '../lib/useApiQuery';
import { useMediaQuery } from '../lib/useMediaQuery';
import {
  addDays,
  formatDayRange,
  formatLongDate,
  isWeekend,
  watDate,
  watDayStart,
  weekStart,
} from '../lib/wat';

type Mode = 'week' | 'day';

const WEEK_DAYS = 7;
const PHONE = '(max-width: 767px)';

const shift = (date: string, days: number) => watDate(addDays(watDayStart(date), days));

/** Monday to Friday, plus a weekend day only if something is on or it's the day being viewed. */
function visibleDays(date: string, meetings: Meeting[]): string[] {
  const monday = watDate(weekStart(watDayStart(date)));
  return Array.from({ length: WEEK_DAYS }, (_, index) => shift(monday, index)).filter(
    (day) =>
      !isWeekend(watDayStart(day)) ||
      day === date ||
      meetings.some((meeting) => dayOf(meeting) === day),
  );
}

export const CalendarView: React.FC = () => {
  const { can } = useSession();
  const isPhone = useMediaQuery(PHONE);
  const search = useSearch();
  const selectedId = new URLSearchParams(search).get('meeting');

  const [date, setDate] = useState(watDate());
  const [mode, setMode] = useState<Mode>('week');
  const [scope, setScope] = useState<MeetingScope>('mine');
  const [showDeadlines, setShowDeadlines] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);

  const monday = watDate(weekStart(watDayStart(date)));
  const sunday = shift(monday, WEEK_DAYS - 1);

  const query = useApiQuery(
    (signal) => listMeetings(monday, sunday, scope, signal),
    [monday, sunday, scope],
    'meetings:week',
  );
  const deadlines = useApiQuery(
    async (signal) => {
      if (!showDeadlines) return [];
      const tasks = await listOpenTasks(
        'mine',
        {
          dueAfter: watDayStart(monday).toISOString(),
          dueBefore: addDays(watDayStart(sunday), 1).toISOString(),
        },
        signal,
      );
      return tasks.filter((task) => task.deadline);
    },
    [showDeadlines, monday, sunday],
  );

  const meetings = query.data ?? [];
  const days = visibleDays(date, meetings);
  const isDayView = mode === 'day' && !isPhone;
  const gridDays = isDayView ? [date] : days;
  const step = isDayView ? 1 : WEEK_DAYS;

  const open = (meeting: Meeting) => navigate(`/calendar?meeting=${meeting.id}`, { replace: true });
  const close = () => navigate('/calendar', { replace: true });

  const dayChoice = (
    <SegmentedControl<Mode>
      label="Calendar view"
      options={[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
      ]}
      value={mode}
      onChange={setMode}
    />
  );

  const scopeChoice = (
    <>
      <Chip on={scope === 'mine'} onClick={() => setScope('mine')}>
        My meetings
      </Chip>
      <Chip on={scope === 'team'} onClick={() => setScope('team')}>
        Whole team
      </Chip>
    </>
  );

  return (
    <>
      <PageHeader
        title="Meetings and schedule"
        description="Your week at a glance. All times are Lagos time (WAT)."
        actions={
          can('createMeeting') && (
            <Button icon="add" onClick={() => setIsCreating(true)}>
              New meeting
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setDate(watDate())}>
          Today
        </Button>
        <IconButton
          icon="chevron_left"
          variant="secondary"
          label={isDayView ? 'Previous day' : 'Previous week'}
          onClick={() => setDate(shift(date, -step))}
        />
        <IconButton
          icon="chevron_right"
          variant="secondary"
          label={isDayView ? 'Next day' : 'Next week'}
          onClick={() => setDate(shift(date, step))}
        />
        <h2 className="t-h3 ml-1" aria-live="polite">
          {isDayView
            ? formatLongDate(watDayStart(date))
            : formatDayRange(watDayStart(days[0]), watDayStart(days[days.length - 1]))}
        </h2>
        <div className="hidden md:flex items-center gap-2 ml-auto flex-wrap">
          {dayChoice}
          {scopeChoice}
          <Chip on={showDeadlines} onClick={() => setShowDeadlines(!showDeadlines)}>
            Show task deadlines
          </Chip>
        </div>
      </div>

      {isPhone && (
        <>
          <div className="mb-3 flex gap-2">{scopeChoice}</div>
          <DayStrip days={days} value={date} meetings={meetings} onChange={setDate} />
        </>
      )}

      {query.error ? (
        <ErrorState
          title="Couldn't load meetings"
          message="We couldn't reach the server. Try again in a moment."
          onRetry={query.reload}
        />
      ) : !query.data ? (
        <SkeletonList label="Loading meetings…" />
      ) : isPhone ? (
        <DayAgenda date={date} meetings={meetings} selectedId={selectedId} onSelect={open} />
      ) : (
        <>
          <WeekGrid
            days={gridDays}
            meetings={meetings}
            deadlines={deadlines.data ?? []}
            selectedId={selectedId}
            onSelect={open}
          />
          {meetings.length === 0 && (
            <p className="mt-3 text-text-2">
              {scope === 'mine'
                ? 'Nothing scheduled for you this week. Try Whole team to see everyone’s meetings.'
                : 'Nothing scheduled this week.'}
            </p>
          )}
        </>
      )}

      {selectedId && !editing && (
        <MeetingPanel
          key={selectedId}
          meetingId={selectedId}
          onClose={close}
          onEdit={setEditing}
          onChanged={query.reload}
        />
      )}

      {editing && (
        <MeetingFormPanel
          meeting={editing}
          date={date}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            query.reload();
          }}
        />
      )}

      {isCreating && (
        <MeetingFormPanel
          date={date}
          onClose={() => setIsCreating(false)}
          onSaved={(meeting) => {
            setIsCreating(false);
            setDate(dayOf(meeting));
            query.reload();
            open(meeting);
          }}
        />
      )}
    </>
  );
};
