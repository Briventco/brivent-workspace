import { request, uploadForm } from './client';
import {
  Enrollment,
  EnrollmentDetail,
  EnrollmentStatus,
  LearningHealth,
  RatingKind,
  ReviewDecision,
  ReviewQueueEntry,
  SkillRating,
  Submission,
  Track,
  TrackItem,
  TrackItemType,
  TrackModule,
  TrackSkill,
  TrackStatus,
  Cohort,
  Course,
  CourseLevel,
  CourseFormat,
  CourseProgress,
  ProofType,
  SubmissionMode,
} from './types';

export type EnrollmentScope = 'mine' | 'mentoring' | 'all';

export interface TrackFields {
  title: string;
  description: string;
  departmentId: string | null;
  positionId: string | null;
  lockBuildUntilLearningDone?: boolean;
}

export interface ItemFields {
  title: string;
  instructions: string;
  resourceUrl: string | null;
  estimatedMinutes: number | null;
  dueDay: number | null;
  skillIds: string[];
  /** COURSE items. */
  courseId?: string | null;
  /** BUILD items. */
  projectId?: string | null;
  brief?: string;
  deliverables?: string;
  submissionMode?: SubmissionMode;
}

export interface NewEnrollment {
  trackId: string;
  learnerIds: string[];
  mentorId: string;
  startDate: string;
  targetEndDate: string | null;
}

export interface RatingInput {
  skillId: string;
  score: number;
  note?: string;
}

const toTrack = (data: { track: Track }) => data.track;
const toDetail = (data: { enrollment: EnrollmentDetail }) => data.enrollment;

export async function listTracks(status?: TrackStatus, signal?: AbortSignal): Promise<Track[]> {
  const query = status ? `?status=${status}` : '';
  const data = await request<{ tracks: Track[] }>(`/learning/tracks${query}`, { signal });
  return data.tracks;
}

export function getTrack(id: string, signal?: AbortSignal): Promise<Track> {
  return request<{ track: Track }>(`/learning/tracks/${id}`, { signal }).then(toTrack);
}

export function createTrack(title: string): Promise<Track> {
  return request<{ track: Track }>('/learning/tracks', {
    method: 'POST',
    body: { title },
  }).then(toTrack);
}

export function updateTrack(
  id: string,
  changes: Partial<TrackFields> & { status?: TrackStatus },
): Promise<Track> {
  return request<{ track: Track }>(`/learning/tracks/${id}`, {
    method: 'PATCH',
    body: changes,
  }).then(toTrack);
}

export function addSkill(trackId: string, name: string): Promise<TrackSkill> {
  return request<{ skill: TrackSkill }>(`/learning/tracks/${trackId}/skills`, {
    method: 'POST',
    body: { name },
  }).then((data) => data.skill);
}

export function renameSkill(id: string, name: string): Promise<TrackSkill> {
  return request<{ skill: TrackSkill }>(`/learning/skills/${id}`, {
    method: 'PATCH',
    body: { name },
  }).then((data) => data.skill);
}

export function addModule(trackId: string, title: string): Promise<TrackModule> {
  return request<{ module: TrackModule }>(`/learning/tracks/${trackId}/modules`, {
    method: 'POST',
    body: { title },
  }).then((data) => data.module);
}

export function renameModule(id: string, title: string): Promise<TrackModule> {
  return request<{ module: TrackModule }>(`/learning/modules/${id}`, {
    method: 'PATCH',
    body: { title },
  }).then((data) => data.module);
}

export function addItem(
  moduleId: string,
  item: ItemFields & { type: TrackItemType },
): Promise<TrackItem> {
  return request<{ item: TrackItem }>(`/learning/modules/${moduleId}/items`, {
    method: 'POST',
    body: item,
  }).then((data) => data.item);
}

export function updateItem(
  id: string,
  changes: Partial<ItemFields> & { isArchived?: boolean },
): Promise<TrackItem> {
  return request<{ item: TrackItem }>(`/learning/items/${id}`, {
    method: 'PATCH',
    body: changes,
  }).then((data) => data.item);
}

/** Listing an item under another module moves it there. */
export function reorderTrack(
  trackId: string,
  modules: { id: string; itemIds: string[] }[],
): Promise<Track> {
  return request<{ track: Track }>(`/learning/tracks/${trackId}/order`, {
    method: 'PUT',
    body: { modules },
  }).then(toTrack);
}

