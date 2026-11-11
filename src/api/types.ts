export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS',
  'TEAM_LEAD',
  'TEAM_MEMBER',
  'INTERN',
] as const;

export type Role = (typeof ROLES)[number];

export type UserStatus = 'PENDING' | 'ACTIVE' | 'DEACTIVATED';
export const USER_STATUSES: UserStatus[] = ['ACTIVE', 'PENDING', 'DEACTIVATED'];

/** What someone does. It never affects access: `role` alone does that. */
export interface Placement {
  department?: Named | null;
  position?: Named | null;
}

export interface User extends Placement {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: string;
  avatar: AvatarUrls | null;
}

export interface Session {
  user: User;
  permissions: string[];
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERATIONS: 'Operations',
  TEAM_LEAD: 'Team Lead',
  TEAM_MEMBER: 'Team Member',
  INTERN: 'Intern',
};

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  DONE: 'Done',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

/** Square WebP pictures: `small` is 128px for lists, `large` 512px for profiles. */
export interface AvatarUrls {
  small: string;
  large: string;
}

export interface Named {
  id: string;
  name: string;
  /** Most people the API returns carry this. Null means no picture, so show initials. */
  avatar?: AvatarUrls | null;
}

export interface PersonRef extends Named, Placement {}

/** Who gave them the task is null on assignments older than that tracking. */
export interface TaskAssignee extends PersonRef {
  assignedBy: Named | null;
  assignedAt: string | null;
}

export const MAX_ASSIGNEES = 10;

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string | null;
  createdBy: string;
  completedAt: string | null;
  isOverdue: boolean;
  creator: PersonRef;
  /** Everyone sharing the task, earliest first. They share its status and comments. */
  assignees: TaskAssignee[];
  projectId: string | null;
  project: Named | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  body: string;
  author: PersonRef;
  createdAt: string;
}

export interface TaskSummary {
  scope: 'mine' | 'team';
  open: number;
  overdue: number;
  doneThisWeek: number;
  weekStart: string;
  /** Each of these arrives with its backend feature. The dashboard only shows what's sent. */
  checkedInToday?: boolean;
  teamCheckins?: { submitted: number; notSubmitted: number; openBlockers: number };
  upcomingMeetings?: number;
  unreadMessages?: number;
  unreadMentions?: number;
  /** Left out for people with no active enrollment. */
  learning?: LearningSummary;
  /** Left out for people who don't mentor or review. */
  learningReview?: { awaitingReview: number; learnersBehind: number };
}

export interface CheckinPerson extends PersonRef {
  role: Role;
}

export interface CheckinReply {
  id: string;
  author: PersonRef;
  body: string;
  createdAt: string;
}

export interface LinkedTask {
  id: string;
  title: string;
  status: TaskStatus;
  assignees: Named[];
}

export interface Checkin {
  id: string;
  user: CheckinPerson;
  /** The WAT calendar date as YYYY-MM-DD. Never pass it through a browser timezone. */
  date: string;
  workCompleted: string;
  priorities: string;
  blockers: string | null;
  blockerHandled: boolean;
  blockerHandledBy: PersonRef | null;
  isLate: boolean;
  submittedAt: string;
  updatedAt: string;
  editable: boolean;
  linkedTasks: LinkedTask[];
  replies: CheckinReply[];
}

export interface DirectoryUser extends PersonRef {
  role: Role;
  status: UserStatus;
}

export const PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
};

export interface ProjectMember extends PersonRef {
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  /** Calendar days as YYYY-MM-DD. Never pass them through a browser timezone. */
  startDate: string | null;
  dueDate: string | null;
  owner: PersonRef;
  members: ProjectMember[];
  progress: { total: number; done: number; overdue: number };
  createdAt: string;
  updatedAt: string;
}

export const MAX_MESSAGE_LENGTH = 4_000;

export interface ConversationPerson extends Named {
  position: Named | null;
  status: UserStatus;
}

export interface LastMessage {
  bodyPreview: string;
  authorName: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  kind: 'CHANNEL' | 'DM';
  /** Null on a DM. */
  name: string | null;
  description: string | null;
  /** Null on a DM. */
  visibility: 'PUBLIC' | 'PRIVATE' | null;
  isAnnouncement: boolean;
  isArchived: boolean;
  department: Named | null;
  /** The other person on a DM. */
  otherUser: ConversationPerson | null;
  unreadCount: number;
  mentionCount: number;
  lastMessage: LastMessage | null;
  isMuted: boolean;
  canPost: boolean;
  canManage: boolean;
}

export type AttachmentKind = 'IMAGE' | 'VOICE';

