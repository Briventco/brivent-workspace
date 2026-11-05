import { request } from './client';
import { BackendUser, toUser } from './mappers';
import { DirectoryUser, Role, User } from './types';

export const USERS_PAGE_SIZE = 50;

export interface UsersPage {
  users: User[];
  total: number;
}

export interface NewUser {
  fullName: string;
  email: string;
  role: Role;
  temporaryPassword: string;
}

export interface UserChanges {
  fullName?: string;
  role?: Role;
}

export async function listUsers(page: number, signal?: AbortSignal): Promise<UsersPage> {
  const data = await request<{ users: BackendUser[]; total: number }>(
    `/users?page=${page}&limit=${USERS_PAGE_SIZE}`,
    { signal },
  );
  return { users: data.users.map(toUser), total: data.total };
}

export async function createUser({ fullName, ...rest }: NewUser): Promise<User> {
  const data = await request<{ user: BackendUser }>('/users', {
    method: 'POST',
    body: { name: fullName, ...rest },
  });
  return toUser(data.user);
}

export async function updateUser(id: string, { fullName, role }: UserChanges): Promise<User> {
  const data = await request<{ user: BackendUser }>(`/users/${id}`, {
    method: 'PATCH',
    body: { name: fullName, role },
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

/** The temporary password is only ever available in this response. */
export async function resetUserPassword(id: string): Promise<string> {
  const data = await request<{ temporaryPassword: string }>(`/users/${id}/reset-password`, {
    method: 'POST',
  });
  return data.temporaryPassword;
}

const DIRECTORY_PAGE_SIZE = 100;

export async function searchDirectory(
  search: string,
  signal?: AbortSignal,
  page = 1,
): Promise<{ users: DirectoryUser[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(DIRECTORY_PAGE_SIZE) });
  if (search) params.set('search', search);
  return request(`/users/directory?${params}`, { signal });
}

/** Every matching colleague across pages, so filtering by role can't miss anyone. */
export async function listDirectory(search: string, signal?: AbortSignal): Promise<DirectoryUser[]> {
  const users: DirectoryUser[] = [];
  for (let page = 1; ; page += 1) {
    const data = await searchDirectory(search, signal, page);
    users.push(...data.users);
    if (data.users.length === 0 || users.length >= data.total) return users;
  }
}
