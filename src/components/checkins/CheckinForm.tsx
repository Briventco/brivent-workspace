import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckinAnswers, saveTodayCheckin } from '../../api/checkins';
import { ApiError, errorMessage } from '../../api/client';
import { Checkin, Task } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { clearDraft, readDraft, writeDraft } from '../../lib/checkinDraft';
import { formatLongDate, formatTime, watDate, watMinutes } from '../../lib/wat';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { Card, CardFooter } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';
import { Textarea } from '../ui/Textarea';
import { Answer, BlockerBox, LateTag, LinkedTasks, Replies } from './CheckinParts';

const AUTOSAVE_MS = 3000;
const LATE_AFTER = 11 * 60;
const LOCKS_AT = 18 * 60;
const MAX_LENGTH = 5000;
const MAX_LINKED = 50;
const SUGGESTED = 4;

type ChipTask = Pick<Task, 'id' | 'title'>;

const toAnswers = (checkin: Checkin | null): CheckinAnswers => ({
  workCompleted: checkin?.workCompleted ?? '',
  priorities: checkin?.priorities ?? '',
  blockers: checkin?.blockers ?? '',
  taskIds: checkin?.linkedTasks.map((task) => task.id) ?? [],
});

const isSame = (a: CheckinAnswers, b: CheckinAnswers) => JSON.stringify(a) === JSON.stringify(b);

