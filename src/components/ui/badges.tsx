import React from 'react';
import {
  PRIORITY_LABELS,
  Role,
  ROLE_LABELS,
  STATUS_LABELS,
  TaskPriority,
  TaskStatus,
  UserStatus,
} from '../../api/types';
import { Icon, IconName } from './Icon';

const STATUS: Record<TaskStatus, { className: string; icon: IconName; filled?: boolean }> = {
  TODO: { className: 'st-todo', icon: 'radio_button_unchecked' },
  IN_PROGRESS: { className: 'st-prog', icon: 'clock_loader_40' },
  BLOCKED: { className: 'st-block', icon: 'block' },
  DONE: { className: 'st-done', icon: 'check_circle', filled: true },
};

/** Status always ships as a shape, an icon and a word, so it reads without colour. */
export const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => {
  const { className, icon, filled } = STATUS[status];
  return (
    <span className={`badge ${className}`}>
      <Icon name={icon} size="sm" filled={filled} />
      {STATUS_LABELS[status]}
    </span>
  );
};

const PRIORITY: Record<TaskPriority, { className: string; icon: IconName; filled?: boolean }> = {
  LOW: { className: 'pr-low', icon: 'signal_cellular_alt_1_bar' },
  MEDIUM: { className: 'pr-med', icon: 'signal_cellular_alt_2_bar' },
  HIGH: { className: 'pr-high', icon: 'signal_cellular_alt' },
  URGENT: { className: 'pr-urgent', icon: 'error', filled: true },
};

export const PriorityBadge: React.FC<{ priority: TaskPriority }> = ({ priority }) => {
  const { className, icon, filled } = PRIORITY[priority];
  return (
    <span className={`pr ${className}`}>
      <Icon name={icon} size="sm" filled={filled} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
};

const ROLE_CLASS: Partial<Record<Role, string>> = {
  SUPER_ADMIN: 'role-super',
  ADMIN: 'role-admin',
  INTERN: 'role-intern',
};

export const RoleBadge: React.FC<{ role: Role }> = ({ role }) => (
  <span className={`role ${ROLE_CLASS[role] ?? ''}`}>
    {role === 'SUPER_ADMIN' && <Icon name="shield_person" size="sm" />}
    {ROLE_LABELS[role]}
  </span>
);

const USER_STATUS: Record<
  UserStatus,
  { className: string; icon: IconName; filled?: boolean; label: string }
> = {
  ACTIVE: { className: 'u-active', icon: 'check_circle', filled: true, label: 'Active' },
  PENDING: { className: 'u-pending', icon: 'hourglass_top', label: 'Pending invite' },
  DEACTIVATED: { className: 'u-off', icon: 'do_not_disturb_on', label: 'Deactivated' },
};

export const UserStatusBadge: React.FC<{ status: UserStatus }> = ({ status }) => {
  const { className, icon, filled, label } = USER_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 text-small font-semibold ${className}`}>
      <Icon name={icon} size="sm" filled={filled} />
      {label}
    </span>
  );
};
