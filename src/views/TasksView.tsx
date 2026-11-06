import React, { useState } from 'react';
import { errorMessage } from '../api/client';
import { listTasks, TASKS_PAGE_SIZE, TaskView, TasksPage, updateTaskStatus } from '../api/tasks';
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  Task,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskPriority,
  TaskStatus,
} from '../api/types';
import { TaskListView } from '../components/tasks/TaskListView';
import { AsyncState } from '../components/ui/AsyncState';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { Select } from '../components/ui/Select';
import { Tabs } from '../components/ui/Tabs';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Action } from '../lib/permissions';
import { canChangeStatus } from '../lib/tasks';
import { useApiQuery } from '../lib/useApiQuery';

interface Tab {
  view: TaskView;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
  action?: Action;
}

const TABS: Tab[] = [
  {
    view: 'mine',
    label: 'My tasks',
    emptyTitle: 'No tasks assigned to you',
    emptyDescription: 'Tasks assigned to you will appear here.',
  },
  {
    view: 'assigned',
    label: 'Tasks I assigned',
    emptyTitle: "You haven't assigned any tasks",
    emptyDescription: 'Tasks you assign to other people will appear here.',
    action: 'assignTask',
  },
  {
    view: 'unassigned',
    label: 'Unassigned',
    emptyTitle: 'Nothing unassigned',
    emptyDescription: 'Every task has an owner.',
    action: 'assignTask',
  },
  {
    view: 'all',
    label: 'All tasks',
    emptyTitle: 'No tasks yet',
    emptyDescription: 'Tasks created by the team will appear here.',
    action: 'viewAllTasks',
  },
];

const allOption = (label: string) => ({ value: '', label });

const STATUS_FILTER = [
  allOption('All statuses'),
  ...TASK_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
];

const PRIORITY_FILTER = [
  allOption('All priorities'),
  ...TASK_PRIORITIES.map((value) => ({ value, label: PRIORITY_LABELS[value] })),
];

interface TaskResultsProps {
  tab: Tab;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  overdue: boolean;
  page: number;
  onPageChange: (page: number) => void;
  hasFilters: boolean;
}

const TaskResults: React.FC<TaskResultsProps> = ({
  tab,
  status,
  priority,
  overdue,
  page,
  onPageChange,
  hasFilters,
}) => {
  const { user, can } = useSession();
  const toast = useToast();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const query = useApiQuery<TasksPage>(
    (signal) =>
      listTasks(
        tab.view,
        { status: status || undefined, priority: priority || undefined, overdue, page },
        signal,
      ),
    [tab.view, status, priority, overdue, page],
  );

  const handleStatusChange = async (task: Task, next: TaskStatus) => {
    setBusyTaskId(task.id);
    try {
      await updateTaskStatus(task.id, next);
      toast.success(`Moved to ${STATUS_LABELS[next]}.`);
      query.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <AsyncState
      query={query}
      loadingLabel="Loading tasks…"
      isEmpty={(data) => data.tasks.length === 0}
      empty={
        <EmptyState
          icon="task_alt"
          title={hasFilters ? 'No tasks match these filters' : tab.emptyTitle}
          description={hasFilters ? 'Try changing or clearing the filters.' : tab.emptyDescription}
        />
      }
    >
      {({ tasks, total }) => (
        <div className="card overflow-hidden">
          <TaskListView
            tasks={tasks}
            canChangeStatus={(task) => canChangeStatus(task, user.id, can)}
            onStatusChange={handleStatusChange}
            busyTaskId={busyTaskId}
          />
          <Pagination page={page} pageSize={TASKS_PAGE_SIZE} total={total} onChange={onPageChange} />
        </div>
      )}
    </AsyncState>
  );
};

export const TasksView: React.FC = () => {
  const { can } = useSession();

  const tabs = TABS.filter((tab) => !tab.action || can(tab.action));
  const [view, setView] = useState<TaskView>('mine');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);

  const activeTab = tabs.find((tab) => tab.view === view) ?? tabs[0];

  return (
    <>
      <PageHeader
        title="My Tasks"
        description="Everything on your plate, and what you've handed to others."
      />

      {tabs.length > 1 && (
        <div className="mb-4">
          <Tabs
            label="Task views"
            tabs={tabs.map((tab) => ({ value: tab.view, label: tab.label }))}
            value={activeTab.view}
            onChange={(next) => {
              setView(next);
              setPage(1);
            }}
          />
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:flex sm:items-center">
        <div className="sm:w-44">
          <Select
            label="Filter by status"
            hideLabel
            value={status}
            options={STATUS_FILTER}
            onChange={(e) => {
              setStatus(e.target.value as TaskStatus | '');
              setPage(1);
            }}
          />
        </div>
        <div className="sm:w-44">
          <Select
            label="Filter by priority"
            hideLabel
            value={priority}
            options={PRIORITY_FILTER}
            onChange={(e) => {
              setPriority(e.target.value as TaskPriority | '');
              setPage(1);
            }}
          />
        </div>
        <Chip
          on={overdue}
          onClick={() => {
            setOverdue(!overdue);
            setPage(1);
          }}
        >
          Overdue only
        </Chip>
      </div>

      <TaskResults
        key={activeTab.view}
        tab={activeTab}
        status={status}
        priority={priority}
        overdue={overdue}
        page={page}
        onPageChange={setPage}
        hasFilters={Boolean(status || priority || overdue)}
      />
    </>
  );
};
