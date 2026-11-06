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

/** What someone does. It never affects access: `role` alone does that. */
export interface Placement {
  department?: Named | null;
  position?: Named | null;
}

export interface User extends Placement {
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

export interface Named {
  id: string;
  name: string;
}

export interface PersonRef extends Named, Placement {}

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
  projectId: string | null;
  project: Named | null;
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
  /** Each of these arrives with its backend feature. The dashboard only shows what's sent. */
  checkedInToday?: boolean;
  teamCheckins?: { submitted: number; notSubmitted: number; openBlockers: number };
  upcomingMeetings?: number;
}

export interface CheckinPerson extends PersonRef {
  role: Role;
}

export interface CheckinReply {
  id: string;
  author: PersonRef;
  body: string;
  createdAt: string;
}

export interface LinkedTask {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface Checkin {
  id: string;
  user: CheckinPerson;
  /** The WAT calendar date as YYYY-MM-DD. Never pass it through a browser timezone. */
  date: string;
  workCompleted: string;
  priorities: string;
  blockers: string | null;
  blockerHandled: boolean;
  blockerHandledBy: PersonRef | null;
  isLate: boolean;
  submittedAt: string;
  updatedAt: string;
  editable: boolean;
  linkedTasks: LinkedTask[];
  replies: CheckinReply[];
}

export interface DirectoryUser extends PersonRef {
  role: Role;
  status: UserStatus;
}

export const PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
};

export interface ProjectMember extends PersonRef {
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  /** Calendar days as YYYY-MM-DD. Never pass them through a browser timezone. */
  startDate: string | null;
  dueDate: string | null;
  owner: PersonRef;
  members: ProjectMember[];
  progress: { total: number; done: number; overdue: number };
  createdAt: string;
  updatedAt: string;
}
