import { request } from './client';
import {
  Task,
  TaskComment,
  TaskPriority,
  TaskStatus,
  TaskSummary,
} from './types';
import { addDays, watDate, watDayStart, weekStart } from '../lib/wat';

export const TASKS_PAGE_SIZE = 50;
export const COMMENTS_PAGE_SIZE = 100;

export type TaskView = 'mine' | 'assigned' | 'unassigned' | 'all';

export interface TaskFilters {
  status?: TaskStatus;
  assigneeId?: string;
  projectId?: string;
  priority?: TaskPriority;
  overdue?: boolean;
  dueAfter?: string;
  dueBefore?: string;
  sortBy?: 'createdAt' | 'deadline';
  page?: number;
  limit?: number;
}

export interface TasksPage {
  tasks: Task[];
  total: number;
}

export interface NewTask {
  title: string;
  description: string;
  priority: TaskPriority;
  deadline?: string;
  assigneeIds?: string[];
  projectId?: string;
}

export interface TaskChanges {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  deadline?: string | null;
  assigneeIds?: string[];
  projectId?: string | null;
}

const VIEW_PATHS: Record<TaskView, string> = {
  mine: '/tasks/mine',
  assigned: '/tasks?assignedBy=me',
  unassigned: '/tasks?unassigned=true',
  all: '/tasks',
};

export async function listTasks(
  view: TaskView,
  filters: TaskFilters,
  signal?: AbortSignal,
): Promise<TasksPage> {
  const { overdue, ...rest } = filters;
  const params = new URLSearchParams({ limit: String(TASKS_PAGE_SIZE) });
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) params.set(key, String(value));
  }
  // `true` is the only value the API accepts for this filter.
  if (overdue) params.set('overdue', 'true');

  const path = VIEW_PATHS[view];
  return request(`${path}${path.includes('?') ? '&' : '?'}${params}`, { signal });
}

const MAX_LIMIT = 100;

/** Every page of a list, for totals the API doesn't give directly. */
export async function listEveryTask(
  view: TaskView,
  filters: TaskFilters,
  signal?: AbortSignal,
): Promise<Task[]> {
  const tasks: Task[] = [];
  for (let page = 1; ; page += 1) {
    const data = await listTasks(view, { ...filters, page, limit: MAX_LIMIT }, signal);
    tasks.push(...data.tasks);
    if (data.tasks.length === 0 || tasks.length >= data.total) return tasks;
  }
}

/** The API can't exclude a status, so "open" is everything in the three unfinished ones. */
export async function listOpenTasks(
  view: TaskView,
  filters: TaskFilters = {},
  signal?: AbortSignal,
): Promise<Task[]> {
  const lists = await Promise.all(
    (['TODO', 'IN_PROGRESS', 'BLOCKED'] as const).map((status) =>
      listEveryTask(view, { ...filters, status }, signal),
    ),
  );
  return lists.flat();
}

export type TaskPreset = 'open' | 'dueToday' | 'doneThisWeek';

export const TASK_PRESET_LABELS: Record<TaskPreset, string> = {
  open: 'Open',
  dueToday: 'Due today',
  doneThisWeek: 'Done this week',
};

const byDeadline = (a: Task, b: Task) =>
  (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');

/** Lists the dashboard's numbers link to, which no single API query can return. */
export async function listPresetTasks(
  view: TaskView,
  preset: TaskPreset,
  filters: TaskFilters,
  signal?: AbortSignal,
): Promise<Task[]> {
  if (preset === 'doneThisWeek') {
    const since = weekStart().toISOString();
    const done = await listEveryTask(view, { ...filters, status: 'DONE' }, signal);
    return done.filter((task) => task.completedAt && task.completedAt >= since);
  }

  const today = watDayStart(watDate());
  const window =
    preset === 'dueToday'
      ? { dueAfter: today.toISOString(), dueBefore: addDays(today, 1).toISOString() }
      : {};
  const tasks = await listOpenTasks(view, { ...filters, ...window }, signal);
  return tasks.sort(byDeadline);
}

export async function getTaskSummary(signal?: AbortSignal): Promise<TaskSummary> {
  const data = await request<{ summary: TaskSummary }>('/tasks/summary', { signal });
  return data.summary;
}

export async function getTask(id: string, signal?: AbortSignal): Promise<Task> {
  const data = await request<{ task: Task }>(`/tasks/${id}`, { signal });
  return data.task;
}

export async function createTask(task: NewTask): Promise<Task> {
  const data = await request<{ task: Task }>('/tasks', { method: 'POST', body: task });
  return data.task;
}

export async function updateTask(id: string, changes: TaskChanges): Promise<Task> {
  const data = await request<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: changes });
  return data.task;
}

/** Replaces the whole set, so send everyone who should stay. An empty list unassigns everyone. */
export async function setTaskAssignees(id: string, assigneeIds: string[]): Promise<Task> {
  const data = await request<{ task: Task }>(`/tasks/${id}/assignees`, {
    method: 'PUT',
    body: { assigneeIds },
  });
  return data.task;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const data = await request<{ task: Task }>(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
  return data.task;
}

export async function deleteTask(id: string): Promise<void> {
  await request<null>(`/tasks/${id}`, { method: 'DELETE' });
}

/** Loads every comment page up to `pages`, oldest first. */
export async function listComments(
  taskId: string,
  pages: number,
  signal?: AbortSignal,
): Promise<{ comments: TaskComment[]; total: number }> {
  const results = await Promise.all(
    Array.from({ length: pages }, (_, index) =>
      request<{ comments: TaskComment[]; total: number }>(
        `/tasks/${taskId}/comments?page=${index + 1}&limit=${COMMENTS_PAGE_SIZE}`,
        { signal },
      ),
    ),
  );
  return { comments: results.flatMap((r) => r.comments), total: results[0].total };
}

export async function addComment(taskId: string, body: string): Promise<TaskComment> {
  const data = await request<{ comment: TaskComment }>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: { body },
  });
  return data.comment;
}
