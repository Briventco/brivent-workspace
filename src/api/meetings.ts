import { request } from './client';
import { LinkedTask, PersonRef, Role } from './types';

export type Rsvp = 'PENDING' | 'YES' | 'NO' | 'MAYBE';
export type MeetingScope = 'mine' | 'team';

export interface MeetingAttendee extends PersonRef {
  role: Role;
  rsvp: Rsvp;
}

export interface Meeting {
  id: string;
  title: string;
  agenda: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  meetingLink: string | null;
  status: 'SCHEDULED' | 'CANCELLED';
  cancelledAt: string | null;
  organizer: PersonRef;
  /** Null when there's no project, or when this viewer isn't allowed to see it. */
  project: PersonRef | null;
  attendees: MeetingAttendee[];
  /** Null when this viewer isn't invited. */
  myRsvp: Rsvp | null;
  /** Only the tasks this viewer can see, so it can be shorter than the real list. */
  linkedTasks: LinkedTask[];
}

export interface MeetingInput {
  title: string;
  startsAt: string;
  endsAt: string;
  agenda: string | null;
  location: string | null;
  meetingLink: string | null;
  projectId: string | null;
  attendeeIds: string[];
  taskIds: string[];
}

/** `from` and `to` are WAT days as YYYY-MM-DD, each covering that whole day. */
export async function listMeetings(
  from: string,
  to: string,
  scope: MeetingScope,
  signal?: AbortSignal,
): Promise<Meeting[]> {
  const params = new URLSearchParams({ from, to, scope });
  const data = await request<{ meetings: Meeting[] }>(`/meetings?${params}`, { signal });
  return data.meetings;
}

export async function getMeeting(id: string, signal?: AbortSignal): Promise<Meeting> {
  const data = await request<{ meeting: Meeting }>(`/meetings/${id}`, { signal });
  return data.meeting;
}

export async function createMeeting({
  agenda,
  location,
  meetingLink,
  projectId,
  ...required
}: MeetingInput): Promise<Meeting> {
  const data = await request<{ meeting: Meeting }>('/meetings', {
    method: 'POST',
    body: {
      ...required,
      ...(agenda && { agenda }),
      ...(location && { location }),
      ...(meetingLink && { meetingLink }),
      ...(projectId && { projectId }),
    },
  });
  return data.meeting;
}

/**
 * attendeeIds and taskIds replace the whole list, and linkedTasks only shows what this viewer can
 * see. Send them only when they changed, or a save could drop tasks the editor can't see.
 */
export async function updateMeeting(id: string, changes: Partial<MeetingInput>): Promise<Meeting> {
  const data = await request<{ meeting: Meeting }>(`/meetings/${id}`, {
    method: 'PATCH',
    body: changes,
  });
  return data.meeting;
}

export async function cancelMeeting(id: string): Promise<Meeting> {
  const data = await request<{ meeting: Meeting }>(`/meetings/${id}/cancel`, { method: 'POST' });
  return data.meeting;
}

export async function answerMeeting(id: string, response: Exclude<Rsvp, 'PENDING'>): Promise<Meeting> {
  const data = await request<{ meeting: Meeting }>(`/meetings/${id}/rsvp`, {
    method: 'POST',
    body: { response },
  });
  return data.meeting;
}
