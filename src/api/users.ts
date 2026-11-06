import { request } from './client';
import { BackendUser, toUser } from './mappers';
import { DirectoryUser, Role, User } from './types';

export const USERS_PAGE_SIZE = 50;

export interface UsersPage {
  users: User[];
  total: number;
}

/** A position needs its department, so these always travel together. null means none. */
export interface PlacementIds {
  departmentId: string | null;
  positionId: string | null;
}

export interface NewUser extends PlacementIds {
  fullName: string;
  email: string;
  role: Role;
}

/** `link` only comes back when the email failed. It's a working credential: never store or log it. */
export interface EmailedLinkResult {
  user: User;
  emailSent: boolean;
  link?: string;
}

interface EmailedLinkResponse {
  user: BackendUser;
  emailSent: boolean;
  link?: string;
}

const toLinkResult = ({ user, ...rest }: EmailedLinkResponse): EmailedLinkResult => ({
  user: toUser(user),
  ...rest,
});

export interface UserChanges extends Partial<PlacementIds> {
  fullName?: string;
  role?: Role;
}

export async function listUsers(
  page: number,
  departmentId: string,
  signal?: AbortSignal,
): Promise<UsersPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(USERS_PAGE_SIZE) });
  if (departmentId) params.set('departmentId', departmentId);
  const data = await request<{ users: BackendUser[]; total: number }>(`/users?${params}`, {
    signal,
  });
  return { users: data.users.map(toUser), total: data.total };
}

/**
 * Active people with no department. The API can't filter on this, so it reads every page.
 * Replace with a query parameter if the backend adds one.
 */
export async function listUsersWithoutDepartment(signal?: AbortSignal): Promise<User[]> {
  const found: User[] = [];
  for (let page = 1, seen = 0; ; page += 1) {
    const data = await request<{ users: BackendUser[]; total: number }>(
      `/users?page=${page}&limit=100`,
      { signal },
    );
    seen += data.users.length;
    found.push(
      ...data.users.map(toUser).filter((user) => user.status === 'ACTIVE' && !user.department),
    );
    if (data.users.length === 0 || seen >= data.total) return found;
  }
}

export async function createUser({ fullName, ...rest }: NewUser): Promise<EmailedLinkResult> {
  const data = await request<EmailedLinkResponse>('/users', {
    method: 'POST',
    body: { name: fullName, ...rest },
  });
  return toLinkResult(data);
}

export async function updateUser(id: string, { fullName, ...rest }: UserChanges): Promise<User> {
  const data = await request<{ user: BackendUser }>(`/users/${id}`, {
    method: 'PATCH',
    body: { name: fullName, ...rest },
  });
  return toUser(data.user);
}

export async function deactivateUser(id: string): Promise<User> {
  const data = await request<{ user: BackendUser }>(`/users/${id}/deactivate`, { method: 'POST' });
  return toUser(data.user);
}

export async function reactivateUser(id: string): Promise<User> {
  const data = await request<{ user: BackendUser }>(`/users/${id}/reactivate`, { method: 'POST' });
  return toUser(data.user);
}

/** The user's old password stops working as soon as this succeeds. */
export async function resetUserPassword(id: string): Promise<EmailedLinkResult> {
  const data = await request<EmailedLinkResponse>(`/users/${id}/reset-password`, {
    method: 'POST',
  });
  return toLinkResult(data);
}

/** Sends a pending user a new link and cancels the old one. */
export async function resendInvite(id: string): Promise<EmailedLinkResult> {
  const data = await request<EmailedLinkResponse>(`/users/${id}/resend-invite`, {
    method: 'POST',
  });
  return toLinkResult(data);
}

const DIRECTORY_PAGE_SIZE = 100;

export async function searchDirectory(
  search: string,
  signal?: AbortSignal,
  page = 1,
  departmentId = '',
): Promise<{ users: DirectoryUser[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(DIRECTORY_PAGE_SIZE) });
  if (search) params.set('search', search);
  if (departmentId) params.set('departmentId', departmentId);
  return request(`/users/directory?${params}`, { signal });
}

/** Every matching colleague across pages, so filtering by role can't miss anyone. */
export async function listDirectory(
  search: string,
  departmentId: string,
  signal?: AbortSignal,
): Promise<DirectoryUser[]> {
  const users: DirectoryUser[] = [];
  for (let page = 1; ; page += 1) {
    const data = await searchDirectory(search, signal, page, departmentId);
    users.push(...data.users);
    if (data.users.length === 0 || users.length >= data.total) return users;
  }
}
