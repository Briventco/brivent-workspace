import { Meeting, Rsvp } from '../../api/meetings';
import { format24Hour, formatClock, formatTime, watDate, watMinutes } from '../../lib/wat';
import { tintFor } from '../ui/Avatar';

export const startOf = (meeting: Meeting) => new Date(meeting.startsAt);
export const endOf = (meeting: Meeting) => new Date(meeting.endsAt);
export const dayOf = (meeting: Meeting) => watDate(startOf(meeting));
export const isCancelled = (meeting: Meeting) => meeting.status === 'CANCELLED';

export const durationMinutes = (meeting: Meeting) =>
  Math.round((endOf(meeting).getTime() - startOf(meeting).getTime()) / 60000);

/** Minutes from midnight WAT, stopping at the end of the day it started on. */
export function minuteSpan(meeting: Meeting): { start: number; end: number } {
  const start = watMinutes(startOf(meeting));
  return { start, end: Math.min(start + durationMinutes(meeting), 24 * 60) };
}

/** 11:00 to 12:00 */
export const clockRange = (meeting: Meeting) =>
  `${formatClock(startOf(meeting))} to ${formatClock(endOf(meeting))}`;

/** 3:00 to 3:45 PM */
export const timeRange = (meeting: Meeting) =>
  `${formatClock(startOf(meeting))} to ${formatTime(endOf(meeting))}`;

export const clock24 = (meeting: Meeting) => format24Hour(startOf(meeting));

export const RSVP_LABELS: Record<Rsvp, string> = {
  PENDING: 'No reply yet',
  YES: 'Going',
  MAYBE: 'Maybe',
  NO: "Can't make it",
};

/** Project meetings share a colour. Everything else stays cobalt. */
export const meetingTint = (meeting: Meeting) =>
  meeting.project ? `a${tintFor(meeting.project.id)}` : 'meeting-default';

export function meetingLabel(meeting: Meeting): string {
  const status = isCancelled(meeting) ? ', cancelled' : '';
  return `${meeting.title}, ${timeRange(meeting)}${status}`;
}

/** Meetings at the same time sit side by side: each gets a lane, and shares its group's width. */
export function layOutDay(meetings: Meeting[]): { meeting: Meeting; lane: number; lanes: number }[] {
  const sorted = [...meetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const placed: { meeting: Meeting; lane: number; lanes: number }[] = [];
  let group: typeof placed = [];
  let groupEnd = 0;

  const closeGroup = () => {
    const lanes = Math.max(...group.map((item) => item.lane)) + 1;
    group.forEach((item) => {
      item.lanes = lanes;
    });
  };

  for (const meeting of sorted) {
    const { start, end } = minuteSpan(meeting);
    if (group.length > 0 && start >= groupEnd) {
      closeGroup();
      group = [];
      groupEnd = 0;
    }
    const taken = group.filter((item) => minuteSpan(item.meeting).end > start).map(({ lane }) => lane);
    let lane = 0;
    while (taken.includes(lane)) lane += 1;
    const item = { meeting, lane, lanes: 1 };
    group.push(item);
    placed.push(item);
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length > 0) closeGroup();
  return placed;
}
