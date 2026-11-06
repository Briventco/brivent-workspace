import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { enroll, listTracks } from '../../api/learning';
import { MAX_LEARNERS, PersonRef, Role } from '../../api/types';
import { listDirectory } from '../../api/users';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { nameAndTitle } from '../../lib/people';
import { useApiQuery } from '../../lib/useApiQuery';
import { watDate } from '../../lib/wat';
import { MultiAssigneePicker } from '../tasks/MultiAssigneePicker';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Select } from '../ui/Select';

const MENTOR_ROLES: readonly Role[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'TEAM_LEAD'];

interface EnrollDialogProps {
  /** Starts on this track, from a track's own page. */
  trackId?: string;
  onClose: () => void;
  onEnrolled: () => void;
}

export const EnrollDialog: React.FC<EnrollDialogProps> = ({ trackId = '', onClose, onEnrolled }) => {
  const { user, can } = useSession();
  const toast = useToast();
  const tracks = useApiQuery((signal) => listTracks('PUBLISHED', signal), []);
  const people = useApiQuery((signal) => listDirectory('', '', signal), []);

  const [track, setTrack] = useState(trackId);
  const [learners, setLearners] = useState<PersonRef[]>([]);
  const [mentorId, setMentorId] = useState('');
  const [startDate, setStartDate] = useState(() => watDate());
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  // Team Leads can only enroll on tracks they made.
  const enrollable = (tracks.data ?? []).filter(
    ({ createdBy }) => can('manageAllLearning') || createdBy.id === user.id,
  );
  const trackOptions = [
    { value: '', label: 'Choose a published track' },
    ...enrollable.map(({ id, title }) => ({ value: id, label: title })),
  ];

  const learnerIds = learners.map(({ id }) => id);
  const mentorOptions = [
    { value: '', label: 'Choose a mentor' },
    ...(people.data ?? [])
      .filter(({ id, role }) => MENTOR_ROLES.includes(role) && !learnerIds.includes(id))
      .map((person) => ({ value: person.id, label: nameAndTitle(person) })),
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problems: Record<string, string> = {};
    if (!track) problems.track = 'Choose a track.';
    if (learners.length === 0) problems.learners = 'Choose at least one learner.';
    if (!mentorId) problems.mentor = 'Choose a mentor.';
    if (!startDate) problems.startDate = 'Choose a start date.';
    if (endDate && endDate < startDate) problems.endDate = "This can't be before the start date.";
    setErrors(problems);
    setFailure(undefined);
    if (Object.keys(problems).length > 0) return;

    setIsSaving(true);
    try {
      const created = await enroll({
        trackId: track,
        learnerIds,
        mentorId,
        startDate,
        targetEndDate: endDate || null,
      });
      toast.success(created.length === 1 ? 'Enrolled 1 learner.' : `Enrolled ${created.length} learners.`);
      onEnrolled();
    } catch (error) {
      setIsSaving(false);
      // All or nothing, so say that nobody was added, not just that one person clashed.
      setFailure(
        error instanceof ApiError && error.code === 'ALREADY_ENROLLED'
          ? `${error.message} Nobody was enrolled. Remove them and try again.`
          : errorMessage(error),
      );
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Enroll learners">
      <form onSubmit={submit} noValidate className="contents">
        <ModalBody className="space-y-4">
          {failure && <Banner>{failure}</Banner>}
          <Select
            label="Track"
            value={track}
            options={trackOptions}
            disabled={!tracks.data}
            error={errors.track}
            onChange={(e) => setTrack(e.target.value)}
          />
          <MultiAssigneePicker
            label="Learners"
            limit={MAX_LEARNERS}
            limitNote={`You can enroll up to ${MAX_LEARNERS} people at once.`}
            value={learners}
            onChange={setLearners}
            error={errors.learners}
          />
          <Select
            label="Mentor"
            value={mentorId}
            options={mentorOptions}
            disabled={!people.data}
            error={errors.mentor}
            onChange={(e) => setMentorId(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Start date"
              type="date"
              value={startDate}
              error={errors.startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Target end date"
              optional
              type="date"
              value={endDate}
              error={errors.endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Enroll
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
