import { Named, Role, Session, User, UserStatus } from './types';

/**
 * The one place that knows how the backend's user differs from the agreed contract:
 * it sends `name` rather than `fullName`, and nests `permissions` inside the user.
 * The rest of the app only sees the contract's shape.
 */
export interface BackendUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  department?: Named | null;
  position?: Named | null;
  permissions?: string[];
}

export function toUser(raw: BackendUser): User {
  return {
    id: raw.id,
    fullName: raw.name,
    email: raw.email,
    role: raw.role,
    status: raw.status,
    mustChangePassword: raw.mustChangePassword,
    createdAt: raw.createdAt,
    department: raw.department,
    position: raw.position,
  };
}

export function toSession(raw: BackendUser): Session {
  return { user: toUser(raw), permissions: raw.permissions ?? [] };
}
