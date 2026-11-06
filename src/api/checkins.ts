import { request } from './client';
import { Checkin, CheckinPerson, CheckinReply } from './types';

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

export interface CheckinAnswers {
  workCompleted: string;
  priorities: string;
  blockers: string;
  taskIds: string[];
}

/** Replaces the whole check-in: anything left out is cleared, so always send the full form. */
export async function saveTodayCheckin(answers: CheckinAnswers): Promise<Checkin> {
  const data = await request<{ checkin: Checkin }>('/checkins/today', {
    method: 'PUT',
    body: answers,
  });
  return data.checkin;
}

export async function listMyCheckins(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<Checkin[]> {
  const params = new URLSearchParams({ from, to, limit: '100' });
  const data = await request<{ checkins: Checkin[] }>(`/checkins/mine?${params}`, { signal });
  return data.checkins;
}

export async function postCheckinReply(id: string, body: string): Promise<CheckinReply> {
  const data = await request<{ reply: CheckinReply }>(`/checkins/${id}/replies`, {
    method: 'POST',
    body: { body },
  });
  return data.reply;
}