/** What a reply quotes. Built when read, so edits and deletes of the original show through. */
export interface ReplyQuote {
  id: string;
  author: Named;
  /** Plain text, up to 140 characters, with mentions as @Name. Null once deleted. */
  bodyPreview: string | null;
  /** Set when the original has no text, only a photo or voice note. */
  attachmentKind: AttachmentKind | null;
  deletedAt: string | null;
}

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  /** Signed, and good for an hour. Messages carry fresh ones each time they're read. */
  url: string;
  /** 480px, for the chat. Null on a voice note. */
  thumbnailUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  /** Voice notes only. */
  durationSeconds: number | null;
  /** Voice notes only: 48 levels from 0 to 1. */
  waveform: number[] | null;
}

export const MAX_PHOTOS = 10;

/** A card for a link in a message. Every field but `url` can be missing. */
export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  clientId: string;
  author: ConversationPerson;
  replyTo: ReplyQuote | null;
  /** Up to 10 photos, or one voice note. Empty when there are none, or once deleted. */
  attachments: Attachment[];
  /**
   * Up to 3 cards, fetched by the server after sending, so they usually arrive a moment later in
   * message:updated. Hidden and failed ones are left out.
   */
  linkPreviews: LinkPreview[];
  /** Null once deleted. */
  body: string | null;
  mentions: Named[];
  /** Differs between viewers, because it only lists tasks this viewer can see. */
  linkedTasks: LinkedTask[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export type TrackStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type TrackItemType = 'RESOURCE' | 'ASSIGNMENT';
export type EnrollmentStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'WITHDRAWN';
export type LearningHealth = 'ON_TRACK' | 'BEHIND' | 'COMPLETED' | 'PAUSED';
export type SkillTrend = 'UP' | 'DOWN' | 'FLAT' | 'NONE';
export type ItemStatus = 'NOT_STARTED' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'COMPLETED';
export type ReviewDecision = 'APPROVED' | 'CHANGES_REQUESTED';
export type RatingKind = 'MENTOR' | 'SELF';

export const MIN_TRACK_SKILLS = 2;
export const MAX_TRACK_SKILLS = 8;
export const MAX_LEARNERS = 100;

export interface TrackSkill {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface TrackItem {
  id: string;
  type: TrackItemType;
  title: string;
  instructions: string;
  resourceUrl: string | null;
  estimatedMinutes: number | null;
  /** Days after the enrollment's start date. */
  dueDay: number | null;
  sortOrder: number;
  isArchived: boolean;
  skillIds: string[];
}

export interface TrackModule {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  items: TrackItem[];
}

export interface Track {
  id: string;
  title: string;
  description: string;
  status: TrackStatus;
  department: Named | null;
  position: Named | null;
  createdBy: Named;
  skills: TrackSkill[];
  modules: TrackModule[];
  createdAt: string;
  updatedAt: string;
}

export interface NextItem {
  id: string;
  title: string;
  /** A WAT calendar date. */
  dueDate: string | null;
}

export interface LearningSummary {
  activeTracks: number;
  overdueItems: number;
  nextItem: NextItem | null;
}

export interface SkillProgress {
  skillId: string;
  name: string;
  firstMentorScore: number | null;
  latestMentorScore: number | null;
  latestSelfScore: number | null;
  trend: SkillTrend;
}

export interface EnrollmentProgress {
  percentComplete: number;
  itemsCompleted: number;
  itemsTotal: number;
  overdueItems: number;
  health: LearningHealth;
  averageScore: number | null;
  changesRequestedCount: number;
  awaitingReview: number;
  lastActivityAt: string | null;
  nextItem: NextItem | null;
  skills: SkillProgress[];
}

export interface Enrollment {
  id: string;
  track: { id: string; title: string };
  learner: Named & { position: Named | null };
  mentor: Named;
  /** WAT calendar dates. */
  startDate: string;
  targetEndDate: string | null;
  status: EnrollmentStatus;
  completedAt: string | null;
  createdAt: string;
  progress: EnrollmentProgress;
}

export interface Submission {
  id: string;
  enrollmentId: string;
  itemId: string;
  link: string | null;
  note: string;
  submittedAt: string;
  reviewedAt: string | null;
  decision: ReviewDecision | null;
  feedback: string | null;
  score: number | null;
  reviewedBy: Named | null;
}

export interface ReviewRequest extends Submission {
  item: { id: string; title: string };
  track: { id: string; title: string };
  learner: Named;
}

export interface EnrollmentItem extends TrackItem {
  dueDate: string | null;
  isOverdue: boolean;
  status: ItemStatus;
  completedAt: string | null;
  /** How many times it's been submitted. The API only sends the latest one. */
  attempts: number;
  latestSubmission: Submission | null;
}

export interface EnrollmentModule {
  id: string;
  title: string;
  description: string;
  items: EnrollmentItem[];
}

export interface EnrollmentDetail extends Enrollment {
  modules: EnrollmentModule[];
}

export interface SkillRating {
  id: string;
  skillId: string;
  kind: RatingKind;
  score: number;
  note: string | null;
  createdAt: string;
  ratedBy: Named;
}
