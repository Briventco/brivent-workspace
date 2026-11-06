export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS',
  'TEAM_LEAD',
  'TEAM_MEMBER',
  'INTERN',
] as const;

export type Role = (typeof ROLES)[number];

export type UserStatus = 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
export const USER_STATUSES: UserStatus[] = ['ACTIVE', 'PENDING', 'DEACTIVATED'];

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface Session {
  user: User;
  permissions: string[];
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERATIONS: 'Operations',
  TEAM_LEAD: 'Team Lead',
  TEAM_MEMBER: 'Team Member',
  INTERN: 'Intern',
};

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export interface PersonRef {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string | null;
  createdBy: string;
  assigneeId: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  creator: PersonRef;
  assignee: PersonRef | null;
  assignedBy: PersonRef | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  body: string;
  author: PersonRef;
  createdAt: string;
}

export interface TaskSummary {
  scope: 'mine' | 'team';
  open: number;
  overdue: number;
  doneThisWeek: number;
  weekStart: string;
}

export interface DirectoryUser extends PersonRef {
  role: Role;
  status: UserStatus;
}