const StatusPill: React.FC<{ checkin: Checkin | null }> = ({ checkin }) => {
  if (!checkin) {
    return (
      <span className="badge bg-warning-bg text-warning">
        <Icon name="hourglass_top" size="sm" />
        Not submitted
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      {checkin.isLate && <LateTag />}
      <span className="badge st-done">
        <Icon name="check_circle" size="sm" filled />
        Submitted {formatTime(new Date(checkin.submittedAt))}
      </span>
    </span>
  );
};

/** Once locked it reads like a past check-in, with nothing left to fill in. */
const LockedCheckin: React.FC<{ checkin: Checkin; notice?: string }> = ({ checkin, notice }) => {
  const { user } = useSession();
  return (
    <Card>
      <div className="card-head">
        <div>
          <h2 className="t-h2">{formatLongDate()}</h2>
          <p className="text-small text-text-2">Locked at 6:00 PM</p>
        </div>
        <StatusPill checkin={checkin} />
      </div>
      <div className="card-pad space-y-3">
        {notice && <Banner tone="info">{notice}</Banner>}
        <Answer label="Finished yesterday">{checkin.workCompleted}</Answer>
        <Answer label="Today">{checkin.priorities}</Answer>
        {checkin.blockers && <BlockerBox checkin={checkin} />}
        <LinkedTasks checkin={checkin} />
        <Replies replies={checkin.replies} youId={user.id} />
      </div>
    </Card>
  );
};

interface CheckinFormProps {
  checkin: Checkin | null;
  tasks: Task[];
  onSaved: (checkin: Checkin) => void;
}

export const CheckinForm: React.FC<CheckinFormProps> = ({ checkin, tasks, onSaved }) => {
  const { user } = useSession();
  const toast = useToast();
  const date = watDate();

  const [saved, setSaved] = useState(checkin);
  const baseline = useMemo(() => toAnswers(saved), [saved]);
  const [answers, setAnswers] = useState(() => readDraft(user.id, date) ?? toAnswers(checkin));
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<{ workCompleted?: string; priorities?: string; blockers?: string }>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLockedNow, setIsLockedNow] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  const chipTasks = useChipTasks(tasks, saved, answers.taskIds, showAllTasks);
  const hasMoreTasks = !showAllTasks && tasks.some((task) => !chipTasks.includes(task));
  const isDirty = !isSame(answers, baseline);
  const isLocked = isLockedNow || (saved !== null && !saved.editable);

  const answersRef = useRef(answers);
  answersRef.current = answers;

  const saveDraft = () => {
    writeDraft(user.id, date, answersRef.current);
    setDraftSavedAt(new Date());
  };

  useEffect(() => {
    if (!isDirty || isLocked) return;
    const timer = window.setTimeout(saveDraft, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
    // saveDraft only reads refs and stable values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, isDirty, isLocked]);

  const update = (field: 'workCompleted' | 'priorities' | 'blockers') => (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => setAnswers((current) => ({ ...current, [field]: e.target.value }));

  /** Choosing a task links it, and adds its name to today's plan if it isn't there yet. */
  const toggleTask = (task: { id: string; title: string }) => {
    setAnswers((current) => {
      if (current.taskIds.includes(task.id)) {
        return { ...current, taskIds: current.taskIds.filter((id) => id !== task.id) };
      }
      if (current.taskIds.length >= MAX_LINKED) return current;
      const hasName = current.priorities.includes(task.title);
      const priorities = hasName
        ? current.priorities
        : [current.priorities.trim(), task.title].filter(Boolean).join('\n');
      return { ...current, priorities, taskIds: [...current.taskIds, task.id] };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors = {
      workCompleted: answers.workCompleted.trim() ? undefined : 'Say what you finished yesterday.',
      priorities: answers.priorities.trim() ? undefined : "Say what you're working on today.",
    };
    setErrors(nextErrors);
    if (nextErrors.workCompleted || nextErrors.priorities) return;

    const wasSubmitted = saved !== null;
    setIsSubmitting(true);
    try {
      const result = await saveTodayCheckin({
        ...answers,
        workCompleted: answers.workCompleted.trim(),
        priorities: answers.priorities.trim(),
        blockers: answers.blockers.trim(),
      });
      clearDraft(user.id, date);
      setSaved(result);
      setAnswers(toAnswers(result));
      setDraftSavedAt(null);
      toast.success(wasSubmitted ? 'Check-in updated.' : 'Check-in submitted.');
      onSaved(result);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CHECKIN_LOCKED') {
        setIsLockedNow(true);
      } else if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const { workCompleted, priorities, blockers } = error.fieldErrors;
        setErrors({ workCompleted, priorities, blockers });
        if (!workCompleted && !priorities && !blockers) setFormError(errorMessage(error));
      } else {
        setFormError(`Couldn't save your check-in. Your text is still here. ${errorMessage(error)}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLocked && saved) {
    return (
      <LockedCheckin
        checkin={saved}
        notice={isLockedNow ? "It's past 6:00 PM, so your last changes weren't saved." : undefined}
      />
    );
  }

  const minutes = watMinutes();

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate>
        <div className="card-head">
          <div>
            <h2 className="t-h2">{formatLongDate()}</h2>
            <p className="text-small text-text-2">
              {minutes > LATE_AFTER ? 'Was due by 11:00 AM' : 'Due by 11:00 AM'}
              {draftSavedAt && ` · Draft saved ${formatTime(draftSavedAt)}`}
            </p>
          </div>
          <StatusPill checkin={saved} />
        </div>

        <div className="card-pad space-y-4">
          {formError && <Banner>{formError}</Banner>}

          <Textarea
            label="What did you finish yesterday?"
            value={answers.workCompleted}
            onChange={update('workCompleted')}
            error={errors.workCompleted}
            maxLength={MAX_LENGTH}
            rows={4}
          />

          <div>
            <Textarea
              label="What are you working on today?"
              value={answers.priorities}
              onChange={update('priorities')}
              error={errors.priorities}
              maxLength={MAX_LENGTH}
              rows={4}
            />
            {chipTasks.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-small text-text-2">Suggested from your tasks:</span>
                {chipTasks.map((task) => (
                  <Chip
                    key={task.id}
                    on={answers.taskIds.includes(task.id)}
                    onClick={() => toggleTask(task)}
                    className="max-w-full"
                  >
                    <span className="truncate">{task.title}</span>
                  </Chip>
                ))}
                {hasMoreTasks && (
                  <Button variant="ghost" size="sm" icon="add_link" onClick={() => setShowAllTasks(true)}>
                    Link a task
                  </Button>
                )}
              </div>
            )}
          </div>

          <div>
            <Textarea
              label="Anything blocking you?"
              optional
              value={answers.blockers}
              onChange={update('blockers')}
              error={errors.blockers}
              maxLength={MAX_LENGTH}
              rows={3}
              placeholder="Say who or what you need."
              className={answers.blockers.trim() ? 'has-blocker' : ''}
            />
            {answers.blockers.trim() && (
              <p className="mt-1.5 flex items-center gap-1.5 text-small text-danger">
                <Icon name="flag" size="sm" />
                Your lead will see this at the top of their review.
              </p>
            )}
          </div>

          {saved && <Replies replies={saved.replies} youId={user.id} />}
        </div>

        <CardFooter className="flex flex-wrap items-center gap-3">
          <p className="grow text-small text-text-2">
            {minutes >= LOCKS_AT
              ? "It's past 6:00 PM, so you can't edit this after submitting."
              : 'You can edit until 6:00 PM today.'}
          </p>
          <Button variant="ghost" onClick={saveDraft} className="hidden sm:inline-flex">
            Save draft
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
            {saved ? 'Update check-in' : 'Submit check-in'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

/**
 * Soonest deadlines first, always keeping anything already linked in view. That includes linked
 * tasks that have since finished, which aren't in the open list but can still be unlinked.
 */
function useChipTasks(
  tasks: Task[],
  saved: Checkin | null,
  linkedIds: string[],
  showAll: boolean,
): ChipTask[] {
  return useMemo(() => {
    const sorted = [...tasks].sort((a, b) =>
      (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'),
    );
    const open = sorted.filter(
      (task, index) => showAll || index < SUGGESTED || linkedIds.includes(task.id),
    );
    const finished = (saved?.linkedTasks ?? []).filter(
      (linked) => !tasks.some((task) => task.id === linked.id),
    );
    return [...open, ...finished];
  }, [tasks, saved, linkedIds, showAll]);
}
