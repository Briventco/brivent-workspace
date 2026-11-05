export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS',
  'TEAM_LEAD',
  'TEAM_MEMBER',
  'INTERN',
] as const;

export type Role = (typeof ROLES)[number];

export type UserStatus = 'ACTIVE' | 'DEACTIVATED';

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