/** All or nothing: if one learner is already on the track, nobody is added. */
export async function enroll(enrollment: NewEnrollment): Promise<Enrollment[]> {
  const data = await request<{ enrollments: Enrollment[] }>('/learning/enrollments', {
    method: 'POST',
    body: enrollment,
  });
  return data.enrollments;
}

export async function listEnrollments(
  scope: EnrollmentScope,
  filters: { health?: LearningHealth } = {},
  signal?: AbortSignal,
): Promise<Enrollment[]> {
  const params = new URLSearchParams({ scope });
  if (filters.health) params.set('health', filters.health);
  const data = await request<{ enrollments: Enrollment[] }>(`/learning/enrollments?${params}`, {
    signal,
  });
  return data.enrollments;
}

export function getEnrollment(id: string, signal?: AbortSignal): Promise<EnrollmentDetail> {
  return request<{ enrollment: EnrollmentDetail }>(`/learning/enrollments/${id}`, {
    signal,
  }).then(toDetail);
}

export function setEnrollmentStatus(
  id: string,
  status: Exclude<EnrollmentStatus, 'COMPLETED'>,
): Promise<Enrollment> {
  return request<{ enrollment: Enrollment }>(`/learning/enrollments/${id}`, {
    method: 'PATCH',
    body: { status },
  }).then((data) => data.enrollment);
}

export function completeResource(enrollmentId: string, itemId: string): Promise<EnrollmentDetail> {
  return request<{ enrollment: EnrollmentDetail }>(
    `/learning/enrollments/${enrollmentId}/items/${itemId}/complete`,
    { method: 'POST' },
  ).then(toDetail);
}

export function submitAssignment(
  enrollmentId: string,
  itemId: string,
  body: { link: string | null; note: string } | { repoUrl: string; liveUrl: string | null; note?: string },
): Promise<Submission> {
  return request<{ submission: Submission }>(
    `/learning/enrollments/${enrollmentId}/items/${itemId}/submissions`,
    { method: 'POST', body },
  ).then((data) => data.submission);
}

/** Oldest first. */
/** Assignments, builds and course proofs waiting for you, oldest first. A team build is listed once. */
export async function listReviews(signal?: AbortSignal): Promise<ReviewQueueEntry[]> {
  const data = await request<{ submissions: ReviewQueueEntry[] }>('/learning/reviews', { signal });
  return data.submissions;
}

export function reviewSubmission(
  id: string,
  review: {
    decision: ReviewDecision;
    feedback?: string;
    score: number | null;
    /** A team build: a score and note for each person. Each sees only their own. */
    memberReviews?: { learnerId: string; score?: number; note?: string }[];
  },
): Promise<Submission> {
  return request<{ submission: Submission }>(`/learning/submissions/${id}/review`, {
    method: 'POST',
    body: review,
  }).then((data) => data.submission);
}

export async function listSkillRatings(
  enrollmentId: string,
  signal?: AbortSignal,
): Promise<SkillRating[]> {
  const data = await request<{ ratings: SkillRating[] }>(
    `/learning/enrollments/${enrollmentId}/skill-ratings`,
    { signal },
  );
  return data.ratings;
}

export async function addSkillRatings(
  enrollmentId: string,
  kind: RatingKind,
  ratings: RatingInput[],
): Promise<SkillRating[]> {
  const data = await request<{ ratings: SkillRating[] }>(
    `/learning/enrollments/${enrollmentId}/skill-ratings`,
    { method: 'POST', body: { kind, ratings } },
  );
  return data.ratings;
}

// Course library

export interface CourseFields {
  title: string;
  provider: string;
  url: string;
  description: string;
  topics: string[];
  level: CourseLevel;
  estimatedHours: number | null;
  isFree: boolean;
  proofType?: ProofType;
  youtubeUrls?: string[];
  youtubePlaylistUrl?: string;
}

export async function listCourses(
  filters: { topic?: string; level?: CourseLevel | ''; search?: string; includeArchived?: boolean },
  signal?: AbortSignal,
): Promise<Course[]> {
  const params = new URLSearchParams();
  if (filters.topic) params.set('topic', filters.topic);
  if (filters.level) params.set('level', filters.level);
  if (filters.search) params.set('search', filters.search);
  if (filters.includeArchived) params.set('includeArchived', 'true');
  const data = await request<{ courses: Course[] }>(`/learning/courses?${params}`, { signal });
  return data.courses;
}

export function createCourse(course: CourseFields & { format: CourseFormat }): Promise<Course> {
  return request<{ course: Course }>('/learning/courses', { method: 'POST', body: course }).then(
    (data) => data.course,
  );
}

