import { request } from './client';
import {
  Enrollment,
  EnrollmentDetail,
  EnrollmentStatus,
  LearningHealth,
  RatingKind,
  ReviewDecision,
  ReviewRequest,
  SkillRating,
  Submission,
  Track,
  TrackItem,
  TrackItemType,
  TrackModule,
  TrackSkill,
  TrackStatus,
} from './types';

export type EnrollmentScope = 'mine' | 'mentoring' | 'all';

export interface TrackFields {
  title: string;
  description: string;
  departmentId: string | null;
  positionId: string | null;
}

export interface ItemFields {
  title: string;
  instructions: string;
  resourceUrl: string | null;
  estimatedMinutes: number | null;
  dueDay: number | null;
  skillIds: string[];
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
  body: { link: string | null; note: string },
): Promise<Submission> {
  return request<{ submission: Submission }>(
    `/learning/enrollments/${enrollmentId}/items/${itemId}/submissions`,
    { method: 'POST', body },
  ).then((data) => data.submission);
}

/** Oldest first. */
export async function listReviews(signal?: AbortSignal): Promise<ReviewRequest[]> {
  const data = await request<{ submissions: ReviewRequest[] }>('/learning/reviews', { signal });
  return data.submissions;
}

export function reviewSubmission(
  id: string,
  review: { decision: ReviewDecision; feedback?: string; score: number | null },
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
