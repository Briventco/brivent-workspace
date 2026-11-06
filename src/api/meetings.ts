import { request } from './client';
import { PersonRef } from './types';

export interface MeetingSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  meetingLink: string | null;
  status: 'SCHEDULED' | 'CANCELLED';
  attendees: PersonRef[];
}

export async function listMyMeetings(
  from: Date,
  to: Date,
  signal?: AbortSignal,
): Promise<MeetingSummary[]> {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    scope: 'mine',
  });
  const data = await request<{ meetings: MeetingSummary[] }>(`/meetings?${params}`, { signal });
  return data.meetings;
}
