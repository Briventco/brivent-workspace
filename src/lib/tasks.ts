import { Task } from '../api/types';
import { Action } from './permissions';
import { formatDateTime as formatWat, fromDateTimeInput, toDateTimeInput } from './wat';

type Can = (action: Action) => boolean;

export const isAssignee = (task: Task, userId: string) =>
  task.assignees.some(({ id }) => id === userId);

/** Mirrors the backend's rules, so nobody is offered a control that would be refused. */
export function canChangeStatus(task: Task, userId: string, can: Can): boolean {
  if (can('editAnyTask')) return true;
  return can('changeOwnTaskStatus') && isAssignee(task, userId);
}

export function canEditDetails(task: Task, userId: string, can: Can): boolean {
  return can('editAnyTask') || task.createdBy === userId;
}

export function canComment(task: Task, userId: string, can: Can): boolean {
  if (!can('commentOnTask')) return false;
  return can('viewAllTasks') || isAssignee(task, userId) || task.createdBy === userId;
}

export const formatDateTime = (iso: string) => formatWat(new Date(iso));

export const toDeadlineInput = (iso: string | null) => (iso ? toDateTimeInput(new Date(iso)) : '');

export const fromDeadlineInput = (value: string) => fromDateTimeInput(value).toISOString();
