import React, { useState } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { listCourses, listMyCourses, reportVideoProgress, startCourse, submitCourseProof } from '../api/learning';
import { CourseProgress, CourseSummary } from '../api/types';
import { CourseFormModal } from '../components/learning/courses/CourseFormModal';
import { CourseStatusBadge } from '../components/learning/courses/CourseParts';
import { YouTubePlayer } from '../components/learning/courses/YouTubePlayer';
import { ErrorState, LoadingState, NoAccess } from '../components/ui/AsyncState';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isHttps, LEVEL_LABELS, PROOF_LABELS } from '../lib/courses';
import { useDetailTitle } from '../lib/pageTitle';
import { Link } from '../lib/router';
import { useApiQuery } from '../lib/useApiQuery';
import { formatDateTime } from '../lib/wat';

const SCREENSHOT_TYPES = 'image/jpeg,image/png,image/webp,image/heic';
const MAX_SCREENSHOT_BYTES = 15 * 1024 * 1024;

const ProofForm: React.FC<{ course: CourseSummary; isResubmit: boolean; onSent: (progress: CourseProgress) => void }> = ({
  course,
  isResubmit,
  onSent,
}) => {
  const toast = useToast();
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<number | null>(null);
  const kind = course.proofType;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = link.trim();
    const problems: Record<string, string> = {};
    if (url && !isHttps(url)) problems.link = 'Use a full https link.';
    if (kind === 'CERTIFICATE_LINK' && !url) problems.link = 'Add the link to your certificate.';
    if (kind === 'LINK_OR_SCREENSHOT' && !url && !image) problems.link = 'Add a link, or a screenshot that shows you finished.';
    if (image && image.size > MAX_SCREENSHOT_BYTES) problems.image = 'That screenshot is over 15 MB.';
    setErrors(problems);
    if (Object.keys(problems).length) return;

    setProgress(0);
    try {
      onSent(await submitCourseProof(course.id, { link: url || null, note: note.trim() || null, image }, setProgress));
      toast.success(kind === 'MENTOR_CHECK' ? 'Your mentor has been asked to check.' : 'Sent for review.');
    } catch (error) {
      setProgress(null);
      if (error instanceof ApiError && error.code === 'PROOF_REQUIRED') setErrors({ link: error.message });
      else toast.error(errorMessage(error));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <p className="text-text-2">
        {kind === 'MENTOR_CHECK'
          ? 'Your mentor checks this course with you. Ask for a check when you’ve finished.'
          : `Show you've finished: ${PROOF_LABELS[kind].toLowerCase()}.`}
      </p>
      {kind !== 'MENTOR_CHECK' && (
        <Input
          label={kind === 'CERTIFICATE_LINK' ? 'Certificate link' : 'Link'}
          optional={kind === 'LINK_OR_SCREENSHOT'}
          type="url"
          placeholder="https://"
          value={link}
          error={errors.link}
          onChange={(e) => setLink(e.target.value)}
        />
      )}
      {kind === 'LINK_OR_SCREENSHOT' && (
        <label className="block">
          <span className="label">
            Screenshot <span className="font-normal text-text-2">(optional)</span>
          </span>
          <input
            type="file"
            accept={SCREENSHOT_TYPES}
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="block text-small"
          />
          {errors.image && <span className="block text-small text-danger mt-1">{errors.image}</span>}
        </label>
      )}
      <Textarea label="Note" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      {progress !== null && (
        <div role="status" aria-label={`Sending, ${Math.round(progress * 100)}%`} className="bar">
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <Button type="submit" isLoading={progress !== null}>
        {kind === 'MENTOR_CHECK' ? 'Ask for a check' : isResubmit ? 'Send again' : 'Send for review'}
      </Button>
    </form>
  );
};

export const CourseView: React.FC<{ courseId: string }> = ({ courseId }) => {
  const { can } = useSession();
  const toast = useToast();
  const library = useApiQuery(
    (signal) => listCourses({ includeArchived: can('createTrack') }, signal),
    [],
    'learning:courses:all',
  );
  const mine = useApiQuery((signal) => listMyCourses(signal), [], 'learning:courses:mine');
  const [isEditing, setIsEditing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [videoIndex, setVideoIndex] = useState(0);
  const [youtubeDown, setYoutubeDown] = useState(false);

  const full = library.data?.find(({ id }) => id === courseId);
  const progress = mine.data?.find(({ course }) => course.id === courseId) ?? null;
  // An archived course drops out of the library, but whoever started it can still finish it.
  const course: CourseSummary | undefined = full ?? progress?.course;
  useDetailTitle(course?.title);

  const replace = (next: CourseProgress) =>
    mine.mutate((list) => [next, ...list.filter(({ course: other }) => other.id !== courseId)]);

  if (library.error || mine.error) {
    return <ErrorState title="Couldn't load this course" message={errorMessage(library.error ?? mine.error)} onRetry={() => { library.reload(); mine.reload(); }} />;
  }
  if (!library.data || !mine.data) return <LoadingState label="Loading the course…" />;
  if (!course) {
    return (
      <NoAccess
        title="This course isn't in the library"
        description="It may have been archived. Courses you've started stay under My learning."
        backTo="/learning?tab=courses"
        backLabel="Course library"
      />
    );
  }

  const start = async () => {
    setIsStarting(true);
    try {
      replace(await startCourse(course.id));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsStarting(false);
    }
  };

  const watched = (videoId: string) => (seconds: number, duration: number) => {
    reportVideoProgress(course.id, videoId, seconds, duration).then(
      (next) => {
        if (next.status === 'COMPLETED' && progress?.status !== 'COMPLETED') toast.success('Course complete. Nice work.');
        replace(next);
      },
      (error: unknown) => {
        // Too soon after the last report: the next one carries on from here.
        if (!(error instanceof ApiError && error.status === 429)) toast.error(errorMessage(error));
      },
    );
  };

  const status = progress?.status ?? 'NOT_STARTED';
  const isYouTube = course.format === 'YOUTUBE';
  const videos = course.youtubeVideoIds;
  const current = videos[videoIndex];
  const canSendProof = !isYouTube && progress && ['IN_PROGRESS', 'CHANGES_REQUESTED', 'NOT_STARTED'].includes(status);

  return (
    <>
      <Link to="/learning?tab=courses" className="inline-flex items-center gap-1 text-small font-semibold mb-3">
        <Icon name="arrow_back" size="sm" />
        Course library
      </Link>

      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="min-w-0 grow basis-60">
          <h1 className="t-h1 break-words">{course.title}</h1>
          <p className="text-text-2">
            {course.provider}
            {full && ` · ${LEVEL_LABELS[full.level]}`}
            {full?.estimatedHours ? ` · About ${full.estimatedHours} hours` : ''}
            {isYouTube ? ` · ${videos.length} ${videos.length === 1 ? 'video' : 'videos'}` : ''}
          </p>
        </div>
        {progress && <CourseStatusBadge status={status} />}
        {can('createTrack') && full && (
          <Button variant="secondary" icon="edit" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        )}
        {!progress && !course.isArchived && (
          <Button icon="play_arrow" onClick={start} isLoading={isStarting}>
            Start course
          </Button>
        )}
      </div>

      {full?.description && <p className="mb-5 max-w-prose whitespace-pre-wrap">{full.description}</p>}

      {status === 'CHANGES_REQUESTED' && progress?.reviewNote && (
        <div className="mb-5">
          <Banner tone="warn">
            <span className="font-semibold">Changes requested:</span> {progress.reviewNote}
          </Banner>
        </div>
      )}

      {isYouTube ? (
        progress ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] items-start">
            <Card className="card-pad">
              {youtubeDown ? (
                <p className="text-text-2">YouTube couldn't be reached. Check your connection and reload.</p>
              ) : (
                current && (
                  <YouTubePlayer
                    key={current}
                    videoId={current}
                    title={`${course.title}, video ${videoIndex + 1}`}
                    onWatched={watched(current)}
                    onUnavailable={() => setYoutubeDown(true)}
                  />
                )
              )}
              <p className="mt-2 text-small text-text-2">
                Progress saves as you watch. A video counts once you've watched 90% of it.
              </p>
            </Card>
            <Card>
              <h2 className="t-h3 px-5 pt-4 pb-2">Videos</h2>
              <ol className="divide-y divide-border">
                {videos.map((id, index) => {
                  const video = progress.videos.find(({ videoId }) => videoId === id);
                  const share = video?.durationSeconds ? Math.min(1, video.watchedSeconds / video.durationSeconds) : 0;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setVideoIndex(index)}
                        aria-current={index === videoIndex ? 'true' : undefined}
                        className={`w-full text-left px-5 py-2.5 border-0 cursor-pointer ${index === videoIndex ? 'bg-brand-50' : 'bg-transparent hover:bg-surface-2'}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="grow font-semibold">Video {index + 1}</span>
                          {video?.completedAt && <Icon name="check_circle" size="sm" filled className="text-success" />}
                        </span>
                        <span className="bar block mt-1.5" aria-label={`${Math.round(share * 100)}% watched`} role="img">
                          <i style={{ width: `${Math.round(share * 100)}%` }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </div>
        ) : (
          <Card className="card-pad text-text-2">Start the course to watch it here. Your progress saves as you go.</Card>
        )
      ) : (
        <Card className="card-pad space-y-4 max-w-2xl">
          <a href={course.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            <Icon name="open_in_new" size="sm" />
            Open the course
          </a>
          {status === 'PROOF_SUBMITTED' && progress && (
            <div>
              <p className="font-semibold">Waiting for review</p>
              <p className="text-small text-text-2">
                Sent {progress.proofSubmittedAt ? formatDateTime(new Date(progress.proofSubmittedAt)) : ''}
              </p>
              {progress.proofLink && (
                <a href={progress.proofLink} target="_blank" rel="noopener noreferrer" className="break-all">
                  {progress.proofLink}
                </a>
              )}
            </div>
          )}
          {status === 'COMPLETED' && <p className="font-semibold text-success">You've completed this course.</p>}
          {canSendProof && (
            <ProofForm course={course} isResubmit={status === 'CHANGES_REQUESTED'} onSent={replace} />
          )}
          {!progress && <p className="text-text-2">Start the course, then come back here to show you've finished.</p>}
        </Card>
      )}

      {isEditing && full && (
        <CourseFormModal
          course={full}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            library.reload();
          }}
        />
      )}
    </>
  );
};
