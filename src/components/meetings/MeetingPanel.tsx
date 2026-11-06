import React, { useEffect, useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { answerMeeting, cancelMeeting, getMeeting, Meeting, Rsvp } from '../../api/meetings';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Link } from '../../lib/router';
import { useApiQuery } from '../../lib/useApiQuery';
import { formatShortDate, watDate } from '../../lib/wat';
import { ErrorState } from '../ui/AsyncState';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../ui/badges';
import { Button, IconButton } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Icon, IconName } from '../ui/Icon';
import { SidePanel } from '../ui/SidePanel';
import { SkeletonList } from '../ui/Skeleton';
import { SegmentedControl } from '../ui/Tabs';
import { isCancelled, RSVP_LABELS, startOf, timeRange } from './meetingHelpers';

const RSVP_OPTIONS: { value: Rsvp; label: string }[] = [
  { value: 'YES', label: 'Going' },
  { value: 'MAYBE', label: 'Maybe' },
  { value: 'NO', label: "Can't make it" },
];

const Fact: React.FC<{ icon: IconName; children: React.ReactNode }> = ({ icon, children }) => (
  <p className="flex items-start gap-2.5 break-words">
    <Icon name={icon} size="sm" className="mt-0.5 shrink-0 text-text-2" />
    <span className="min-w-0">{children}</span>
  </p>
);

export function canManageMeeting(
  meeting: Meeting,
  userId: string,
  can: (action: 'manageAllMeetings') => boolean,
): boolean {
  return !isCancelled(meeting) && (meeting.organizer.id === userId || can('manageAllMeetings'));
}

