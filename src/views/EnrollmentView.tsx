import React, { useState } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { getEnrollment, listSkillRatings, setEnrollmentStatus } from '../api/learning';
import { EnrollmentDetail, EnrollmentItem, RatingKind } from '../api/types';
import { ItemPanel } from '../components/learning/ItemPanel';
import {
  HealthBadge,
  ItemStatusBadge,
  ProgressRing,
  TrendArrow,
} from '../components/learning/LearningParts';
import { RateSkillsModal } from '../components/learning/RateSkillsModal';
import { SkillCharts } from '../components/learning/SkillChart';
import { ErrorState, LoadingState, NoAccess } from '../components/ui/AsyncState';
import { Button } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Icon } from '../components/ui/Icon';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { dueText, formatDay } from '../lib/learning';
import { Link } from '../lib/router';
import { useApiQuery } from '../lib/useApiQuery';

const ItemRow: React.FC<{ item: EnrollmentItem; onOpen: () => void }> = ({ item, onOpen }) => (
  <li>
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left bg-transparent border-0 cursor-pointer text-text hover:bg-surface-2"
    >
      <Icon
        name={item.type === 'RESOURCE' ? 'description' : 'edit_note'}
        size="sm"
        className="text-text-2"
      />
      <span className="min-w-0 grow basis-40">
        <span className="block font-semibold">{item.title}</span>
        <span className={`block text-small ${item.isOverdue ? 'overdue' : 'text-text-2'}`}>
          {item.type === 'RESOURCE' ? 'Resource' : 'Assignment'} · {dueText(item.dueDate)}
          {item.isOverdue && ' · Overdue'}
        </span>
      </span>
      <ItemStatusBadge status={item.status} />
    </button>
  </li>
);

