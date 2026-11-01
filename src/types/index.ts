export type UserRole =
  | 'SUPER_ADMIN'
  | 'MANAGEMENT'
  | 'DEPARTMENT_LEAD'
  | 'OPERATIONS'
  | 'TEAM_MEMBER'
  | 'INTERN'
  | 'TRAINEE'
  | 'FINANCE'
  | 'SALES'
  | 'SUPPORT';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDED';

export type DepartmentCode =
  | 'ENG'
  | 'OPS'
  | 'ADMIN'
  | 'FIN'
  | 'SALES'
  | 'SUPPORT'
  | 'MKTG'
  | 'STARTUP';

export interface Department {
  id: string;
  name: string;
  code: DepartmentCode;
  description: string;
  leadUserId?: string;
  leadName?: string;
  memberCount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  departmentId: string;
  departmentName: string;
  departmentCode: DepartmentCode;
  avatarUrl: string;
  status: UserStatus;
  jobTitle: string;
  managerName?: string;
  managerId?: string;
  joinedDate: string;
  workingHours: string; // e.g. "9:00 AM – 5:00 PM WAT"
  timezone: string;
  phone?: string;
  whatsappOptIn: boolean;
  activeTasksCount?: number;
}

export type TaskStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskChecklistItem {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userRole: string;
  userAvatar: string;
  content: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  actorId: string;
  actorName: string;
  action: string;
  detail?: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  assigneeId: string;
  assigneeName: string;
  assigneeAvatar: string;
  assigneeRole: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewerAvatar?: string;
  projectId: string;
  projectName: string;
  departmentId: string;
  departmentName: string;
  departmentCode: DepartmentCode;
  priority: TaskPriority;
  status: TaskStatus;
  blockerReason?: string;
  startDate: string;
  dueDate: string;
  checklist: TaskChecklistItem[];
  commentsCount: number;
  comments?: TaskComment[];
  activityHistory?: TaskActivity[];
  githubPrUrl?: string;
  requiresReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProjectVisibility = 'PRIVATE' | 'DEPARTMENT' | 'ORGANIZATION';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';

export interface Milestone {
  id: string;
  title: string;
  dueDate: string;
  isCompleted: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  departmentId: string;
  departmentName: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  priority: TaskPriority;
  startDate: string;
  targetDate: string;
  progressPercentage: number;
  milestones: Milestone[];
  members: {
    userId: string;
    name: string;
    avatar: string;
    roleInProject: 'LEAD' | 'CONTRIBUTOR' | 'VIEWER';
  }[];
  tasksTotal: number;
  tasksCompleted: number;
  githubRepo?: string;
}

export type DocumentCategory =
  | 'POLICIES'
  | 'SOPS'
  | 'ENGINEERING'
  | 'ONBOARDING'
  | 'FINANCE'
  | 'TEMPLATES';

export type DocumentVisibility = 'PUBLIC_ORG' | 'DEPARTMENT_ONLY' | 'CONFIDENTIAL';

export interface CompanyDocument {
  id: string;
  title: string;
  summary: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  departmentId?: string;
  departmentName?: string;
  ownerId: string;
  ownerName: string;
  version: string;
  updatedAt: string;
  readingTimeMinutes: number;
  requiresAcknowledgment: boolean;
  contentMarkdown: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  authorName: string;
  authorRole: string;
  publishedAt: string;
  targetAudience: 'ALL' | 'ENGINEERING' | 'OPERATIONS' | 'MANAGEMENT';
  isAcknowledged?: boolean;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: 'TASK_ASSIGNED' | 'TASK_STATUS' | 'MENTION' | 'ANNOUNCEMENT' | 'REVIEW_REQUEST' | 'DEADLINE_WARNING';
  linkUrl: string;
  isRead: boolean;
  createdAt: string;
}

export interface DailyCheckInRecord {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  departmentName: string;
  date: string;
  timeSubmitted: string;
  todayPlan: string[];
  yesterdayCompleted: string[];
  blockers: string;
  assistanceNeeded: string;
  status: 'SUBMITTED' | 'MISSED' | 'PENDING';
}

export interface AuditLogItem {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetResource: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

export interface Invitation {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string;
  departmentName: string;
  inviterName: string;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
}

export interface MessageChannel {
  id: string;
  name: string;
  isDirectMessage: boolean;
  recipientUser?: User;
  unreadCount: number;
  lastMessageSnippet: string;
  lastMessageTime: string;
  departmentCode?: DepartmentCode;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderRole: string;
  content: string;
  timestamp: string;
  attachments?: { name: string; size: string; url: string }[];
}