/** The format can't change. Sending video links replaces the list, and progress made stays. */
export function updateCourse(id: string, changes: Partial<CourseFields> & { isArchived?: boolean }): Promise<Course> {
  return request<{ course: Course }>(`/learning/courses/${id}`, { method: 'PATCH', body: changes }).then(
    (data) => data.course,
  );
}

/** Your progress on every course you've started, from tracks or on your own. */
export async function listMyCourses(signal?: AbortSignal): Promise<CourseProgress[]> {
  const data = await request<{ progress: CourseProgress[] }>('/learning/courses/mine', { signal });
  return data.progress;
}

/** Someone's course progress, for their mentors and managers. */
export async function listCourseProgress(userId: string, signal?: AbortSignal): Promise<CourseProgress[]> {
  const data = await request<{ progress: CourseProgress[] }>(
    `/learning/course-progress?userId=${userId}`,
    { signal },
  );
  return data.progress;
}

export function startCourse(id: string): Promise<CourseProgress> {
  return request<{ progress: CourseProgress }>(`/learning/courses/${id}/start`, { method: 'POST' }).then(
    (data) => data.progress,
  );
}

/** External courses: whatever proof the course asks for. A screenshot goes up as a file. */
export async function submitCourseProof(
  id: string,
  proof: { link: string | null; note: string | null; image: File | null },
  onProgress?: (fraction: number) => void,
): Promise<CourseProgress> {
  const form = new FormData();
  if (proof.link) form.append('proofLink', proof.link);
  if (proof.note) form.append('proofNote', proof.note);
  if (proof.image) form.append('proofImage', proof.image, proof.image.name);
  const data = await uploadForm<{ progress: CourseProgress }>(`/learning/courses/${id}/proof`, form, {
    method: 'POST',
    onProgress,
  });
  return data.progress;
}

/** From the YouTube player, at most every 10 seconds per video. The server only lets it go up. */
export function reportVideoProgress(
  courseId: string,
  videoId: string,
  watchedSeconds: number,
  durationSeconds: number,
): Promise<CourseProgress> {
  return request<{ progress: CourseProgress }>(
    `/learning/courses/${courseId}/videos/${videoId}/progress`,
    { method: 'POST', body: { watchedSeconds, durationSeconds } },
  ).then((data) => data.progress);
}

export function reviewCourseProof(
  userId: string,
  courseId: string,
  review: { decision: ReviewDecision; note?: string },
): Promise<CourseProgress> {
  return request<{ progress: CourseProgress }>(
    `/learning/course-proofs/${userId}/${courseId}/review`,
    { method: 'POST', body: review },
  ).then((data) => data.progress);
}

// Programs

export interface TemplateInput {
  title: string;
  courseIds: string[];
  learnWeeks: number;
  build: {
    projectId?: string;
    brief: string;
    deliverables: string;
    submissionMode: SubmissionMode;
    buildWeeks: number;
  };
  skills: string[];
  lockBuildUntilLearningDone?: boolean;
}

/** "Learn then build" in one go: a published track with a Learn module and a Build module. */
export function createTrackFromTemplate(input: TemplateInput): Promise<Track> {
  return request<{ track: Track }>('/learning/tracks/from-template', { method: 'POST', body: input }).then(
    (data) => data.track,
  );
}

export interface NewCohort {
  name: string;
  trackId: string;
  mentorId: string;
  learnerIds: string[];
  startDate: string;
  projectId?: string;
  submissionMode: SubmissionMode;
}

export async function listCohorts(signal?: AbortSignal): Promise<Cohort[]> {
  const data = await request<{ cohorts: Cohort[] }>('/learning/cohorts', { signal });
  return data.cohorts;
}

export function getCohort(id: string, signal?: AbortSignal): Promise<Cohort> {
  return request<{ cohort: Cohort }>(`/learning/cohorts/${id}`, { signal }).then((data) => data.cohort);
}

/** All or nothing: the cohort and an enrollment for every learner, who also join the project. */
export function createCohort(cohort: NewCohort): Promise<Cohort> {
  return request<{ cohort: Cohort }>('/learning/cohorts', { method: 'POST', body: cohort }).then(
    (data) => data.cohort,
  );
}

/** A new mentor takes over every enrollment in it. Learners and the mode can't change. */
export function updateCohort(
  id: string,
  changes: { name?: string; mentorId?: string; projectId?: string | null },
): Promise<Cohort> {
  return request<{ cohort: Cohort }>(`/learning/cohorts/${id}`, { method: 'PATCH', body: changes }).then(
    (data) => data.cohort,
  );
}
