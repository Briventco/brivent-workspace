import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { completeResource, getCohort, reviewSubmission, submitAssignment } from '../../api/learning';
import { COURSE_STATUS_LABELS, isHttps } from '../../lib/courses';
import { Link } from '../../lib/router';
import { useApiQuery } from '../../lib/useApiQuery';
import { Banner } from '../ui/Banner';
import { EnrollmentDetail, EnrollmentItem, ReviewDecision, Submission } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { dueText } from '../../lib/learning';
import { formatDateTime } from '../../lib/wat';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/Input';
import { SidePanel } from '../ui/SidePanel';
import { Textarea } from '../ui/Textarea';
import { ItemStatusBadge, ScorePicker } from './LearningParts';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h3 className="t-over text-text-2 mb-1.5">{title}</h3>
    {children}
  </section>
);

const SubmissionDetails: React.FC<{ submission: Submission; attempts: number }> = ({
  submission,
  attempts,
}) => {
  const { link, note, submittedAt, feedback, decision, score, reviewedBy, reviewedAt } = submission;
  const title = attempts > 1 ? `Latest submission · attempt ${attempts}` : 'Submission';

  return (
    <>
      <Section title={title}>
        <p className="text-small text-text-2 mb-1">
          {formatDateTime(new Date(submittedAt))}
          {submission.isTeamSubmission && submission.submittedBy && ` · Sent by ${submission.submittedBy.name} for the team`}
        </p>
        {[submission.repoUrl, submission.liveUrl].filter(Boolean).map((url) => (
          <a key={url} href={url!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 break-all mb-1">
            <Icon name={url === submission.repoUrl ? 'code' : 'open_in_new'} size="sm" />
            {url}
          </a>
        ))}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all mb-1"
          >
            <Icon name="link" size="sm" />
            {link}
          </a>
        )}
        <p className="whitespace-pre-wrap break-words">{note}</p>
      </Section>

      {decision && (
        <Section title="Feedback">
          <div className="rounded-lg border border-border p-3">
            <p className="font-semibold">
              {decision === 'APPROVED' ? 'Approved' : 'Changes requested'}
              {score !== null && <span className="font-normal text-text-2"> · Score {score} of 5</span>}
            </p>
            {feedback && <p className="mt-1 whitespace-pre-wrap break-words">{feedback}</p>}
            {submission.memberReviews.map((member) => (
              <p key={member.learner.id} className="mt-1 text-small">
                <span className="font-semibold">{member.learner.name}</span>
                {member.score !== null && ` · ${member.score} of 5`}
                {member.note && `: ${member.note}`}
              </p>
            ))}
            <p className="mt-1 text-small text-text-2">
              {reviewedBy?.name}
              {reviewedAt && `, ${formatDateTime(new Date(reviewedAt))}`}
            </p>
          </div>
        </Section>
      )}
    </>
  );
};

const SubmitForm: React.FC<{
  enrollmentId: string;
  item: EnrollmentItem;
  onDone: () => void;
}> = ({ enrollmentId, item, onDone }) => {
  const toast = useToast();
  const isResubmit = item.status === 'CHANGES_REQUESTED';
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ link?: string; note?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = link.trim();
    const problems = {
      link: url && !isHttps(url) ? 'Use a full https link.' : undefined,
      note: note.trim() ? undefined : 'Add a short note for your reviewer.',
    };
    setErrors(problems);
    if (problems.link || problems.note) return;

    setIsSaving(true);
    try {
      await submitAssignment(enrollmentId, item.id, { link: url || null, note: note.trim() });
      toast.success(isResubmit ? 'Resubmitted for review.' : 'Submitted for review.');
      onDone();
    } catch (error) {
      setIsSaving(false);
      if (error instanceof ApiError && error.fieldErrors.link) {
        setErrors({ link: error.fieldErrors.link });
      } else {
        toast.error(errorMessage(error));
      }
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Input
        label="Link to your work"
        optional
        type="url"
        placeholder="https://"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        error={errors.link}
      />
      <Textarea
        label="Note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        error={errors.note}
      />
      <Button type="submit" isLoading={isSaving}>
        {isResubmit ? 'Resubmit' : 'Submit'}
      </Button>
    </form>
  );
};

