import React, { useState } from 'react';
import { errorMessage } from '../api/client';
import { createTrack, getEnrollment, listEnrollments, listReviews, listTracks } from '../api/learning';
import { Enrollment, LearningHealth, ReviewRequest, TrackStatus } from '../api/types';
import { EnrollDialog } from '../components/learning/EnrollDialog';
import { ItemPanel } from '../components/learning/ItemPanel';
import { EnrollmentCard, HealthBadge } from '../components/learning/LearningParts';
import { AsyncState } from '../components/ui/AsyncState';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { Modal, ModalBody, ModalFooter } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { SidePanel } from '../components/ui/SidePanel';
import { Table, TableRow } from '../components/ui/Table';
import { Tabs } from '../components/ui/Tabs';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { byHealth, HEALTH_LABELS } from '../lib/learning';
import { Link, navigate, useSearch } from '../lib/router';
import { useApiQuery } from '../lib/useApiQuery';
import { useMediaQuery } from '../lib/useMediaQuery';
import { formatDayMonth, formatDateTime } from '../lib/wat';

type Tab = 'mine' | 'reviews' | 'learners' | 'all' | 'tracks';

const TRACK_STATUS: Record<TrackStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const HEALTH_FILTER = [
  { value: '', label: 'All learners' },
  ...(Object.keys(HEALTH_LABELS) as LearningHealth[]).map((value) => ({
    value,
    label: HEALTH_LABELS[value],
  })),
];

const MyLearning: React.FC<{ query: ReturnType<typeof useApiQuery<Enrollment[]>> }> = ({ query }) => (
  <AsyncState
    query={query}
    loadingLabel="Loading your learning…"
    errorTitle="Couldn't load your learning"
    isEmpty={(enrollments) => enrollments.length === 0}
    empty={
      <EmptyState
        icon="fact_check"
        title="No learning yet"
        description="When you're enrolled on a track, it shows up here."
      />
    }
  >
    {(enrollments) => (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {enrollments.map((enrollment) => (
          <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
        ))}
      </div>
    )}
  </AsyncState>
);

