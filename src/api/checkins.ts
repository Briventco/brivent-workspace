import { request } from './client';
import { Checkin, CheckinPerson } from './types';

export interface TeamCheckins {
  checkins: Checkin[];
  notCheckedIn: CheckinPerson[];
}

export async function getTodayCheckin(signal?: AbortSignal): Promise<Checkin | null> {
  const data = await request<{ checkin: Checkin | null }>('/checkins/today', { signal });
  return data.checkin;
}

export function getTeamCheckins(
  options: { date?: string; blockersOnly?: boolean },
  signal?: AbortSignal,
): Promise<TeamCheckins> {
  const params = new URLSearchParams();
  if (options.date) params.set('date', options.date);
  if (options.blockersOnly) params.set('blockersOnly', 'true');
  return request(`/checkins/team?${params}`, { signal });
}

export async function setBlockerHandled(id: string, handled: boolean): Promise<Checkin> {
  const data = await request<{ checkin: Checkin }>(`/checkins/${id}/blocker`, {
    method: 'PATCH',
    body: { handled },
  });
  return data.checkin;
}
