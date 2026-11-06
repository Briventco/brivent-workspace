import React from 'react';
import { Meeting } from '../../api/meetings';
import { watDate, watDayStart, weekdayAndDay } from '../../lib/wat';
import { EmptyState } from '../ui/EmptyState';
import {
  clock24,
  dayOf,
  durationMinutes,
  isCancelled,
  meetingLabel,
  RSVP_LABELS,
} from './meetingHelpers';

export const DayStrip: React.FC<{
  days: string[];
  value: string;
  meetings: Meeting[];
  onChange: (date: string) => void;
}> = ({ days, value, meetings, onChange }) => (
  <div role="group" aria-label="Pick a day" className="day-strip">
    {days.map((date) => {
      const { weekday, day } = weekdayAndDay(watDayStart(date));
      const hasMeetings = meetings.some((meeting) => dayOf(meeting) === date);
      return (
        <button
          key={date}
          type="button"
          aria-pressed={date === value}
          aria-label={`${weekday} ${day}${hasMeetings ? ', has meetings' : ''}`}
          className={`${date === value ? 'on' : ''} ${date === watDate() ? 'is-today' : ''}`}
          onClick={() => onChange(date)}
        >
          <span>{weekday}</span>
          <strong>{day}</strong>
          {hasMeetings && <i aria-hidden="true" />}
        </button>
      );
    })}
  </div>
);

const place = (meeting: Meeting) =>
  [
    meeting.location ?? (meeting.meetingLink ? 'Online' : null),
    `${meeting.attendees.length} ${meeting.attendees.length === 1 ? 'person' : 'people'}`,
  ]
    .filter(Boolean)
    .join(' · ');

export const DayAgenda: React.FC<{
  date: string;
  meetings: Meeting[];
  selectedId: string | null;
  onSelect: (meeting: Meeting) => void;
}> = ({ date, meetings, selectedId, onSelect }) => {
  const today = meetings
    .filter((meeting) => dayOf(meeting) === date)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  if (today.length === 0) {
    return (
      <EmptyState
        icon="calendar_month"
        title="Nothing scheduled"
        description="Pick another day, or switch to Whole team to see everyone's meetings."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {today.map((meeting) => (
        <li key={meeting.id}>
          <button
            type="button"
            aria-label={meetingLabel(meeting)}
            onClick={() => onSelect(meeting)}
            className={`card agenda-card ${selectedId === meeting.id ? 'is-selected' : ''} ${isCancelled(meeting) ? 'is-cancelled' : ''} ${meeting.myRsvp === 'NO' ? 'is-declined' : ''}`}
          >
            <span className="w-14 shrink-0">
              <span className="block font-semibold">{clock24(meeting)}</span>
              <span className="block text-caption text-text-3">{durationMinutes(meeting)}m</span>
            </span>
            <span className="min-w-0 grow">
              <span className="agenda-title block font-semibold break-words">{meeting.title}</span>
              <span className="block text-small text-text-2 truncate">{place(meeting)}</span>
              <span className="block text-small font-semibold">
                {isCancelled(meeting) ? (
                  <span className="text-danger">Cancelled</span>
                ) : (
                  meeting.myRsvp && meeting.myRsvp !== 'PENDING' && (
                    <span className="text-text-2">{RSVP_LABELS[meeting.myRsvp]}</span>
                  )
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};
