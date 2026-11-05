import { request } from './client';
import {
  Task,
  TaskComment,
  TaskPriority,
  TaskStatus,
  TaskSummary,
} from './types';

export const TASKS_PAGE_SIZE = 50;
export const COMMENTS_PAGE_SIZE = 100;

export type TaskView = 'mine' | 'assigned' | 'unassigned' | 'all';

export interface TaskFilters {
  status?: TaskStatus;
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
  assigneeId?: string;
}

export interface TaskChanges {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  deadline?: string | null;
  assigneeId?: string | null;
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
