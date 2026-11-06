import React from 'react';
import { listMyMeetings, MeetingSummary } from '../../api/meetings';
import { Link } from '../../lib/router';
import { useApiQuery } from '../../lib/useApiQuery';
import { addDays, formatTime, watDate, watDayStart } from '../../lib/wat';
import { AsyncState } from '../ui/AsyncState';
import { Card, CardHeader } from '../ui/Card';

const minutes = (meeting: MeetingSummary) =>
  Math.round((Date.parse(meeting.endsAt) - Date.parse(meeting.startsAt)) / 60000);

const place = (meeting: MeetingSummary) =>
  [meeting.location, `${meeting.attendees.length} people`].filter(Boolean).join(' · ');

/** Only rendered once the summary reports meetings, so it ships dark until the backend lands. */
export const MeetingsCard: React.FC = () => {
  const query = useApiQuery(async (signal) => {
    const today = watDayStart(watDate());
    const meetings = await listMyMeetings(today, addDays(today, 1), signal);
    return meetings.filter((meeting) => meeting.status === 'SCHEDULED');
  }, []);

  return (
    <Card>
      <CardHeader>
        <h2 className="t-h3">Today's meetings</h2>
        <Link to="/calendar" className="font-semibold">
          Schedule
        </Link>
      </CardHeader>
      <AsyncState
        query={query}
        errorTitle="Couldn't load meetings"
        isEmpty={(meetings) => meetings.length === 0}
        empty={<p className="card-pad text-text-2">Nothing scheduled today.</p>}
      >
        {(meetings) => (
          <ul className="divide-y divide-border">
            {meetings.map((meeting) => (
              <li key={meeting.id} className="li">
                <span className="w-16 shrink-0">
                  <span className="block font-semibold">
                    {formatTime(new Date(meeting.startsAt))}
                  </span>
                  <span className="block text-caption text-text-3">{minutes(meeting)} min</span>
                </span>
                <span className="min-w-0">
                  <span className="title block truncate">{meeting.title}</span>
                  <span className="block text-small text-text-2 truncate">{place(meeting)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </AsyncState>
    </Card>
  );
};
