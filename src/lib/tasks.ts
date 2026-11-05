import { format } from 'date-fns';
import { Task } from '../api/types';
import { PERMISSIONS } from './permissions';

type HasPermission = (permission: string) => boolean;

/** Mirrors the backend's rules, so nobody is offered a control that would be refused. */
export function canChangeStatus(task: Task, userId: string, has: HasPermission): boolean {
  if (has(PERMISSIONS.TASKS_EDIT_ALL)) return true;
  return has(PERMISSIONS.TASKS_UPDATE_OWN_STATUS) && task.assigneeId === userId;
}

export function canEditDetails(task: Task, userId: string, has: HasPermission): boolean {
  return has(PERMISSIONS.TASKS_EDIT_ALL) || task.createdBy === userId;
}

export const formatDateTime = (iso: string) => format(new Date(iso), 'd MMM yyyy, HH:mm');

/** The value a datetime-local input expects, in the viewer's own timezone. */
export const toDeadlineInput = (iso: string | null) =>
  iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '';

export const fromDeadlineInput = (value: string) => new Date(value).toISOString();