/** Loads the whole enrollment, so a reviewer sees the instructions and earlier feedback. */
const ReviewPanel: React.FC<{
  request: ReviewRequest;
  onClose: () => void;
  onChanged: () => void;
}> = ({ request, onClose, onChanged }) => {
  const query = useApiQuery(
    (signal) => getEnrollment(request.enrollmentId, signal),
    [request.enrollmentId],
  );
  const item = query.data?.modules
    .flatMap(({ items }) => items)
    .find(({ id }) => id === request.itemId);

  if (query.data && item) {
    return (
      <ItemPanel
        enrollment={query.data}
        item={item}
        isLearner={false}
        canReview
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }
  return (
    <SidePanel isOpen onClose={onClose} title={request.item.title}>
      <AsyncState query={query} loadingLabel="Loading the submission…">
        {() => <p className="text-text-2">This item is no longer on the track.</p>}
      </AsyncState>
    </SidePanel>
  );
};

const ReviewQueue: React.FC = () => {
  const query = useApiQuery((signal) => listReviews(signal), [], 'learning:reviews');
  const [opened, setOpened] = useState<ReviewRequest | null>(null);

  return (
    <>
      <AsyncState
        query={query}
        loadingLabel="Loading submissions…"
        errorTitle="Couldn't load the review queue"
        isEmpty={(requests) => requests.length === 0}
        empty={
          <EmptyState
            icon="check_circle"
            title="Nothing waiting for review"
            description="New submissions show up here, oldest first."
          />
        }
      >
        {(requests) => (
          <ul className="card divide-y divide-border">
            {requests.map((request) => (
              <li key={request.id}>
                <button
                  type="button"
                  onClick={() => setOpened(request)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 cursor-pointer text-text hover:bg-surface-2"
                >
                  <Avatar name={request.learner.name} id={request.learner.id} avatar={request.learner.avatar} />
                  <span className="min-w-0 grow">
                    <span className="block font-semibold truncate">{request.item.title}</span>
                    <span className="block text-small text-text-2 truncate">
                      {request.learner.name} · {request.track.title}
                    </span>
                  </span>
                  <span className="hidden sm:block text-small text-text-2 whitespace-nowrap">
                    {formatDateTime(new Date(request.submittedAt))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </AsyncState>

      {opened && (
        <ReviewPanel
          request={opened}
          onClose={() => setOpened(null)}
          onChanged={() => {
            setOpened(null);
            query.reload();
          }}
        />
      )}
    </>
  );
};

const lastActivity = ({ progress }: Enrollment) =>
  progress.lastActivityAt ? formatDayMonth(new Date(progress.lastActivityAt), false) : 'None yet';

const LearnerCards: React.FC<{ enrollments: Enrollment[] }> = ({ enrollments }) => (
  <ul className="space-y-3">
    {enrollments.map((enrollment) => {
      const { id, learner, track, progress } = enrollment;
      return (
        <li key={id}>
          <Link
            to={`/learning/enrollments/${id}`}
            className="card card-pad block text-text hover:no-underline"
          >
            <div className="flex items-center gap-3">
              <Avatar name={learner.name} id={learner.id} avatar={learner.avatar} />
              <div className="min-w-0 grow">
                <p className="font-semibold truncate">{learner.name}</p>
                <p className="text-small text-text-2 truncate">{track.title}</p>
              </div>
              <HealthBadge health={progress.health} />
            </div>
            <div className="bar mt-3">
              <i style={{ width: `${progress.percentComplete}%` }} />
            </div>
            <p className="mt-2 text-small text-text-2">
              {progress.percentComplete}% · Score {progress.averageScore ?? 'none'} ·{' '}
              {progress.awaitingReview} awaiting review · Active {lastActivity(enrollment)}
            </p>
          </Link>
        </li>
      );
    })}
  </ul>
);

const LearnerTable: React.FC<{ enrollments: Enrollment[] }> = ({ enrollments }) => (
  <div className="card overflow-hidden">
    <Table caption="Learners">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Position</th>
          <th scope="col">Track</th>
          <th scope="col">Progress</th>
          <th scope="col">Health</th>
          <th scope="col">Average score</th>
          <th scope="col">Awaiting review</th>
          <th scope="col">Last activity</th>
        </tr>
      </thead>
      <tbody>
        {enrollments.map((enrollment) => {
          const { id, learner, track, progress } = enrollment;
          return (
            <TableRow key={id} onOpen={() => navigate(`/learning/enrollments/${id}`)}>
              <td>
                <Link
                  to={`/learning/enrollments/${id}`}
                  className="block font-semibold text-text truncate max-w-[12rem]"
                >
                  {learner.name}
                </Link>
              </td>
              <td className="text-text-2">
                <span className="block truncate max-w-[10rem]">
                  {learner.position?.name ?? 'Not set'}
                </span>
              </td>
              <td>
                <span className="block line-clamp-2 min-w-[10rem] max-w-[14rem]">{track.title}</span>
              </td>
              <td className="whitespace-nowrap">{progress.percentComplete}%</td>
              <td>
                <HealthBadge health={progress.health} />
              </td>
              <td>{progress.averageScore ?? '–'}</td>
              <td>{progress.awaitingReview}</td>
              <td className="text-text-2 whitespace-nowrap">{lastActivity(enrollment)}</td>
            </TableRow>
          );
        })}
      </tbody>
    </Table>
  </div>
);

const Learners: React.FC<{ scope: 'mentoring' | 'all'; tab: Tab }> = ({ scope, tab }) => {
  const search = useSearch();
  const health = (new URLSearchParams(search).get('health') ?? '') as LearningHealth | '';
  const isWide = useMediaQuery('(min-width: 1024px)');
  const query = useApiQuery(
    (signal) => listEnrollments(scope, health ? { health } : {}, signal),
    [scope, health],
    'learning:learners',
  );

  return (
    <>
      <div className="mb-4 sm:max-w-[14rem]">
        <Select
          label="Health"
          value={health}
          options={HEALTH_FILTER}
          onChange={(e) =>
            navigate(
              `/learning?tab=${tab}${e.target.value ? `&health=${e.target.value}` : ''}`,
              { replace: true },
            )
          }
        />
      </div>
      <AsyncState
        query={query}
        loadingLabel="Loading learners…"
        errorTitle="Couldn't load learners"
        isEmpty={(enrollments) => enrollments.length === 0}
        empty={
          health ? (
            <EmptyState
              icon="filter_list"
              title="Nobody matches this filter"
              description={`No learners are ${HEALTH_LABELS[health].toLowerCase()} right now.`}
            >
              <Button variant="secondary" onClick={() => navigate(`/learning?tab=${tab}`)}>
                Clear filter
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              icon="groups"
              title="No learners yet"
              description="People you enroll or mentor show up here."
            />
          )
        }
      >
        {(enrollments) => {
          const sorted = [...enrollments].sort(byHealth);
          return isWide ? <LearnerTable enrollments={sorted} /> : <LearnerCards enrollments={sorted} />;
        }}
      </AsyncState>
    </>
  );
};

const NewTrackModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give the track a title.');
      return;
    }
    setIsSaving(true);
    try {
      const { id } = await createTrack(title.trim());
      navigate(`/learning/tracks/${id}`);
    } catch (failure) {
      setIsSaving(false);
      toast.error(errorMessage(failure));
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="New track" description="It stays a draft until you publish it.">
      <form onSubmit={submit} noValidate className="contents">
        <ModalBody>
          <Input label="Title" value={title} error={error} onChange={(e) => setTitle(e.target.value)} />
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

const Tracks: React.FC = () => {
  const query = useApiQuery((signal) => listTracks(undefined, signal), [], 'learning:tracks');

  return (
    <AsyncState
      query={query}
      loadingLabel="Loading tracks…"
      errorTitle="Couldn't load tracks"
      isEmpty={(tracks) => tracks.length === 0}
      empty={
        <EmptyState
          icon="menu_book"
          title="No tracks yet"
          description="Create a track to give new people a clear path."
        />
      }
    >
      {(tracks) => (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tracks.map((track) => {
            const items = track.modules.flatMap((module) => module.items);
            return (
              <li key={track.id}>
                <Link
                  to={`/learning/tracks/${track.id}`}
                  className="card card-pad block text-text hover:no-underline"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="t-h3 min-w-0 truncate">{track.title}</h2>
                    <span className="chip pointer-events-none shrink-0">
                      {TRACK_STATUS[track.status]}
                    </span>
                  </div>
                  {track.description && (
                    <p className="mt-1 text-small text-text-2 truncate">{track.description}</p>
                  )}
                  <p className="mt-3 text-small text-text-2">
                    {track.skills.length} skills · {track.modules.length} modules ·{' '}
                    {items.filter(({ isArchived }) => !isArchived).length} items
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AsyncState>
  );
};

export const LearningView: React.FC = () => {
  const { can } = useSession();
  const search = useSearch();
  const isReviewer = can('createTrack');
  const mine = useApiQuery((signal) => listEnrollments('mine', {}, signal), [], 'learning:mine');
  const hasOwn = (mine.data?.length ?? 0) > 0;
  const showMine = !isReviewer || hasOwn;

  const tabs: { value: Tab; label: string }[] = [
    ...(showMine ? [{ value: 'mine' as const, label: 'My learning' }] : []),
    ...(isReviewer
      ? [
          { value: 'reviews' as const, label: 'Review queue' },
          { value: 'learners' as const, label: 'My learners' },
          ...(can('manageAllLearning') ? [{ value: 'all' as const, label: 'All learners' }] : []),
          { value: 'tracks' as const, label: 'Tracks' },
        ]
      : []),
  ];

  const requested = new URLSearchParams(search).get('tab') as Tab | null;
  const tab = tabs.find(({ value }) => value === requested)?.value ?? tabs[0].value;

  const [isCreating, setIsCreating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <PageHeader
        title="Learning"
        description="Structured tracks with mentor reviews."
        actions={
          isReviewer && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setIsEnrolling(true)}>
                Enroll learners
              </Button>
              <Button icon="add" onClick={() => setIsCreating(true)}>
                New track
              </Button>
            </div>
          )
        }
      />

      {tabs.length > 1 && (
        <div className="mb-5">
          <Tabs
            label="Learning views"
            tabs={tabs}
            value={tab}
            onChange={(value) => navigate(`/learning?tab=${value}`, { replace: true })}
          />
        </div>
      )}

      <div key={refreshKey}>
        {tab === 'mine' && <MyLearning query={mine} />}
        {tab === 'reviews' && <ReviewQueue />}
        {tab === 'learners' && <Learners scope="mentoring" tab="learners" />}
        {tab === 'all' && <Learners scope="all" tab="all" />}
        {tab === 'tracks' && <Tracks />}
      </div>

      {isCreating && <NewTrackModal onClose={() => setIsCreating(false)} />}
      {isEnrolling && (
        <EnrollDialog
          onClose={() => setIsEnrolling(false)}
          onEnrolled={() => {
            setIsEnrolling(false);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}
    </>
  );
};