const shownLink = (link: string) => link.replace(/^https:\/\//, '').replace(/\/$/, '');

const Details: React.FC<{
  meeting: Meeting;
  isAnswering: boolean;
  onAnswer: (response: Rsvp) => void;
}> = ({ meeting, isAnswering, onAnswer }) => {
  const { user } = useSession();
  const cancelled = isCancelled(meeting);
  const isToday = watDate(startOf(meeting)) === watDate();

  return (
    <div className="space-y-5">
      <div>
        <h3 className={`t-h2 break-words ${cancelled ? 'line-through text-text-3' : ''}`}>
          {meeting.title}
        </h3>
        <p className="text-text-2">
          {isToday ? 'Today, ' : ''}
          {formatShortDate(startOf(meeting)).replace(',', isToday ? '' : ',')} · {timeRange(meeting)}
        </p>
        {cancelled && (
          <p className="mt-2 badge st-block">
            <Icon name="cancel" size="sm" />
            Cancelled
          </p>
        )}
      </div>

      <div className="space-y-2">
        {meeting.location && <Fact icon="location_on">{meeting.location}</Fact>}
        {meeting.meetingLink && !cancelled && (
          <Fact icon="videocam">
            <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
              {shownLink(meeting.meetingLink)}
            </a>
          </Fact>
        )}
        <Fact icon="person">Organised by {meeting.organizer.name}</Fact>
        {meeting.project && (
          <Fact icon="folder_open">
            <Link to={`/projects/${meeting.project.id}`}>{meeting.project.name}</Link>
          </Fact>
        )}
      </div>

      {meeting.myRsvp && !cancelled && (
        <div>
          <p className="font-semibold mb-2">Are you going?</p>
          <div className={isAnswering ? 'opacity-60 pointer-events-none' : ''}>
            <SegmentedControl
              label="Are you going?"
              options={RSVP_OPTIONS}
              value={meeting.myRsvp}
              onChange={onAnswer}
            />
          </div>
        </div>
      )}

      <section>
        <h4 className="t-over text-text-2 mb-2">People · {meeting.attendees.length}</h4>
        <ul className="space-y-2">
          {meeting.attendees.map((person) => {
            const isOrganizer = person.id === meeting.organizer.id;
            return (
              <li key={person.id} className="flex items-center gap-2.5 min-w-0">
                <Avatar name={person.name} id={person.id} size="sm" />
                <span className="grow truncate">
                  {person.name}
                  {person.id === user.id && ' (you)'}
                </span>
                <span
                  className={`text-small shrink-0 ${person.rsvp === 'YES' && !isOrganizer ? 'font-semibold text-success' : 'text-text-2'}`}
                >
                  {isOrganizer ? 'Organiser' : RSVP_LABELS[person.rsvp]}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {meeting.agenda && (
        <section>
          <h4 className="t-over text-text-2 mb-2">Agenda</h4>
          <p className="whitespace-pre-wrap break-words">{meeting.agenda}</p>
        </section>
      )}

      {meeting.linkedTasks.length > 0 && (
        <section>
          <h4 className="t-over text-text-2 mb-2">Linked tasks</h4>
          <ul className="space-y-1.5">
            {meeting.linkedTasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2 min-w-0">
                <StatusBadge status={task.status} />
                <Link to={`/tasks/${task.id}`} className="truncate text-text">
                  {task.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

interface MeetingPanelProps {
  meetingId: string;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
  onChanged: () => void;
}

export const MeetingPanel: React.FC<MeetingPanelProps> = ({
  meetingId,
  onClose,
  onEdit,
  onChanged,
}) => {
  const { user, can } = useSession();
  const toast = useToast();
  const query = useApiQuery((signal) => getMeeting(meetingId, signal), [meetingId]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (query.data) setMeeting(query.data);
  }, [query.data]);

  const isGone = query.error instanceof ApiError && query.error.status === 404;

  const answer = async (response: Rsvp) => {
    if (!meeting || response === 'PENDING') return;
    setIsAnswering(true);
    try {
      setMeeting(await answerMeeting(meeting.id, response));
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
      query.reload();
    } finally {
      setIsAnswering(false);
    }
  };

  const cancel = async () => {
    if (!meeting) return;
    setIsCancelling(true);
    try {
      setMeeting(await cancelMeeting(meeting.id));
      toast.success('Meeting cancelled.');
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsCancelling(false);
      setIsConfirming(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/calendar?meeting=${meetingId}`);
      toast.success('Link copied.');
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  const canManage = meeting ? canManageMeeting(meeting, user.id, can) : false;
  const joinLink = meeting && !isCancelled(meeting) ? meeting.meetingLink : null;

  return (
    <>
      <SidePanel
        isOpen
        // Esc belongs to the confirmation while it's open.
        onClose={isConfirming ? () => {} : onClose}
        title="Meeting"
        headerActions={<IconButton icon="link" label="Copy link" size="sm" onClick={copyLink} />}
        footer={
          (joinLink || canManage) && (
            <div className="flex flex-wrap items-center gap-2 w-full">
              {canManage && (
                <>
                  <Button variant="danger-ghost" onClick={() => setIsConfirming(true)}>
                    Cancel meeting
                  </Button>
                  <Button variant="secondary" icon="edit" onClick={() => onEdit(meeting!)}>
                    Edit
                  </Button>
                </>
              )}
              {joinLink && (
                <a
                  href={joinLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary grow hover:no-underline"
                >
                  <Icon name="videocam" />
                  Join meeting
                </a>
              )}
            </div>
          )
        }
      >
        {isGone ? (
          <ErrorState
            icon="event"
            title="This meeting isn't available"
            message="It may have been cancelled, or you may not be invited."
          />
        ) : query.error ? (
          <ErrorState
            title="Couldn't load this meeting"
            message={errorMessage(query.error)}
            onRetry={query.reload}
          />
        ) : meeting ? (
          <Details meeting={meeting} isAnswering={isAnswering} onAnswer={answer} />
        ) : (
          <SkeletonList label="Loading the meeting…" rows={3} />
        )}
      </SidePanel>

      <ConfirmDialog
        isOpen={isConfirming}
        title="Cancel this meeting?"
        description="It stays on the schedule, struck through, for the people invited. This can't be undone."
        confirmLabel="Cancel meeting"
        confirmVariant="danger"
        isLoading={isCancelling}
        onConfirm={cancel}
        onClose={() => setIsConfirming(false)}
      />
    </>
  );
};
