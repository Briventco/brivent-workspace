import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { createMeeting, Meeting, MeetingInput, updateMeeting } from '../../api/meetings';
import { listAllProjects } from '../../api/projects';
import { listOpenTasks } from '../../api/tasks';
import { PersonRef } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApiQuery } from '../../lib/useApiQuery';
import { format24Hour, fromDateTimeInput, watDate } from '../../lib/wat';
import { AssigneePicker } from '../tasks/AssigneePicker';
import { Avatar } from '../ui/Avatar';
import { Banner } from '../ui/Banner';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SidePanel } from '../ui/SidePanel';
import { Textarea } from '../ui/Textarea';
import { endOf, startOf } from './meetingHelpers';

const FORM_ID = 'meeting-form';

const sameList = (a: string[], b: string[]) =>
  [...a].sort().join() === [...b].sort().join();

interface MeetingFormPanelProps {
  /** Edits this meeting. Without it, the panel creates a new one. */
  meeting?: Meeting;
  /** The day to start a new meeting on. */
  date: string;
  onClose: () => void;
  onSaved: (meeting: Meeting) => void;
}

export const MeetingFormPanel: React.FC<MeetingFormPanelProps> = ({
  meeting,
  date,
  onClose,
  onSaved,
}) => {
  const { user } = useSession();
  const toast = useToast();

  const [title, setTitle] = useState(meeting?.title ?? '');
  const [day, setDay] = useState(meeting ? watDate(startOf(meeting)) : date);
  const [starts, setStarts] = useState(meeting ? format24Hour(startOf(meeting)) : '10:00');
  const [ends, setEnds] = useState(meeting ? format24Hour(endOf(meeting)) : '10:30');
  const [location, setLocation] = useState(meeting?.location ?? '');
  const [link, setLink] = useState(meeting?.meetingLink ?? '');
  const [agenda, setAgenda] = useState(meeting?.agenda ?? '');
  const [projectId, setProjectId] = useState(meeting?.project?.id ?? '');
  const [attendees, setAttendees] = useState<PersonRef[]>(
    meeting?.attendees.filter(({ id }) => id !== meeting.organizer.id) ?? [],
  );
  const [linked, setLinked] = useState<PersonRef[]>(
    meeting?.linkedTasks.map(({ id, title: name }) => ({ id, name })) ?? [],
  );

  const [errors, setErrors] = useState<{ title?: string; ends?: string; link?: string }>({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const projects = useApiQuery((signal) => listAllProjects(signal), []);
  const tasks = useApiQuery((signal) => listOpenTasks('all', {}, signal), []);

  const organizerId = meeting?.organizer.id ?? user.id;
  const projectOptions = [
    { value: '', label: 'No project' },
    ...(projects.data ?? [])
      .filter((project) => project.status !== 'COMPLETED' || project.id === meeting?.project?.id)
      .map(({ id, name }) => ({ value: id, label: name })),
  ];
  const taskOptions = [
    { value: '', label: 'Link a task' },
    ...(tasks.data ?? [])
      .filter((task) => !linked.some(({ id }) => id === task.id))
      .filter((task) => !projectId || task.projectId === projectId)
      .map(({ id, title: name }) => ({ value: id, label: name })),
  ];

  const toInput = (): MeetingInput => ({
    title: title.trim(),
    startsAt: fromDateTimeInput(`${day}T${starts}`).toISOString(),
    endsAt: fromDateTimeInput(`${day}T${ends}`).toISOString(),
    agenda: agenda.trim() || null,
    location: location.trim() || null,
    meetingLink: link.trim() || null,
    projectId: projectId || null,
    attendeeIds: attendees.map(({ id }) => id),
    taskIds: linked.map(({ id }) => id),
  });

  const changesFrom = (original: Meeting, input: MeetingInput): Partial<MeetingInput> => {
    const changes: Partial<MeetingInput> = {};
    if (input.title !== original.title) changes.title = input.title;
    if (input.startsAt !== new Date(original.startsAt).toISOString()) changes.startsAt = input.startsAt;
    if (input.endsAt !== new Date(original.endsAt).toISOString()) changes.endsAt = input.endsAt;
    if (input.agenda !== original.agenda) changes.agenda = input.agenda;
    if (input.location !== original.location) changes.location = input.location;
    if (input.meetingLink !== original.meetingLink) changes.meetingLink = input.meetingLink;
    if (input.projectId !== (original.project?.id ?? null)) changes.projectId = input.projectId;
    const stayed = original.attendees.filter(({ id }) => id !== original.organizer.id);
    if (!sameList(input.attendeeIds, stayed.map(({ id }) => id))) {
      changes.attendeeIds = input.attendeeIds;
    }
    if (!sameList(input.taskIds, original.linkedTasks.map(({ id }) => id))) {
      changes.taskIds = input.taskIds;
    }
    return changes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors = {
      title: title.trim() ? undefined : 'Give the meeting a title.',
      ends: ends > starts ? undefined : 'End it after it starts.',
      link: !link.trim() || /^https:\/\/\S+$/.test(link.trim()) ? undefined : 'Use a link starting https://',
    };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.ends || nextErrors.link) return;

    setIsSaving(true);
    try {
      const input = toInput();
      const saved = meeting
        ? await updateMeeting(meeting.id, changesFrom(meeting, input))
        : await createMeeting(input);
      toast.success(meeting ? 'Meeting updated.' : 'Meeting created.');
      onSaved(saved);
    } catch (error) {
      setIsSaving(false);
      if (error instanceof ApiError && error.code === 'INVALID_TIME_RANGE') {
        setErrors({ ends: error.message });
      } else if (error instanceof ApiError && error.fieldErrors.meetingLink) {
        setErrors({ link: error.fieldErrors.meetingLink });
      } else if (error instanceof ApiError && error.fieldErrors.title) {
        setErrors({ title: error.fieldErrors.title });
      } else {
        setFormError(errorMessage(error));
      }
    }
  };

  return (
    <SidePanel
      isOpen
      onClose={isSaving ? () => {} : onClose}
      title={meeting ? 'Edit meeting' : 'New meeting'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Close
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSaving}>
            {meeting ? 'Save changes' : 'Create meeting'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Banner>{formError}</Banner>}
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          maxLength={200}
          autoComplete="off"
          data-autofocus
        />
        <Input label="Date" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <div className="grid gap-4 grid-cols-2">
          <Input
            label="Starts"
            type="time"
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
          />
          <Input
            label="Ends"
            type="time"
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
            error={errors.ends}
          />
        </div>
        <p className="text-small text-text-2">Times are Lagos time (WAT).</p>
        <Input
          label="Location"
          optional
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          autoComplete="off"
        />
        <Input
          label="Meeting link"
          optional
          value={link}
          onChange={(e) => setLink(e.target.value)}
          error={errors.link}
          placeholder="https://"
          autoComplete="off"
        />
        <Textarea
          label="Agenda"
          optional
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          rows={3}
        />
        <div>
          <AssigneePicker
            label="Attendees"
            allowNone={false}
            placeholder="Add people"
            value={null}
            excludeIds={[organizerId, ...attendees.map(({ id }) => id)]}
            onChange={(person) => person && setAttendees((current) => [...current, person])}
          />
          {attendees.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {attendees.map((person) => (
                <li key={person.id} className="chip">
                  <Avatar name={person.name} id={person.id} avatar={person.avatar} size="sm" />
                  {person.name}
                  <IconButton
                    icon="close"
                    size="sm"
                    label={`Remove ${person.name}`}
                    onClick={() =>
                      setAttendees((current) => current.filter(({ id }) => id !== person.id))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        {projectOptions.length > 1 && (
          <Select
            label="Project"
            optional
            value={projectId}
            options={projectOptions}
            onChange={(e) => setProjectId(e.target.value)}
          />
        )}
        <div>
          <Select
            label="Linked tasks"
            optional
            value=""
            options={taskOptions}
            onChange={(e) => {
              const task = tasks.data?.find(({ id }) => id === e.target.value);
              if (task) setLinked((current) => [...current, { id: task.id, name: task.title }]);
            }}
          />
          {linked.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {linked.map((task) => (
                <li key={task.id} className="chip max-w-full">
                  <span className="truncate">{task.name}</span>
                  <IconButton
                    icon="close"
                    size="sm"
                    label={`Unlink ${task.name}`}
                    onClick={() =>
                      setLinked((current) => current.filter(({ id }) => id !== task.id))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>
    </SidePanel>
  );
};
