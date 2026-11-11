import React, { useState } from 'react';
import { errorMessage } from '../api/client';
import { listAllProjects } from '../api/projects';
import {
  listPresetTasks,
  listTasks,
  TASK_PRESET_LABELS,
  TaskPreset,
  TASKS_PAGE_SIZE,
  TaskView,
  TasksPage,
  updateTaskStatus,
} from '../api/tasks';
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
import { useSearch } from '../lib/router';
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
  preset: TaskPreset | null;
  assigneeId: string | null;
  projectId: string;
  page: number;
  onPageChange: (page: number) => void;
  hasFilters: boolean;
}

const TaskResults: React.FC<TaskResultsProps> = ({
  tab,
  status,
  priority,
  overdue,
  preset,
  assigneeId,
  projectId,
  page,
  onPageChange,
  hasFilters,
}) => {
  const { user, can } = useSession();
  const toast = useToast();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const query = useApiQuery<TasksPage>(
    async (signal) => {
      const filters = {
        priority: priority || undefined,
        assigneeId: assigneeId ?? undefined,
        projectId: projectId || undefined,
        overdue,
      };
      if (!preset) {
        return listTasks(tab.view, { ...filters, status: status || undefined, page }, signal);
      }
      const tasks = await listPresetTasks(tab.view, preset, filters, signal);
      const start = (page - 1) * TASKS_PAGE_SIZE;
      return { tasks: tasks.slice(start, start + TASKS_PAGE_SIZE), total: tasks.length };
    },
    [tab.view, status, priority, overdue, preset, assigneeId, projectId, page],
    'tasks:list',
  );

  const setStatusOnScreen = (taskId: string, status: TaskStatus) =>
    query.mutate((current) => ({
      ...current,
      tasks: current.tasks.map((other) => (other.id === taskId ? { ...other, status } : other)),
    }));

  const handleStatusChange = async (task: Task, next: TaskStatus) => {
    setBusyTaskId(task.id);
    setStatusOnScreen(task.id, next);
    try {
      await updateTaskStatus(task.id, next);
      toast.success(`Moved to ${STATUS_LABELS[next]}.`);
      query.reload();
    } catch (error) {
      setStatusOnScreen(task.id, task.status);
      toast.error(`${errorMessage(error)} It's back to ${STATUS_LABELS[task.status]}.`);
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

interface InitialFilters {
  view: TaskView;
  status: TaskStatus | '';
  overdue: boolean;
  preset: TaskPreset | null;
  assigneeId: string | null;
  assigneeName: string | null;
  projectId: string;
}

/** Numbers around the app link here with their filters in the URL. Anything unknown is ignored. */
function parseFilters(search: string): InitialFilters {
  const params = new URLSearchParams(search);
  const status = params.get('status') as TaskStatus | null;
  const preset = params.get('preset') as TaskPreset | null;
  const view = params.get('view') as TaskView | null;
  return {
    view: TABS.some((tab) => tab.view === view) ? (view as TaskView) : 'mine',
    status: status && TASK_STATUSES.includes(status) ? status : '',
    overdue: params.get('overdue') === 'true',
    preset: preset && preset in TASK_PRESET_LABELS ? preset : null,
    assigneeId: params.get('assignee'),
    assigneeName: params.get('name'),
    projectId: params.get('project') ?? '',
  };
}

const TasksScreen: React.FC<{ initial: InitialFilters }> = ({ initial }) => {
  const { can } = useSession();

  const tabs = TABS.filter((tab) => !tab.action || can(tab.action));
  const [view, setView] = useState<TaskView>(initial.view);
  const [status, setStatus] = useState<TaskStatus | ''>(initial.status);
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [overdue, setOverdue] = useState(initial.overdue);
  const [preset, setPreset] = useState(initial.preset);
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId);
  const [projectId, setProjectId] = useState(initial.projectId);
  const projects = useApiQuery((signal) => listAllProjects(signal), [], 'projects');
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
              setPreset(null);
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
        {(projects.data?.length ?? 0) > 0 && (
          <div className="sm:w-44">
            <Select
              label="Filter by project"
              hideLabel
              value={projectId}
              options={[
                allOption('All projects'),
                ...(projects.data ?? []).map(({ id, name }) => ({ value: id, label: name })),
              ]}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
        <Chip
          on={overdue}
          onClick={() => {
            setOverdue(!overdue);
            setPage(1);
          }}
        >
          Overdue only
        </Chip>
        {preset && (
          <Chip
            on
            onClick={() => {
              setPreset(null);
              setPage(1);
            }}
          >
            {TASK_PRESET_LABELS[preset]}
          </Chip>
        )}
        {assigneeId && (
          <Chip
            on
            onClick={() => {
              setAssigneeId(null);
              setPage(1);
            }}
          >
            {initial.assigneeName ?? 'One person'}
          </Chip>
        )}
      </div>

      <TaskResults
        key={activeTab.view}
        tab={activeTab}
        status={status}
        priority={priority}
        overdue={overdue}
        preset={preset}
        assigneeId={assigneeId}
        projectId={projectId}
        page={page}
        onPageChange={setPage}
        hasFilters={Boolean(status || priority || overdue || preset || assigneeId || projectId)}
      />
    </>
  );
};

export const TasksView: React.FC = () => {
  const search = useSearch();
  return <TasksScreen key={search} initial={parseFilters(search)} />;
};
