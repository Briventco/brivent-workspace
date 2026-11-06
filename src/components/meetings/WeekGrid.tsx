import React from 'react';
import { Meeting } from '../../api/meetings';
import { Task } from '../../api/types';
import { Link } from '../../lib/router';
import { watDate, watDayStart, weekdayAndDay } from '../../lib/wat';
import { Icon } from '../ui/Icon';
import { clockRange, dayOf, isCancelled, layOutDay, meetingLabel, meetingTint, minuteSpan } from './meetingHelpers';

const HOUR_PX = 56;
const FIRST_HOUR = 9;
const LAST_HOUR = 18;
const SHOWS_TIME_FROM_PX = 40;

const hourLabel = (hour: number) => {
  if (hour === 12) return '12 PM';
  if (hour === 0) return '12 AM';
  return hour === FIRST_HOUR ? `${hour} AM` : String(hour > 12 ? hour - 12 : hour);
};

/** 9 to 6 unless a meeting runs outside it, so the usual day fills the screen. */
function hourRange(meetings: Meeting[]): { first: number; last: number } {
  let first = FIRST_HOUR;
  let last = LAST_HOUR;
  for (const meeting of meetings) {
    const { start, end } = minuteSpan(meeting);
    first = Math.min(first, Math.floor(start / 60));
    last = Math.max(last, Math.ceil(end / 60));
  }
  return { first, last };
}

interface WeekGridProps {
  days: string[];
  meetings: Meeting[];
  deadlines: Task[];
  selectedId: string | null;
  onSelect: (meeting: Meeting) => void;
}

export const WeekGrid: React.FC<WeekGridProps> = ({
  days,
  meetings,
  deadlines,
  selectedId,
  onSelect,
}) => {
  const { first, last } = hourRange(meetings);
  const hours = Array.from({ length: last - first }, (_, index) => first + index);
  const today = watDate();
  const columns = { gridTemplateColumns: `56px repeat(${days.length}, minmax(112px, 1fr))` };

  return (
    <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label="Schedule">
      <div className="week-head" style={columns}>
        <span />
        {days.map((date) => {
          const { weekday, day } = weekdayAndDay(watDayStart(date));
          const due = deadlines.filter((task) => watDate(new Date(task.deadline!)) === date);
          return (
            <div key={date} className={`week-day ${date === today ? 'is-today' : ''}`}>
              <span className="t-over">{weekday}</span>
              <span className="week-date">{day}</span>
              {due.map((task) => (
                <Link key={task.id} to={`/tasks/${task.id}`} className="week-deadline" title={task.title}>
                  <Icon name="flag" size="sm" />
                  <span className="truncate">{task.title}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <div className="week-body" style={columns}>
        <div>
          {hours.map((hour) => (
            <div key={hour} className="week-hour" style={{ height: HOUR_PX }}>
              {hourLabel(hour)}
            </div>
          ))}
        </div>
        {days.map((date) => (
          <div
            key={date}
            className={`week-column ${date === today ? 'is-today' : ''}`}
            style={{ height: hours.length * HOUR_PX, backgroundSize: `100% ${HOUR_PX}px` }}
          >
            {layOutDay(meetings.filter((meeting) => dayOf(meeting) === date)).map(
              ({ meeting, lane, lanes }) => {
                const { start, end } = minuteSpan(meeting);
                const height = Math.max(((end - start) / 60) * HOUR_PX - 2, 24);
                return (
                  <button
                    key={meeting.id}
                    type="button"
                    aria-label={meetingLabel(meeting)}
                    aria-pressed={selectedId === meeting.id}
                    onClick={() => onSelect(meeting)}
                    className={`meeting-block ${meetingTint(meeting)} ${isCancelled(meeting) ? 'is-cancelled' : ''} ${meeting.myRsvp === 'NO' ? 'is-declined' : ''} ${selectedId === meeting.id ? 'is-selected' : ''}`}
                    style={{
                      top: ((start - first * 60) / 60) * HOUR_PX,
                      height,
                      left: `calc(${(lane / lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                    }}
                  >
                    <span className="block font-semibold truncate">{meeting.title}</span>
                    {height >= SHOWS_TIME_FROM_PX && (
                      <span className="block truncate">{clockRange(meeting)}</span>
                    )}
                  </button>
                );
              },
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
