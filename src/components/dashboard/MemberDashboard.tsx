import React from 'react';
import { listOpenTasks } from '../../api/tasks';
import { Task, TaskSummary } from '../../api/types';
import { Link } from '../../lib/router';
import { useApiQuery } from '../../lib/useApiQuery';
import { addDays, formatTime } from '../../lib/wat';
import { AsyncState } from '../ui/AsyncState';
import { Card, CardHeader, StatCard } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { CheckInCard } from './CheckInCard';
import { DashboardGreeting } from './DashboardGreeting';
import { MeetingsCard } from './MeetingsCard';
import { isDueToday, TaskRow } from './TaskRow';
import { LearningCard } from './LearningCard';
import { UnreadMessagesLink } from './UnreadMessagesLink';

const MAX_ROWS = 5;

const byDeadline = (a: Task, b: Task) =>
  (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');

/** Overdue first, then blocked, then due today: the order someone should act in. */
const urgency = (task: Task) => {
  if (task.isOverdue) return 0;
  return task.status === 'BLOCKED' ? 1 : 2;
};

function sortTasks(tasks: Task[]) {
  const needsAttention = tasks.filter(
    (task) => task.isOverdue || task.status === 'BLOCKED' || isDueToday(task),
  );
  needsAttention.sort((a, b) => urgency(a) - urgency(b) || byDeadline(a, b));

  const weekAhead = addDays(new Date(), 7).toISOString();
  const comingUp = tasks
    .filter((task) => !needsAttention.includes(task) && task.deadline && task.deadline <= weekAhead)
    .sort(byDeadline);

  return { needsAttention, comingUp, dueToday: tasks.filter(isDueToday) };
}

const TaskCard: React.FC<{
  title: string;
  count?: number;
  action: React.ReactNode;
  tasks: Task[];
}> = ({ title, count, action, tasks }) => (
  <Card>
    <CardHeader>
      <h2 className="t-h3 flex items-center gap-2">
        {title}
        {count !== undefined && <span className="count">{count}</span>}
      </h2>
      {action}
    </CardHeader>
    <ul className="divide-y divide-border">
      {tasks.slice(0, MAX_ROWS).map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </ul>
  </Card>
);

const Sentence: React.FC<{ overdue: number; dueToday: number }> = ({ overdue, dueToday }) => {
  if (overdue === 0 && dueToday === 0) return <>Nothing overdue or due today.</>;
  return (
    <>
      You have{' '}
      <Link to="/tasks?overdue=true" className="font-semibold text-danger">
        {overdue} overdue {overdue === 1 ? 'task' : 'tasks'}
      </Link>{' '}
      and{' '}
      <Link to="/tasks?preset=dueToday" className="font-semibold text-text">
        {dueToday} due today
      </Link>
      .
    </>
  );
};

export const MemberDashboard: React.FC<{ summary: TaskSummary }> = ({ summary }) => {
  const query = useApiQuery((signal) => listOpenTasks('mine', {}, signal), []);
  const { needsAttention, comingUp, dueToday } = sortTasks(query.data ?? []);
  const canCheckIn = summary.checkedInToday === false;

  const latestToday = dueToday.reduce((latest, task) => {
    return task.deadline! > latest ? task.deadline! : latest;
  }, '');

  const hasMeetings = summary.upcomingMeetings !== undefined;
  const isEmpty = summary.open === 0 && summary.doneThisWeek === 0;

  return (
    <>
      <DashboardGreeting>
        {query.data && <Sentence overdue={summary.overdue} dueToday={dueToday.length} />}
      </DashboardGreeting>

      <CheckInCard checkedIn={summary.checkedInToday} />

      <UnreadMessagesLink summary={summary} />
      <LearningCard summary={summary} />

      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 mb-5">
        <StatCard
          label="Open"
          icon="radio_button_unchecked"
          value={summary.open}
          hint="Assigned to you"
          to="/tasks?preset=open"
        />
        <StatCard
          label="Overdue"
          icon="schedule"
          value={summary.overdue}
          hint="Past its deadline"
          attention={summary.overdue > 0}
          to="/tasks?overdue=true"
        />
        <StatCard
          label="Due today"
          icon="today"
          value={query.data ? dueToday.length : '–'}
          hint={latestToday ? `By ${formatTime(new Date(latestToday))}` : 'Nothing due'}
          to="/tasks?preset=dueToday"
          className="hidden md:flex"
        />
        <StatCard
          label="Done this week"
          phoneLabel="Done/week"
          icon="check_circle"
          value={summary.doneThisWeek}
          hint="Since Monday"
          to="/tasks?preset=doneThisWeek"
        />
      </div>

      {isEmpty ? (
        <EmptyState
          icon="wb_sunny"
          title="Nothing on your plate yet"
          description={
            canCheckIn
              ? "When work is assigned to you it shows up here. Start with today's check-in."
              : 'When work is assigned to you it shows up here.'
          }
        >
          {canCheckIn && (
            <Link to="/daily" className="btn btn-primary">
              Check in
            </Link>
          )}
        </EmptyState>
      ) : (
        <div
          className={`grid gap-5 items-start ${hasMeetings ? 'xl:grid-cols-[minmax(0,1fr)_300px]' : ''}`}
        >
          <div className="space-y-5 min-w-0">
            <AsyncState query={query} loadingLabel="Loading your tasks…" errorTitle="Couldn't load tasks">
              {() => (
                <>
                  {needsAttention.length > 0 ? (
                    <TaskCard
                      title="Needs your attention"
                      count={needsAttention.length}
                      tasks={needsAttention}
                      action={
                        <Link to="/tasks" className="font-semibold">
                          All my tasks
                        </Link>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon="task_alt"
                      title="You're all caught up"
                      description="Nothing overdue, blocked or due today."
                    />
                  )}
                  {comingUp.length > 0 && (
                    <TaskCard
                      title="Coming up this week"
                      tasks={comingUp}
                      action={<span className="text-small text-text-2">Next 7 days</span>}
                    />
                  )}
                </>
              )}
            </AsyncState>
          </div>
          {hasMeetings && (
            <div className="min-w-0">
              <MeetingsCard />
            </div>
          )}
        </div>
      )}
    </>
  );
};
