import React, { useState } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { getCohort, updateCohort } from '../api/learning';
import { Cohort, Role } from '../api/types';
import { listDirectory } from '../api/users';
import { HealthBadge } from '../components/learning/LearningParts';
import { useProjectOptions } from '../components/learning/programs/ProgramForms';
import { ErrorState, LoadingState, NoAccess } from '../components/ui/AsyncState';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Table, TableRow } from '../components/ui/Table';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDay } from '../lib/learning';
import { useDetailTitle } from '../lib/pageTitle';
import { nameAndTitle } from '../lib/people';
import { Link, navigate } from '../lib/router';
import { useApiQuery } from '../lib/useApiQuery';
import { formatDateTime } from '../lib/wat';

const MENTOR_ROLES: readonly Role[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'TEAM_LEAD'];

const EditProgram: React.FC<{ cohort: Cohort; onClose: () => void; onSaved: (cohort: Cohort) => void }> = ({
  cohort,
  onClose,
  onSaved,
}) => {
  const toast = useToast();
  const people = useApiQuery((signal) => listDirectory('', '', signal), [], 'directory:all');
  const projectOptions = useProjectOptions();
  const [name, setName] = useState(cohort.name);
  const [mentorId, setMentorId] = useState(cohort.mentor.id);
  const [projectId, setProjectId] = useState(cohort.project?.id ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const learnerIds = cohort.learners.map(({ learner }) => learner.id);
  const mentorOptions = (people.data ?? [])
    .filter(({ id, role }) => MENTOR_ROLES.includes(role) && !learnerIds.includes(id))
    .map((person) => ({ value: person.id, label: nameAndTitle(person) }));
  if (!mentorOptions.some(({ value }) => value === cohort.mentor.id)) {
    mentorOptions.unshift({ value: cohort.mentor.id, label: cohort.mentor.name });
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      onSaved(
        await updateCohort(cohort.id, {
          ...(name.trim() !== cohort.name && { name: name.trim() }),
          ...(mentorId !== cohort.mentor.id && { mentorId }),
          ...(projectId !== (cohort.project?.id ?? '') && projectId && { projectId }),
        }),
      );
      toast.success('Program saved.');
    } catch (error) {
      setIsSaving(false);
      toast.error(errorMessage(error));
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Edit program" description="Learners and the build mode stay as they started.">
      <form onSubmit={save} noValidate className="contents">
        <ModalBody className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select
            label="Mentor"
            value={mentorId}
            options={mentorOptions}
            helperText="A new mentor takes over every learner in the program."
            onChange={(e) => setMentorId(e.target.value)}
          />
          <Select
            label="Project"
            value={projectId}
            options={projectOptions}
            helperText="Learners join the new project, and stay on the old one."
            onChange={(e) => setProjectId(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving} disabled={!name.trim()}>
            Save program
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export const ProgramView: React.FC<{ programId: string }> = ({ programId }) => {
  const { can } = useSession();
  const query = useApiQuery((signal) => getCohort(programId, signal), [programId], 'learning:cohort');
  const [isEditing, setIsEditing] = useState(false);
  const cohort = query.data;
  useDetailTitle(cohort?.name);

  if (query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 400)) {
    return (
      <NoAccess
        title="This program isn't yours to see"
        description="Only its learners, its mentor and whoever runs it can open it."
        backTo="/learning?tab=programs"
        backLabel="Back to programs"
      />
    );
  }
  if (query.error) {
    return <ErrorState title="Couldn't load this program" message={errorMessage(query.error)} onRetry={query.reload} />;
  }
  if (!cohort) return <LoadingState label="Loading the program…" />;

  const isTeam = cohort.submissionMode === 'TEAM';

  return (
    <>
      <Link to="/learning?tab=programs" className="inline-flex items-center gap-1 text-small font-semibold mb-3">
        <Icon name="arrow_back" size="sm" />
        Programs
      </Link>
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="min-w-0 grow basis-60">
          <h1 className="t-h1 break-words">{cohort.name}</h1>
          <p className="text-text-2">
            {cohort.track.title} · Mentor: {cohort.mentor.name} · From {formatDay(cohort.startDate)} ·{' '}
            {isTeam ? 'Team build' : 'Individual builds'}
            {cohort.project && (
              <>
                {' · '}
                <Link to={`/projects/${cohort.project.id}`}>{cohort.project.name}</Link>
              </>
            )}
          </p>
        </div>
        {can('createTrack') && (
          <Button variant="secondary" icon="edit" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      <div className="card overflow-hidden mb-5">
        <Table caption="Learners in this program" className="table-pin-first">
          <thead>
            <tr>
              <th scope="col">Learner</th>
              <th scope="col">Progress</th>
              <th scope="col">Learning</th>
              <th scope="col">Build</th>
              <th scope="col">Health</th>
            </tr>
          </thead>
          <tbody>
            {cohort.learners.map(({ enrollmentId, learner, progress }) => (
              <TableRow key={enrollmentId} onOpen={() => navigate(`/learning/enrollments/${enrollmentId}`)}>
                <td>
                  <span className="flex items-center gap-2 w-[13rem]">
                    <Avatar name={learner.name} id={learner.id} avatar={learner.avatar} size="sm" />
                    <Link to={`/learning/enrollments/${enrollmentId}`} className="font-semibold text-text truncate">
                      {learner.name}
                    </Link>
                  </span>
                </td>
                <td className="whitespace-nowrap">{progress.percentComplete}%</td>
                <td className="whitespace-nowrap">{progress.learningDone ? 'Done' : 'In progress'}</td>
                <td className="whitespace-nowrap">{progress.buildUnlocked ? 'Unlocked' : 'Locked'}</td>
                <td>
                  <HealthBadge health={progress.health} />
                </td>
              </TableRow>
            ))}
          </tbody>
        </Table>
      </div>

      {isTeam && (
        <Card className="card-pad">
          <h2 className="t-h3 mb-3">The team's build</h2>
          {cohort.teamSubmissions?.length ? (
            <ul className="space-y-4">
              {cohort.teamSubmissions.map(({ item, submission }) => (
                <li key={item.id}>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-small text-text-2">
                    Sent by {submission.submittedBy?.name ?? 'the team'}, {formatDateTime(new Date(submission.submittedAt))}
                    {submission.decision &&
                      ` · ${submission.decision === 'APPROVED' ? 'Approved' : 'Changes requested'}`}
                  </p>
                  {submission.repoUrl && (
                    <a href={submission.repoUrl} target="_blank" rel="noopener noreferrer" className="block break-all">
                      {submission.repoUrl}
                    </a>
                  )}
                  {submission.liveUrl && (
                    <a href={submission.liveUrl} target="_blank" rel="noopener noreferrer" className="block break-all">
                      {submission.liveUrl}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-2">Nothing sent yet. One submission counts for the whole team.</p>
          )}
        </Card>
      )}

      {isEditing && (
        <EditProgram
          cohort={cohort}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            query.reload();
          }}
        />
      )}
    </>
  );
};