const BuildForm: React.FC<{ enrollmentId: string; item: EnrollmentItem; isTeam: boolean; onDone: () => void }> = ({
  enrollmentId,
  item,
  isTeam,
  onDone,
}) => {
  const toast = useToast();
  const [repoUrl, setRepoUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ repo?: string; live?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const repo = repoUrl.trim();
    const live = liveUrl.trim();
    const problems = {
      repo: !repo ? 'Add the link to the code.' : !isHttps(repo) ? 'Use a full https link.' : undefined,
      live: live && !isHttps(live) ? 'Use a full https link.' : undefined,
    };
    setErrors(problems);
    if (problems.repo || problems.live) return;
    setIsSaving(true);
    try {
      await submitAssignment(enrollmentId, item.id, {
        repoUrl: repo,
        liveUrl: live || null,
        ...(note.trim() && { note: note.trim() }),
      });
      toast.success(isTeam ? 'Sent for the whole team.' : 'Sent for review.');
      onDone();
    } catch (error) {
      setIsSaving(false);
      toast.error(errorMessage(error));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      {isTeam && <p className="text-small text-text-2">One submission counts for the whole team.</p>}
      <Input label="Code link" type="url" placeholder="https://github.com/…" value={repoUrl} error={errors.repo} onChange={(e) => setRepoUrl(e.target.value)} />
      <Input label="Live link" optional type="url" placeholder="https://" value={liveUrl} error={errors.live} onChange={(e) => setLiveUrl(e.target.value)} />
      <Textarea label="Note" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" isLoading={isSaving}>
        {item.status === 'CHANGES_REQUESTED' ? 'Send again' : 'Send the build'}
      </Button>
    </form>
  );
};

/** A team build: an optional score and note for each person, which only they see. */
const MemberReviews: React.FC<{
  cohortId: string;
  value: Record<string, { score: number | null; note: string }>;
  onChange: (value: Record<string, { score: number | null; note: string }>) => void;
}> = ({ cohortId, value, onChange }) => {
  const cohort = useApiQuery((signal) => getCohort(cohortId, signal), [cohortId]);
  if (!cohort.data) return null;
  return (
    <fieldset className="border-0 p-0 m-0 space-y-3">
      <legend className="label">For each person (optional)</legend>
      {cohort.data.learners.map(({ learner }) => {
        const entry = value[learner.id] ?? { score: null, note: '' };
        return (
          <div key={learner.id} className="rounded-md border border-border p-3 space-y-2">
            <p className="font-semibold">{learner.name}</p>
            <ScorePicker
              label={`Score for ${learner.name}`}
              value={entry.score}
              onChange={(score) => onChange({ ...value, [learner.id]: { ...entry, score } })}
            />
            <Input
              label={`Note for ${learner.name}`}
              hideLabel
              placeholder="A note just for them"
              value={entry.note}
              onChange={(e) => onChange({ ...value, [learner.id]: { ...entry, note: e.target.value } })}
            />
          </div>
        );
      })}
    </fieldset>
  );
};

const ReviewForm: React.FC<{ submission: Submission; teamCohortId?: string; onDone: () => void }> = ({
  submission,
  teamCohortId,
  onDone,
}) => {
  const [members, setMembers] = useState<Record<string, { score: number | null; note: string }>>({});
  const toast = useToast();
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState<ReviewDecision | null>(null);

  const decide = async (decision: ReviewDecision) => {
    const text = feedback.trim();
    if (decision === 'CHANGES_REQUESTED' && !text) {
      setError('Say what needs to change.');
      return;
    }
    setError(undefined);
    setSaving(decision);
    try {
      const memberReviews = Object.entries(members)
        .filter(([, entry]) => entry.score !== null || entry.note.trim())
        .map(([learnerId, entry]) => ({
          learnerId,
          ...(entry.score !== null && { score: entry.score }),
          ...(entry.note.trim() && { note: entry.note.trim() }),
        }));
      await reviewSubmission(submission.id, {
        decision,
        ...(text && { feedback: text }),
        score,
        ...(memberReviews.length > 0 && { memberReviews }),
      });
      toast.success(decision === 'APPROVED' ? 'Approved.' : 'Changes requested.');
      onDone();
    } catch (failure) {
      setSaving(null);
      toast.error(errorMessage(failure));
    }
  };

  return (
    <Section title="Your review">
      <div className="space-y-3">
        <Textarea
          label="Feedback"
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          error={error}
          helperText="Needed when you request changes."
        />
        <div>
          <p className="label">
            Score <span className="font-normal text-text-2">(optional)</span>
          </p>
          <ScorePicker label="Score" value={score} onChange={setScore} />
        </div>
        {teamCohortId && <MemberReviews cohortId={teamCohortId} value={members} onChange={setMembers} />}
        <div className="flex flex-wrap gap-2">
          <Button
            icon="check"
            onClick={() => decide('APPROVED')}
            isLoading={saving === 'APPROVED'}
            disabled={saving !== null}
          >
            Approve
          </Button>
          <Button
            variant="secondary"
            onClick={() => decide('CHANGES_REQUESTED')}
            isLoading={saving === 'CHANGES_REQUESTED'}
            disabled={saving !== null}
          >
            Request changes
          </Button>
        </div>
      </div>
    </Section>
  );
};

interface ItemPanelProps {
  enrollment: EnrollmentDetail;
  item: EnrollmentItem;
  /** The person doing the track, who can act on the item. */
  isLearner: boolean;
  canReview: boolean;
  onClose: () => void;
  onChanged: () => void;
  /** Marks a resource done straight away, leaving the parent to confirm or roll back. */
  onMarkDone?: () => void;
}

export const ItemPanel: React.FC<ItemPanelProps> = ({
  enrollment,
  item,
  isLearner,
  canReview,
  onClose,
  onChanged,
  onMarkDone,
}) => {
  const toast = useToast();
  const [isCompleting, setIsCompleting] = useState(false);
  const isActive = enrollment.status === 'ACTIVE';
  const { type, title, instructions, resourceUrl, status, latestSubmission, attempts } = item;
  const isResource = type === 'RESOURCE';
  const isCourse = type === 'COURSE';
  const isBuild = type === 'BUILD';
  const teamCohortId =
    isBuild && enrollment.cohort?.submissionMode === 'TEAM' ? enrollment.cohort.id : undefined;

  const markDone = async () => {
    if (onMarkDone) {
      onMarkDone();
      return;
    }
    setIsCompleting(true);
    try {
      await completeResource(enrollment.id, item.id);
      toast.success('Marked as done.');
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsCompleting(false);
    }
  };

  const canSubmit =
    isLearner &&
    isActive &&
    !isResource &&
    !isCourse &&
    !item.isLocked &&
    ['NOT_STARTED', 'CHANGES_REQUESTED'].includes(status);
  const needsReview = canReview && isActive && status === 'SUBMITTED' && latestSubmission !== null;

  return (
    <SidePanel isOpen onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <ItemStatusBadge status={status} />
          <span className={`text-small ${item.isOverdue ? 'overdue' : 'text-text-2'}`}>
            {dueText(item.dueDate)}
            {item.isOverdue && ' · Overdue'}
          </span>
        </div>

        {instructions && (
          <Section title={isResource ? 'About this' : 'Instructions'}>
            <p className="whitespace-pre-wrap break-words">{instructions}</p>
          </Section>
        )}

        {isCourse && item.course && (
          <Section title="Course">
            <p className="font-semibold">{item.course.title}</p>
            <p className="text-small text-text-2 mb-2">
              {item.course.provider}
              {item.courseStatus && ` · ${COURSE_STATUS_LABELS[item.courseStatus]}`}
            </p>
            <Link to={`/learning/courses/${item.course.id}`} className="btn btn-secondary">
              Go to the course
            </Link>
            <p className="mt-2 text-small text-text-2">
              It's done here as soon as the course is: progress counts on every track that includes it.
            </p>
          </Section>
        )}

        {isBuild && (
          <>
            {item.brief && (
              <Section title="What to build">
                <p className="whitespace-pre-wrap break-words">{item.brief}</p>
              </Section>
            )}
            {item.deliverables && (
              <Section title="Deliverables">
                <p className="whitespace-pre-wrap break-words">{item.deliverables}</p>
              </Section>
            )}
            {item.project && (
              <p>
                In <Link to={`/projects/${item.project.id}`}>{item.project.name}</Link>
              </p>
            )}
            {item.isLocked && (
              <Banner tone="info">This build unlocks once the learning before it is done.</Banner>
            )}
          </>
        )}

        {resourceUrl && (
          <a
            href={resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <Icon name="link" size="sm" />
            Open link
          </a>
        )}

        {isResource && isLearner && isActive && status !== 'COMPLETED' && (
          <div>
            <Button icon="check" onClick={markDone} isLoading={isCompleting}>
              Mark as done
            </Button>
          </div>
        )}

        {latestSubmission && <SubmissionDetails submission={latestSubmission} attempts={attempts} />}

        {canSubmit && (
          <Section title={status === 'CHANGES_REQUESTED' ? 'Resubmit your work' : 'Submit your work'}>
            {isBuild ? (
              <BuildForm enrollmentId={enrollment.id} item={item} isTeam={Boolean(teamCohortId)} onDone={onChanged} />
            ) : (
              <SubmitForm enrollmentId={enrollment.id} item={item} onDone={onChanged} />
            )}
          </Section>
        )}

        {needsReview && (
          <ReviewForm submission={latestSubmission} teamCohortId={teamCohortId} onDone={onChanged} />
        )}
      </div>
    </SidePanel>
  );
};
