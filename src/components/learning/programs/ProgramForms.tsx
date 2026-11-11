import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../../api/client';
import { createCohort, createTrackFromTemplate, listCourses, listTracks } from '../../../api/learning';
import { listAllProjects } from '../../../api/projects';
import { Cohort, MAX_LEARNERS, PersonRef, Role, SubmissionMode, Track } from '../../../api/types';
import { listDirectory } from '../../../api/users';
import { useSession } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { nameAndTitle } from '../../../lib/people';
import { useApiQuery } from '../../../lib/useApiQuery';
import { watDate } from '../../../lib/wat';
import { MultiAssigneePicker } from '../../tasks/MultiAssigneePicker';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Input } from '../../ui/Input';
import { Modal, ModalBody, ModalFooter } from '../../ui/Modal';
import { Select } from '../../ui/Select';
import { Textarea } from '../../ui/Textarea';

const MENTOR_ROLES: readonly Role[] = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'TEAM_LEAD'];
export const MODES = [
  { value: 'INDIVIDUAL', label: 'Individual: everyone builds their own' },
  { value: 'TEAM', label: 'Team: one build for the whole group' },
];

function useMentorOptions(exclude: string[]) {
  const people = useApiQuery((signal) => listDirectory('', '', signal), [], 'directory:all');
  return {
    isLoaded: Boolean(people.data),
    options: [
      { value: '', label: 'Choose a mentor' },
      ...(people.data ?? [])
        .filter(({ id, role }) => MENTOR_ROLES.includes(role) && !exclude.includes(id))
        .map((person) => ({ value: person.id, label: nameAndTitle(person) })),
    ],
  };
}

export function useProjectOptions(noneLabel = 'No project') {
  const projects = useApiQuery((signal) => listAllProjects(signal), [], 'projects');
  return [
    { value: '', label: noneLabel },
    ...(projects.data ?? []).map(({ id, name }) => ({ value: id, label: name })),
  ];
}

interface ProgramFormProps {
  /** Starts on this track, such as one just made with Quick setup. */
  track?: Track;
  onClose: () => void;
  onCreated: (cohort: Cohort) => void;
}

