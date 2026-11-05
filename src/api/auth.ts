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

interface PasswordLinkResult {
  message: string;
  /** Not sent by the backend yet. Once it is, the login page fills it in. */
  email?: string;
}

/** The token from an invite email. Neither link call returns a session: sign in afterwards. */
export function setPassword(token: string, newPassword: string): Promise<PasswordLinkResult> {
  return request('/auth/set-password', {
    method: 'POST',
    body: { token, newPassword },
    anonymous: true,
  });
}

/** The token from a reset email. This also ends every session the account has. */
export function resetPassword(token: string, newPassword: string): Promise<PasswordLinkResult> {
  return request('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
    anonymous: true,
  });
}

/** Answers the same whether or not the account exists. */
export async function forgotPassword(email: string): Promise<string> {
  const data = await request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    anonymous: true,
  });
  return data.message;
}

/** Ends every session for this user, on all devices. */
export async function logout(token: string): Promise<void> {
  await request<null>('/auth/logout', { method: 'POST', token });
}