const SkillsCard: React.FC<{
  enrollment: EnrollmentDetail;
  ratingKind: RatingKind | null;
  onRate: () => void;
}> = ({ enrollment, ratingKind, onRate }) => (
  <Card>
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
      <h2 className="t-h3">Skills</h2>
      {ratingKind && (
        <Button size="sm" variant="secondary" onClick={onRate}>
          {ratingKind === 'SELF' ? 'Rate myself' : 'Rate skills'}
        </Button>
      )}
    </div>
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Skill scores</caption>
        <thead>
          <tr>
            <th scope="col">Skill</th>
            <th scope="col">Mentor</th>
            <th scope="col">Self</th>
            <th scope="col">Trend</th>
          </tr>
        </thead>
        <tbody>
          {enrollment.progress.skills.map((skill) => (
            <tr key={skill.skillId}>
              <td className="font-semibold">{skill.name}</td>
              <td>{skill.latestMentorScore ?? '–'}</td>
              <td>{skill.latestSelfScore ?? '–'}</td>
              <td>
                <TrendArrow trend={skill.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);

const ReviewScores: React.FC<{ enrollment: EnrollmentDetail }> = ({ enrollment }) => {
  const reviewed = enrollment.modules
    .flatMap(({ items }) => items)
    .filter(({ latestSubmission }) => latestSubmission?.decision);

  return (
    <Card>
      <h2 className="t-h3 px-5 pt-4 pb-3">Review scores</h2>
      {reviewed.length === 0 ? (
        <p className="px-5 pb-4 text-text-2">Nothing reviewed yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {reviewed.map(({ id, title, attempts, latestSubmission }) => (
            <li key={id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="min-w-0 grow">
                <span className="block font-semibold truncate">{title}</span>
                <span className="block text-small text-text-2">
                  {attempts === 1 ? '1 attempt' : `${attempts} attempts`}
                </span>
              </span>
              <span className="font-semibold whitespace-nowrap">
                {latestSubmission?.score ? `${latestSubmission.score} of 5` : 'No score'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

type StatusAction = 'PAUSED' | 'ACTIVE' | 'WITHDRAWN';

export const EnrollmentView: React.FC<{ enrollmentId: string }> = ({ enrollmentId }) => {
  const { user, can } = useSession();
  const toast = useToast();
  const query = useApiQuery((signal) => getEnrollment(enrollmentId, signal), [enrollmentId]);
  const enrollment = query.data;

  const isLearner = enrollment?.learner.id === user.id;
  const canReview =
    !isLearner && (enrollment?.mentor.id === user.id || can('reviewAllLearning'));
  const isOverseeing = !isLearner;

  const ratings = useApiQuery(
    (signal) =>
      enrollment && isOverseeing ? listSkillRatings(enrollmentId, signal) : Promise.resolve([]),
    [enrollmentId, Boolean(enrollment), isOverseeing],
  );

  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [confirming, setConfirming] = useState<StatusAction | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <NoAccess
        title="This learning record isn't yours to see"
        description="Only the learner, their mentor and managers can open it."
        backTo="/learning"
        backLabel="Back to learning"
      />
    );
  }
  if (query.error) {
    return (
      <ErrorState
        title="Couldn't load this track"
        message={errorMessage(query.error)}
        onRetry={query.reload}
      />
    );
  }
  if (!enrollment) return <LoadingState label="Loading progress…" />;

  const { track, learner, mentor, progress, modules, status } = enrollment;
  const items = modules.flatMap((module) => module.items);
  const openItem = items.find(({ id }) => id === openItemId);
  const ratingKind: RatingKind | null = isLearner ? 'SELF' : canReview ? 'MENTOR' : null;
  const canManage = can('manageAllLearning');
  const isFinished = status === 'COMPLETED' || status === 'WITHDRAWN';

  const changeStatus = async () => {
    if (!confirming) return;
    setIsChanging(true);
    try {
      await setEnrollmentStatus(enrollment.id, confirming);
      query.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsChanging(false);
      setConfirming(null);
    }
  };

  const reload = () => {
    query.reload();
    ratings.reload();
  };

  return (
    <>
      <Link to="/learning" className="inline-flex items-center gap-1 text-small font-semibold mb-3">
        <Icon name="arrow_back" size="sm" />
        Learning
      </Link>

      <div className="flex flex-wrap items-center gap-4 mb-5">
        <ProgressRing
          percent={progress.percentComplete}
          label={`${progress.percentComplete}% complete`}
        />
        <div className="min-w-0 grow basis-52">
          <h1 className="t-h1">{track.title}</h1>
          <p className="text-text-2">
            {isOverseeing ? `${learner.name} · ` : ''}Mentor: {mentor.name} · Started{' '}
            {formatDay(enrollment.startDate)}
            {enrollment.targetEndDate && ` · Target ${formatDay(enrollment.targetEndDate)}`}
          </p>
        </div>
        <HealthBadge health={progress.health} />
        {canManage && !isFinished && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfirming(status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')}
            >
              {status === 'PAUSED' ? 'Resume' : 'Pause'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming('WITHDRAWN')}>
              Withdraw
            </Button>
          </div>
        )}
      </div>

      {isOverseeing && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Items done" value={`${progress.itemsCompleted} / ${progress.itemsTotal}`} />
          <StatCard
            label="Average score"
            value={progress.averageScore ?? '–'}
            hint="Across reviewed attempts"
          />
          <StatCard label="Changes requested" value={progress.changesRequestedCount} />
          <StatCard
            label="Overdue"
            value={progress.overdueItems}
            attention={progress.overdueItems > 0}
          />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-5 min-w-0">
          {modules.map((module) => (
            <Card key={module.id}>
              <div className="px-5 pt-4 pb-3">
                <h2 className="t-h3">{module.title}</h2>
                {module.description && (
                  <p className="text-small text-text-2">{module.description}</p>
                )}
              </div>
              {module.items.length === 0 ? (
                <p className="px-5 pb-4 text-text-2">Nothing here yet.</p>
              ) : (
                <ul className="divide-y divide-border border-t border-border">
                  {module.items.map((item) => (
                    <ItemRow key={item.id} item={item} onOpen={() => setOpenItemId(item.id)} />
                  ))}
                </ul>
              )}
            </Card>
          ))}
          {isOverseeing && (
            <Card className="card-pad">
              <h2 className="t-h3 mb-3">Skill ratings over time</h2>
              {ratings.data ? (
                <SkillCharts skills={progress.skills} ratings={ratings.data} />
              ) : ratings.error ? (
                <ErrorState
                  title="Couldn't load ratings"
                  message={errorMessage(ratings.error)}
                  onRetry={ratings.reload}
                />
              ) : (
                <LoadingState label="Loading ratings…" />
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5 min-w-0">
          <SkillsCard
            enrollment={enrollment}
            ratingKind={ratingKind}
            onRate={() => setIsRating(true)}
          />
          {isOverseeing && <ReviewScores enrollment={enrollment} />}
        </div>
      </div>

      {openItem && (
        <ItemPanel
          enrollment={enrollment}
          item={openItem}
          isLearner={isLearner}
          canReview={canReview}
          onClose={() => setOpenItemId(null)}
          onChanged={() => {
            setOpenItemId(null);
            reload();
          }}
        />
      )}

      {isRating && ratingKind && (
        <RateSkillsModal
          enrollmentId={enrollment.id}
          kind={ratingKind}
          skills={progress.skills}
          onClose={() => setIsRating(false)}
          onSaved={() => {
            setIsRating(false);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirming !== null}
        title={
          confirming === 'WITHDRAWN'
            ? `Withdraw ${learner.name}?`
            : confirming === 'PAUSED'
              ? 'Pause this track?'
              : 'Resume this track?'
        }
        description={
          confirming === 'WITHDRAWN'
            ? "Their progress stays on record, but this can't be restarted."
            : confirming === 'PAUSED'
              ? 'They can read it, but can\'t complete items until it resumes.'
              : 'They can carry on where they left off.'
        }
        confirmLabel={
          confirming === 'WITHDRAWN' ? 'Withdraw' : confirming === 'PAUSED' ? 'Pause' : 'Resume'
        }
        confirmVariant={confirming === 'WITHDRAWN' ? 'danger' : 'primary'}
        isLoading={isChanging}
        onConfirm={changeStatus}
        onClose={() => setConfirming(null)}
      />
    </>
  );
};