/** A program: one track run for a group, all enrolled at once, with a shared mentor. */
export const ProgramForm: React.FC<ProgramFormProps> = ({ track, onClose, onCreated }) => {
  const { user, can } = useSession();
  const toast = useToast();
  const tracks = useApiQuery((signal) => listTracks('PUBLISHED', signal), [], 'learning:tracks:published');
  const projectOptions = useProjectOptions();
  const [name, setName] = useState('');
  const [trackId, setTrackId] = useState(track?.id ?? '');
  const [learners, setLearners] = useState<PersonRef[]>([]);
  const [mentorId, setMentorId] = useState('');
  const [startDate, setStartDate] = useState(() => watDate());
  // A track just made with Learn then build already says how it's built, and where.
  const build = track?.modules.flatMap(({ items }) => items).find(({ type }) => type === 'BUILD');
  const [projectId, setProjectId] = useState(build?.projectId ?? '');
  const [mode, setMode] = useState<SubmissionMode>(build?.submissionMode ?? 'INDIVIDUAL');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const mentors = useMentorOptions(learners.map(({ id }) => id));

  const enrollable = [
    ...(track && !tracks.data?.some(({ id }) => id === track.id) ? [track] : []),
    ...(tracks.data ?? []),
  ].filter(({ createdBy }) => can('manageAllLearning') || createdBy.id === user.id);
  const trackOptions = [
    { value: '', label: 'Choose a published track' },
    ...enrollable.map(({ id, title }) => ({ value: id, label: title })),
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problems: Record<string, string> = {};
    if (!name.trim()) problems.name = 'Name the program, such as Frontend interns, December.';
    if (!trackId) problems.track = 'Choose a track.';
    if (learners.length === 0) problems.learners = 'Choose at least one learner.';
    if (!mentorId) problems.mentor = 'Choose a mentor.';
    setErrors(problems);
    setFailure(null);
    if (Object.keys(problems).length) return;
    setIsSaving(true);
    try {
      const cohort = await createCohort({
        name: name.trim(),
        trackId,
        mentorId,
        learnerIds: learners.map(({ id }) => id),
        startDate,
        submissionMode: mode,
        ...(projectId && { projectId }),
      });
      toast.success(`${cohort.name} has started with ${cohort.learners.length} ${cohort.learners.length === 1 ? 'learner' : 'learners'}.`);
      onCreated(cohort);
    } catch (error) {
      setIsSaving(false);
      setFailure(
        error instanceof ApiError && error.code === 'ALREADY_ENROLLED'
          ? `${error.message} Nobody was enrolled. Remove them and try again.`
          : errorMessage(error),
      );
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="New program" description="Everyone is enrolled at once, all or nothing.">
      <form onSubmit={submit} noValidate className="contents">
        <ModalBody className="space-y-4">
          {failure && <Banner>{failure}</Banner>}
          <Input label="Name" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
          <Select label="Track" value={trackId} options={trackOptions} error={errors.track} onChange={(e) => setTrackId(e.target.value)} />
          <MultiAssigneePicker
            label="Learners"
            limit={MAX_LEARNERS}
            limitNote={`A program can start with up to ${MAX_LEARNERS} people.`}
            value={learners}
            onChange={setLearners}
            error={errors.learners}
          />
          <Select
            label="Mentor"
            value={mentorId}
            options={mentors.options}
            disabled={!mentors.isLoaded}
            error={errors.mentor}
            onChange={(e) => setMentorId(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Select label="Project" optional value={projectId} options={projectOptions} onChange={(e) => setProjectId(e.target.value)} />
          </div>
          <Select
            label="Builds"
            value={mode}
            options={MODES}
            helperText="This can't be changed once the program starts."
            onChange={(e) => setMode(e.target.value as SubmissionMode)}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Start program
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

/** "Learn then build" in one form: courses spread over the learning weeks, then one build. */
export const QuickSetupModal: React.FC<{ onClose: () => void; onCreated: (track: Track) => void }> = ({
  onClose,
  onCreated,
}) => {
  const toast = useToast();
  const courses = useApiQuery((signal) => listCourses({}, signal), [], 'learning:courses');
  const projectOptions = useProjectOptions('No project yet');
  const [title, setTitle] = useState('');
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [learnWeeks, setLearnWeeks] = useState('2');
  const [buildWeeks, setBuildWeeks] = useState('2');
  const [brief, setBrief] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [projectId, setProjectId] = useState('');
  const [mode, setMode] = useState<SubmissionMode>('INDIVIDUAL');
  const [skills, setSkills] = useState('');
  const [lock, setLock] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const skillList = skills.split(',').map((skill) => skill.trim()).filter(Boolean);
    const problems: Record<string, string> = {};
    if (!title.trim()) problems.title = 'Give the track a title.';
    if (courseIds.length === 0) problems.courses = 'Choose at least one course to learn from.';
    if (!brief.trim()) problems.brief = 'Say what they should build.';
    if (!deliverables.trim()) problems.deliverables = 'Say what they should hand in.';
    if (skillList.length < 2) problems.skills = 'Name at least 2 skills, separated by commas.';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setIsSaving(true);
    try {
      const track = await createTrackFromTemplate({
        title: title.trim(),
        courseIds,
        learnWeeks: Number(learnWeeks) || 1,
        build: {
          brief: brief.trim(),
          deliverables: deliverables.trim(),
          submissionMode: mode,
          buildWeeks: Number(buildWeeks) || 1,
          ...(projectId && { projectId }),
        },
        skills: skillList,
        lockBuildUntilLearningDone: lock,
      });
      toast.success(`${track.title} is ready. Now choose who's on it.`);
      onCreated(track);
    } catch (error) {
      setIsSaving(false);
      toast.error(errorMessage(error));
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Learn then build" description="Makes a published track: a Learn module, then a Build module.">
      <form onSubmit={submit} noValidate className="contents">
        <ModalBody className="space-y-4">
          <Input label="Track title" value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
          <fieldset className="border-0 p-0 m-0">
            <legend className="label">Courses to learn from</legend>
            <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border border-border p-3">
              {(courses.data ?? []).map((course) => (
                <Checkbox
                  key={course.id}
                  label={`${course.title} (${course.provider})`}
                  checked={courseIds.includes(course.id)}
                  onChange={(e) =>
                    setCourseIds((ids) => (e.target.checked ? [...ids, course.id] : ids.filter((id) => id !== course.id)))
                  }
                />
              ))}
              {courses.data?.length === 0 && <p className="text-text-2">Add courses to the library first.</p>}
            </div>
            {errors.courses && <p className="text-small text-danger mt-1">{errors.courses}</p>}
          </fieldset>
          <div className="grid gap-4 grid-cols-2">
            <Input label="Weeks to learn" type="number" min={1} value={learnWeeks} onChange={(e) => setLearnWeeks(e.target.value)} />
            <Input label="Weeks to build" type="number" min={1} value={buildWeeks} onChange={(e) => setBuildWeeks(e.target.value)} />
          </div>
          <Textarea label="What to build" rows={3} value={brief} error={errors.brief} onChange={(e) => setBrief(e.target.value)} />
          <Textarea
            label="Deliverables"
            rows={2}
            placeholder="A code link, a live link and a short demo."
            value={deliverables}
            error={errors.deliverables}
            onChange={(e) => setDeliverables(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Project" optional value={projectId} options={projectOptions} onChange={(e) => setProjectId(e.target.value)} />
            <Select label="Builds" value={mode} options={MODES} onChange={(e) => setMode(e.target.value as SubmissionMode)} />
          </div>
          <Input
            label="Skills"
            value={skills}
            error={errors.skills}
            helperText="At least 2, separated by commas, such as React, Next.js."
            onChange={(e) => setSkills(e.target.value)}
          />
          <Checkbox label="Unlock the build only once the learning is done" checked={lock} onChange={(e) => setLock(e.target.checked)} />
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving}>
            Create track
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};
