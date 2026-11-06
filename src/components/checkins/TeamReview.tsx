import React, { useState } from 'react';
import {
  getTeamCheckins,
  postCheckinReply,
  setBlockerHandled,
  TeamCheckins,
} from '../../api/checkins';
import { ApiError, errorMessage } from '../../api/client';
import { Checkin, CheckinPerson } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { personTitle } from '../../lib/people';
import { useApiQuery } from '../../lib/useApiQuery';
import {
  addDays,
  formatShortDate,
  formatTime,
  isWeekend,
  watDate,
  watDayStart,
} from '../../lib/wat';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { ErrorState, NoAccess } from '../ui/AsyncState';
import { Avatar } from '../ui/Avatar';
import { Button, IconButton } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { SkeletonList } from '../ui/Skeleton';
import { Textarea } from '../ui/Textarea';
import { Answer, BlockerBox, LateTag, LinkedTasks, Replies } from './CheckinParts';

type Filter = 'all' | 'blockers' | 'missing';

const TITLE_LENGTH = 120;

const taskTitle = (blocker: string) => {
  const line = blocker.trim().split('\n')[0];
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : line;
};

const ReplyForm: React.FC<{ checkin: Checkin; onClose: () => void; onSent: () => void }> = ({
  checkin,
  onClose,
  onSent,
}) => {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setIsSending(true);
    try {
      await postCheckinReply(checkin.id, body.trim());
      onSent();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        label={`Reply to ${checkin.user.name}`}
        hideLabel
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        rows={2}
        autoFocus
        placeholder="Write a reply"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" isLoading={isSending}>
          Send reply
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSending}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

const BlockerCard: React.FC<{ checkin: Checkin; onChanged: () => void }> = ({
  checkin,
  onChanged,
}) => {
  const { user, can } = useSession();
  const toast = useToast();
  const [isReplying, setIsReplying] = useState(false);
  const [isMakingTask, setIsMakingTask] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const handled = checkin.blockerHandled;
  const canReview = can('reviewCheckins');

  const toggleHandled = async () => {
    setIsBusy(true);
    try {
      await setBlockerHandled(checkin.id, !handled);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <article className={`card flex flex-col ${handled ? '' : 'attn'}`}>
      <div className="p-4 pb-0 flex items-center gap-3">
        <Avatar name={checkin.user.name} id={checkin.user.id} />
        <div className="min-w-0 grow">
          <p className="font-semibold truncate">{checkin.user.name}</p>
          <p className="text-small text-text-2">
            {personTitle(checkin.user)} · {formatTime(new Date(checkin.submittedAt))}
          </p>
        </div>
        {checkin.isLate && <LateTag />}
        {handled && (
          <span className="badge st-done">
            <Icon name="check_circle" size="sm" filled />
            Handled
          </span>
        )}
      </div>
      <div className="p-4 space-y-3 grow">
        <BlockerBox checkin={checkin} />
        <Replies replies={checkin.replies} youId={user.id} />
        <Answer label="Finished yesterday">{checkin.workCompleted}</Answer>
        <Answer label="Today">{checkin.priorities}</Answer>
        <LinkedTasks checkin={checkin} />
      </div>
      {canReview && (
        <div className="card-foot">
          {isReplying ? (
            <ReplyForm checkin={checkin} onClose={() => setIsReplying(false)} onSent={onChanged} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={handled ? 'secondary' : 'primary'}
                onClick={() => setIsReplying(true)}
              >
                Reply
              </Button>
              {!handled && can('createTask') && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon="add_task"
                  className="make-task"
                  onClick={() => setIsMakingTask(true)}
                >
                  Make a task
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                isLoading={isBusy}
                onClick={toggleHandled}
                className="ml-auto"
              >
                {handled ? 'Reopen' : 'Mark handled'}
              </Button>
            </div>
          )}
        </div>
      )}
      {isMakingTask && (
        <TaskFormModal
          prefill={{
            title: taskTitle(checkin.blockers ?? ''),
            description: `Blocker from ${checkin.user.name}'s check-in on ${formatShortDate(
              watDayStart(checkin.date),
            )}:\n\n${checkin.blockers}`,
          }}
          onClose={() => setIsMakingTask(false)}
          onSaved={() => setIsMakingTask(false)}
        />
      )}
    </article>
  );
};

const SubmittedRow: React.FC<{ checkin: Checkin; onChanged: () => void }> = ({
  checkin,
  onChanged,
}) => {
  const { user, can } = useSession();
  const [isReplying, setIsReplying] = useState(false);
  const isYou = checkin.user.id === user.id;

  return (
    <li className="flex gap-3 p-4 sm:px-5">
      <Avatar name={checkin.user.name} id={checkin.user.id} size="sm" />
      <div className="min-w-0 grow space-y-1.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            {checkin.user.name}
            {isYou && ' (you)'}
          </span>
          <span className="text-small text-text-2">{personTitle(checkin.user)}</span>
          <span className="text-small text-text-2">
            {formatTime(new Date(checkin.submittedAt))}
          </span>
          {checkin.isLate && <LateTag />}
        </p>
        <p className="break-words">
          <span className="text-text-2">Finished:</span> {checkin.workCompleted}{' '}
          <span className="text-text-2">Today:</span> {checkin.priorities}
        </p>
        <LinkedTasks checkin={checkin} />
        <Replies replies={checkin.replies} youId={user.id} />
        {can('reviewCheckins') &&
          !isYou &&
          (isReplying ? (
            <ReplyForm checkin={checkin} onClose={() => setIsReplying(false)} onSent={onChanged} />
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setIsReplying(true)}>
              Reply
            </Button>
          ))}
      </div>
    </li>
  );
};

const MissingCard: React.FC<{ people: CheckinPerson[] }> = ({ people }) => (
  <Card>
    <CardHeader>
      <h2 className="t-h3">Not submitted · {people.length}</h2>
    </CardHeader>
    {people.length === 0 ? (
      <p className="card-pad text-text-2">Everyone has checked in.</p>
    ) : (
      <ul className="divide-y divide-border">
        {people.map((person) => (
          <li key={person.id} className="li">
            <Avatar name={person.name} id={person.id} size="sm" />
            <span className="min-w-0 grow title truncate">{person.name}</span>
            <span className="text-small text-text-2 truncate">{personTitle(person)}</span>
          </li>
        ))}
      </ul>
    )}
  </Card>
);

const Results: React.FC<{ data: TeamCheckins; filter: Filter; date: string; reload: () => void }> = ({
  data,
  filter,
  date,
  reload,
}) => {
  const withBlockers = data.checkins
    .filter((checkin) => checkin.blockers)
    .sort((a, b) => Number(a.blockerHandled) - Number(b.blockerHandled));
  const clear = data.checkins.filter((checkin) => !checkin.blockers);
  const showMissing = !isWeekend(watDayStart(date));
  const isToday = date === watDate();

  if (data.checkins.length === 0 && filter !== 'missing') {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <EmptyState
          icon="edit_note"
          title={isToday ? 'No check-ins yet today' : 'No check-ins that day'}
          description={
            isToday
              ? "Most people check in by 11:00 AM. They'll appear here as they come in."
              : 'Pick another day to see what the team shared.'
          }
        />
        {showMissing && <MissingCard people={data.notCheckedIn} />}
      </div>
    );
  }

  if (filter === 'missing') return <MissingCard people={showMissing ? data.notCheckedIn : []} />;

  const blockers = withBlockers.length > 0 && (
    <section>
      <h2 className="t-h3 mb-3 flex items-center gap-2 text-danger">
        <Icon name="flag" size="sm" />
        Blockers raised {isToday ? 'today' : 'that day'} · {withBlockers.length}
      </h2>
      <div className="blocker-grid">
        {withBlockers.map((checkin) => (
          <BlockerCard key={checkin.id} checkin={checkin} onChanged={reload} />
        ))}
      </div>
    </section>
  );

  if (filter === 'blockers') {
    return (
      blockers || (
        <EmptyState
          icon="task_alt"
          title="No blockers"
          description="Nobody raised anything on this day."
        />
      )
    );
  }

  return (
    <div className="space-y-6">
      {blockers}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <Card>
          <CardHeader>
            <h2 className="t-h3">Submitted, no blockers · {clear.length}</h2>
          </CardHeader>
          {clear.length === 0 ? (
            <p className="card-pad text-text-2">Everyone who checked in raised a blocker.</p>
          ) : (
            <ul className="divide-y divide-border">
              {clear.map((checkin) => (
                <SubmittedRow key={checkin.id} checkin={checkin} onChanged={reload} />
              ))}
            </ul>
          )}
        </Card>
        {showMissing && <MissingCard people={data.notCheckedIn} />}
      </div>
    </div>
  );
};

export const TeamReview: React.FC = () => {
  const today = watDate();
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>('all');
  const query = useApiQuery((signal) => getTeamCheckins({ date }, signal), [date]);

  const shift = (days: number) => setDate(watDate(addDays(watDayStart(date), days)));
  const { data, error } = query;
  const blockerCount = data?.checkins.filter((checkin) => checkin.blockers).length ?? 0;
  const dateLabel = formatShortDate(watDayStart(date)).replace(',', '');

  const filters: { value: Filter; label: string; phoneLabel: string; count: number }[] = [
    {
      value: 'all',
      label: 'All',
      phoneLabel: 'All',
      count: (data?.checkins.length ?? 0) + (data?.notCheckedIn.length ?? 0),
    },
    { value: 'blockers', label: 'With blockers', phoneLabel: 'Blockers', count: blockerCount },
    {
      value: 'missing',
      label: 'Not submitted',
      phoneLabel: 'Missing',
      count: data?.notCheckedIn.length ?? 0,
    },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon="chevron_left" label="Previous day" onClick={() => shift(-1)} />
          <span className="chip font-semibold text-text">
            <Icon name="calendar_today" size="sm" />
            {date === today ? `Today, ${dateLabel}` : dateLabel}
          </span>
          {date < today && (
            <IconButton icon="chevron_right" label="Next day" onClick={() => shift(1)} />
          )}
        </div>
        <div className="flex gap-2 max-w-full overflow-x-auto">
          {filters.map(({ value, label, phoneLabel, count }) => (
            <Chip key={value} on={filter === value} onClick={() => setFilter(value)}>
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{phoneLabel}</span> · {count}
            </Chip>
          ))}
        </div>
      </div>

      {error instanceof ApiError && error.isForbidden ? (
        <NoAccess />
      ) : error ? (
        <ErrorState
          title="Couldn't load check-ins"
          message="We couldn't reach the server. Try again in a moment."
          onRetry={query.reload}
        />
      ) : data ? (
        <Results data={data} filter={filter} date={date} reload={query.reload} />
      ) : (
        <SkeletonList label="Loading check-ins…" />
      )}
    </>
  );
};
