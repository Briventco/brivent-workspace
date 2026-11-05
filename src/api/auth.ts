import { request, setToken } from './client';
import { BackendUser, toSession } from './mappers';
import { Session } from './types';

interface TokenResponse {
  token: string;
  user: BackendUser;
}

export async function login(email: string, password: string): Promise<Session> {
  const data = await request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    anonymous: true,
  });
  setToken(data.token);
  return toSession(data.user);
}

export async function getMe(signal?: AbortSignal): Promise<Session> {
  const data = await request<{ user: BackendUser }>('/me', { signal });
  return toSession(data.user);
}

/** Changing a password invalidates every existing token, so the new one must be stored. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<Session> {
  const data = await request<TokenResponse>('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
  setToken(data.token);
  return toSession(data.user);
}
