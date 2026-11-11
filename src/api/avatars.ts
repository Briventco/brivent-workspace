import { request, uploadForm } from './client';
import { BackendUser, toSession, toUser } from './mappers';
import { Session, User } from './types';

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** The server reads the type from the file itself, so this only saves a wasted upload. */
export function avatarFileProblem(file: File): string | null {
  if (file.type === 'image/gif') return "GIFs can't be used as a profile picture. Use a JPEG, PNG or WebP image.";
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return 'iPhone HEIC photos can\'t be used yet. Save it as a JPEG first, or take a screenshot of it.';
  }
  if (!AVATAR_TYPES.includes(file.type)) return 'Use a JPEG, PNG or WebP image.';
  if (file.size > AVATAR_MAX_BYTES) return 'That picture is over 5 MB. Choose a smaller one.';
  return null;
}

export async function uploadAvatar(
  image: Blob,
  onProgress?: (fraction: number) => void,
): Promise<Session> {
  const form = new FormData();
  form.append('file', image, 'avatar.webp');
  const data = await uploadForm<{ user: BackendUser }>('/me/avatar', form, { onProgress });
  return toSession(data.user);
}

export async function removeMyAvatar(): Promise<Session> {
  const data = await request<{ user: BackendUser }>('/me/avatar', { method: 'DELETE' });
  return toSession(data.user);
}

/** Super Admin only, for a picture that isn't appropriate. */
export async function removeUserAvatar(id: string): Promise<User> {
  const data = await request<{ user: BackendUser }>(`/users/${id}/avatar`, { method: 'DELETE' });
  return toUser(data.user);
}
