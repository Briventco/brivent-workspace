import React, { useMemo, useState } from 'react';
import { getTaskSummary, listTasks, TasksPage } from '../api/tasks';
import { Task, TaskSummary } from '../api/types';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { AsyncState } from '../components/ui/AsyncState';
import { Button } from '../components/ui/Button';
import { PriorityBadge } from '../components/ui/badges';
import { Card, CardBody, CardHeader, StatCard } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { useSession } from '../context/AuthContext';
import { Link, navigate } from '../lib/router';
import { formatDateTime } from '../lib/tasks';
import { ApiQuery, useApiQuery } from '../lib/useApiQuery';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const StatCards: React.FC<{ stats: { label: string; value: number; alert?: boolean }[] }> = ({
  stats,
}) => (
  <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
    {stats.map(({ label, value, alert }) => (
      <StatCard key={label} label={label} value={value} attention={alert && value > 0} />
    ))}
  </div>
);

const SummarySection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="mb-6">
    <h2 className="mb-3 t-h2">{title}</h2>
    {children}
  </section>
);

interface MyCounts {
  open: number;
  overdue: number;
}

/** The summary endpoint only gives managers team counts, so their own come from the list. */
async function getMyCounts(signal: AbortSignal): Promise<MyCounts> {
  const [all, done, overdue] = await Promise.all([
    listTasks('mine', { limit: 1 }, signal),
    listTasks('mine', { status: 'DONE', limit: 1 }, signal),
    listTasks('mine', { overdue: true, limit: 1 }, signal),
  ]);
  return { open: all.total - done.total, overdue: overdue.total };
}

const ManagerCounts: React.FC = () => {
  const query = useApiQuery<MyCounts>(getMyCounts, []);
  return (
    <SummarySection title="My work">
      <AsyncState query={query} loadingLabel="Loading your counts…">
        {({ open, overdue }) => (
          <StatCards
            stats={[
              { label: 'Open', value: open },
              { label: 'Overdue', value: overdue, alert: true },
            ]}
          />
        )}
      </AsyncState>
    </SummarySection>
  );
};

const TaskLinks: React.FC<{ tasks: Task[] }> = ({ tasks }) => (
  <ul className="divide-y divide-border">
    {tasks.map((task) => (
      <li key={task.id} className="px-5 py-3">
        <Link
          to={`/tasks/${task.id}`}
          className="block font-semibold text-text break-words rounded"
        >
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-small text-text-2">
          <PriorityBadge priority={task.priority} />
          {task.deadline && <span>{formatDateTime(task.deadline)}</span>}
        </div>
      </li>
    ))}
  </ul>
);

const TaskPanel: React.FC<{
  title: string;
  emptyText: string;
  icon: React.ReactNode;
  query: ApiQuery<TasksPage>;
}> = ({ title, emptyText, icon, query }) => (
  <Card>
    <CardHeader>
      <h2 className="flex items-center gap-2 t-h2">
        {icon}
        {title}
      </h2>
    </CardHeader>
    <AsyncState
      query={query}
      loadingLabel="Loading tasks…"
      isEmpty={(data) => data.tasks.length === 0}
      empty={<CardBody className="text-text-2">{emptyText}</CardBody>}
    >
      {({ tasks }) => <TaskLinks tasks={tasks} />}
    </AsyncState>
  </Card>
);

const TaskDashboard: React.FC = () => {
  const { can } = useSession();
  const isManager = can('viewAllTasks');

  const summary = useApiQuery<TaskSummary>(getTaskSummary, []);

  // Fixed for the life of the page, so the list query doesn't re-run on every render.
  const dueWindow = useMemo(() => {
    const now = Date.now();
    return {
      dueAfter: new Date(now).toISOString(),
      dueBefore: new Date(now + WEEK_MS).toISOString(),
    };
  }, []);

  const dueSoon = useApiQuery<TasksPage>(async (signal) => {
    const page = await listTasks('mine', { ...dueWindow, sortBy: 'deadline', limit: 100 }, signal);
    // The API can't exclude a status, and finished work isn't due.
    const tasks = page.tasks.filter((task) => task.status !== 'DONE');
    return { tasks, total: tasks.length };
  }, []);

  const overdue = useApiQuery<TasksPage>(
    (signal) => listTasks('mine', { overdue: true, sortBy: 'deadline', limit: 100 }, signal),
    [],
  );

  return (
    <>
      {isManager && <ManagerCounts />}

      <SummarySection title={isManager ? 'Team-wide' : 'My work'}>
        <AsyncState query={summary} loadingLabel="Loading your summary…">
          {({ open, overdue: overdueCount, doneThisWeek }) => (
            <StatCards
              stats={[
                { label: 'Open', value: open },
                { label: 'Overdue', value: overdueCount, alert: true },
                { label: 'Done this week', value: doneThisWeek },
              ]}
            />
          )}
        </AsyncState>
      </SummarySection>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <TaskPanel
          title="My tasks due soon"
          emptyText="Nothing due in the next 7 days."
          icon={<Icon name="today" className="text-brand" />}
          query={dueSoon}
        />
        <TaskPanel
          title="Overdue"
          emptyText="You're all caught up."
          icon={<Icon name="schedule" className="text-danger" />}
          query={overdue}
        />
      </div>
    </>
  );
};

export const DashboardView: React.FC = () => {
  const { user, can } = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const firstName = user.fullName.trim().split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName}`}
        actions={
          can('createTask') && (
            <Button icon="add" onClick={() => setIsCreating(true)}>
              New task
            </Button>
          )
        }
      />

      {can('viewOwnTasks') && <TaskDashboard />}

      {isCreating && (
        <TaskFormModal
          onClose={() => setIsCreating(false)}
          onSaved={(task) => navigate(`/tasks/${task.id}`)}
        />
      )}
    </>
  );
};
