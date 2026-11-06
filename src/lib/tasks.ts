import { format } from 'date-fns';
import { Task } from '../api/types';
import { Action } from './permissions';

type Can = (action: Action) => boolean;

/** Mirrors the backend's rules, so nobody is offered a control that would be refused. */
export function canChangeStatus(task: Task, userId: string, can: Can): boolean {
  if (can('editAnyTask')) return true;
  return can('changeOwnTaskStatus') && task.assigneeId === userId;
}

export function canEditDetails(task: Task, userId: string, can: Can): boolean {
  return can('editAnyTask') || task.createdBy === userId;
}

export const formatDateTime = (iso: string) => format(new Date(iso), 'd MMM yyyy, HH:mm');

/** The value a datetime-local input expects, in the viewer's own timezone. */
export const toDeadlineInput = (iso: string | null) =>
  iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '';

export const fromDeadlineInput = (value: string) => new Date(value).toISOString();
