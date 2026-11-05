import React, { useState } from 'react';
import { CheckSquare, Plus } from 'lucide-react';
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
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { TaskListView } from '../components/tasks/TaskListView';
import { AsyncState } from '../components/ui/AsyncState';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { Select } from '../components/ui/Select';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PERMISSIONS } from '../lib/permissions';
import { navigate } from '../lib/router';
import { canChangeStatus } from '../lib/tasks';
import { useApiQuery } from '../lib/useApiQuery';

interface Tab {
  view: TaskView;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
  permission?: string;
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
    permission: PERMISSIONS.TASKS_ASSIGN,
  },
  {
    view: 'unassigned',
    label: 'Unassigned',
    emptyTitle: 'Nothing unassigned',
    emptyDescription: 'Every task has an owner.',
    permission: PERMISSIONS.TASKS_ASSIGN,
  },
  {
    view: 'all',
    label: 'All tasks',
    emptyTitle: 'No tasks yet',
    emptyDescription: 'Tasks created by the team will appear here.',
    permission: PERMISSIONS.TASKS_VIEW_ALL,
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
  const { user, hasPermission } = useSession();
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
          icon={<CheckSquare className="w-6 h-6" aria-hidden="true" />}
          title={hasFilters ? 'No tasks match these filters' : tab.emptyTitle}
          description={hasFilters ? 'Try changing or clearing the filters.' : tab.emptyDescription}
        />
      }
    >
      {({ tasks, total }) => (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <TaskListView
            tasks={tasks}
            canChangeStatus={(task) => canChangeStatus(task, user.id, hasPermission)}
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
  const { hasPermission } = useSession();

  const tabs = TABS.filter((tab) => !tab.permission || hasPermission(tab.permission));
  const [view, setView] = useState<TaskView>('mine');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  const activeTab = tabs.find((tab) => tab.view === view) ?? tabs[0];

  return (
    <>
      <PageHeader
        title="My Tasks"
        description="Everything on your plate, and what you've handed to others."
        actions={
          hasPermission(PERMISSIONS.TASKS_CREATE) && (
            <Button
              onClick={() => setIsCreating(true)}
              leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
            >
              New task
            </Button>
          )
        }
      />

      {tabs.length > 1 && (
        <div role="group" aria-label="Task views" className="mb-4 flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.view}
              type="button"
              aria-pressed={tab.view === activeTab.view}
              onClick={() => {
                setView(tab.view);
                setPage(1);
              }}
              className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab.view === activeTab.view
                  ? 'bg-brivent-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked);
              setPage(1);
            }}
            className="w-4 h-4 rounded border-slate-300"
          />
          Overdue only
        </label>
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

      {isCreating && (
        <TaskFormModal
          onClose={() => setIsCreating(false)}
          onSaved={(task) => navigate(`/tasks/${task.id}`)}
        />
      )}
    </>
  );
};
