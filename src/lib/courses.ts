import { CourseLevel, CourseStatus, ProofType } from '../api/types';

export const LEVEL_LABELS: Record<CourseLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  PROOF_SUBMITTED: 'Waiting for review',
  CHANGES_REQUESTED: 'Changes requested',
  COMPLETED: 'Done',
};

export const PROOF_LABELS: Record<ProofType, string> = {
  CERTIFICATE_LINK: 'A link to the certificate',
  LINK_OR_SCREENSHOT: 'A link or a screenshot',
  MENTOR_CHECK: 'Your mentor checks it with you',
};

/** watch, youtu.be, embed and shorts links all name a video the same way. */
export function youtubeId(link: string): string | null {
  const match = link.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return match ? match[1] : null;
}

export const isHttps = (link: string) => {
  try {
    return new URL(link).protocol === 'https:';
  } catch {
    return false;
  }
};
