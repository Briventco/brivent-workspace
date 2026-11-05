import { request } from './client';
import { BackendUser, toUser } from './mappers';
import { Role, User } from './types';

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
