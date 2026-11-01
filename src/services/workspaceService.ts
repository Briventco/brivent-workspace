import {
  User,
  Task,
  TaskStatus,
  Project,
  CompanyDocument,
  Announcement,
  InAppNotification,
  DailyCheckInRecord,
  AuditLogItem,
  Invitation,
  MessageChannel,
  ChatMessage,
  UserRole,
} from '../types';
import {
  mockUsers,
  mockDepartments,
  mockTasks,
  mockProjects,
  mockDocuments,
  mockAnnouncements,
  mockNotifications,
  mockDailyCheckIns,
  mockAuditLogs,
  mockInvitations,
  mockChannels,
  mockChatMessages,
} from '../data/mockData';

// In-memory / localStorage state persistence for realistic SPA demo
const STORAGE_PREFIX = 'brivent_ws_';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Failed reading ${key} from storage:`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed saving ${key} to storage:`, e);
  }
}

class WorkspaceService {
  private users: User[];
  private tasks: Task[];
  private projects: Project[];
  private documents: CompanyDocument[];
  private announcements: Announcement[];
  private notifications: InAppNotification[];
  private dailyCheckIns: DailyCheckInRecord[];
  private auditLogs: AuditLogItem[];
  private invitations: Invitation[];
  private channels: MessageChannel[];
  private chatMessages: Record<string, ChatMessage[]>;
  private currentUserId: string;

  constructor() {
    this.users = loadFromStorage('users', mockUsers);
    this.tasks = loadFromStorage('tasks', mockTasks);
    this.projects = loadFromStorage('projects', mockProjects);
    this.documents = loadFromStorage('documents', mockDocuments);
    this.announcements = loadFromStorage('announcements', mockAnnouncements);
    this.notifications = loadFromStorage('notifications', mockNotifications);
    this.dailyCheckIns = loadFromStorage('dailyCheckIns', mockDailyCheckIns);
    this.auditLogs = loadFromStorage('auditLogs', mockAuditLogs);
    this.invitations = loadFromStorage('invitations', mockInvitations);
    this.channels = loadFromStorage('channels', mockChannels);
    this.chatMessages = loadFromStorage('chatMessages', mockChatMessages);
    
    // Default current user: Head of Engineering (Emeka Okonkwo) to show rich interactive controls
    this.currentUserId = loadFromStorage('currentUserId', 'user-eng-lead');
  }

  // --- Auth & Role Switcher ---
  public getCurrentUser(): User {
    const found = this.users.find((u) => u.id === this.currentUserId);
    return found || this.users[0];
  }

  public setCurrentUser(userId: string): User {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    this.currentUserId = userId;
    saveToStorage('currentUserId', userId);
    return user;
  }

  public getUsers(): User[] {
    return [...this.users];
  }

  public getUserById(userId: string): User | undefined {
    return this.users.find((u) => u.id === userId);
  }

  public getDepartments() {
    return [...mockDepartments];
  }

  // --- Role & Permission Helpers ---
  public hasPermission(action: string): boolean {
    const currentUser = this.getCurrentUser();
    const role = currentUser.role;

    if (currentUser.status === 'SUSPENDED' || currentUser.status === 'OFFBOARDED') {
      return false;
    }

    switch (action) {
      case 'ADMIN_SETTINGS':
        return role === 'SUPER_ADMIN';
      case 'INVITE_USERS':
        return role === 'SUPER_ADMIN' || role === 'OPERATIONS';
      case 'MANAGE_DEPARTMENTS':
        return role === 'SUPER_ADMIN' || role === 'MANAGEMENT';
      case 'SUSPEND_USERS':
      case 'REVOKE_SESSIONS':
      case 'VIEW_AUDIT_LOGS':
        return role === 'SUPER_ADMIN';
      case 'CREATE_TASK':
        return role !== 'INTERN' && role !== 'TRAINEE';
      case 'APPROVE_TASK':
        return role === 'SUPER_ADMIN' || role === 'MANAGEMENT' || role === 'DEPARTMENT_LEAD' || role === 'OPERATIONS';
      case 'ACCESS_CONFIDENTIAL_DOCS':
        return role === 'SUPER_ADMIN' || role === 'MANAGEMENT' || role === 'FINANCE';
      default:
        return true;
    }
  }

  // --- Tasks ---
  public getTasks(filter?: {
    assigneeId?: string;
    departmentId?: string;
    status?: TaskStatus;
    projectId?: string;
  }): Task[] {
    let result = [...this.tasks];

    if (filter?.assigneeId) {
      result = result.filter((t) => t.assigneeId === filter.assigneeId);
    }
    if (filter?.departmentId) {
      result = result.filter((t) => t.departmentId === filter.departmentId);
    }
    if (filter?.status) {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter?.projectId) {
      result = result.filter((t) => t.projectId === filter.projectId);
    }

    return result;
  }

  public getTaskById(taskId: string): Task | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }

  public createTask(newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'commentsCount' | 'comments' | 'activityHistory'>): Task {
    const currentUser = this.getCurrentUser();
    const id = `task-${Date.now().toString().slice(-4)}`;

    const created: Task = {
      ...newTaskData,
      id,
      checklist: newTaskData.checklist || [],
      commentsCount: 0,
      comments: [],
      activityHistory: [
        {
          id: `act-${Date.now()}`,
          taskId: id,
          actorId: currentUser.id,
          actorName: currentUser.name,
          action: `Created task and assigned to ${newTaskData.assigneeName}`,
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.tasks = [created, ...this.tasks];
    saveToStorage('tasks', this.tasks);

    // Create notification for assignee
    if (created.assigneeId !== currentUser.id) {
      this.createNotification({
        userId: created.assigneeId,
        title: 'New Task Assigned',
        message: `${currentUser.name} assigned you: "${created.title}"`,
        category: 'TASK_ASSIGNED',
        linkUrl: `/tasks?id=${created.id}`,
      });
    }

    this.logAuditEvent(
      'TASK_CREATED',
      `Task: ${created.id}`,
      `Created task "${created.title}" assigned to ${created.assigneeName}`
    );

    return created;
  }

  public updateTaskStatus(taskId: string, newStatus: TaskStatus, blockerReason?: string): Task {
    const currentUser = this.getCurrentUser();
    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) throw new Error('Task not found');

    const task = this.tasks[taskIndex];
    const oldStatus = task.status;

    // RBAC validation: only leads/reviewers can mark completed if requiresReview is true
    if (newStatus === 'COMPLETED' && task.requiresReview) {
      const isReviewer = task.reviewerId === currentUser.id;
      const isLeadOrAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'DEPARTMENT_LEAD' || currentUser.role === 'MANAGEMENT';
      if (!isReviewer && !isLeadOrAdmin) {
        throw new Error('This task requires review by an authorized reviewer or team lead before completion.');
      }
    }

    const activityMessage =
      newStatus === 'BLOCKED'
        ? `Marked as BLOCKED: "${blockerReason || 'Unspecified blocker'}"`
        : `Updated status from ${oldStatus} to ${newStatus}`;

    const updatedTask: Task = {
      ...task,
      status: newStatus,
      blockerReason: newStatus === 'BLOCKED' ? blockerReason : undefined,
      updatedAt: new Date().toISOString(),
      activityHistory: [
        {
          id: `act-${Date.now()}`,
          taskId,
          actorId: currentUser.id,
          actorName: currentUser.name,
          action: activityMessage,
          timestamp: new Date().toISOString(),
        },
        ...(task.activityHistory || []),
      ],
    };

    this.tasks[taskIndex] = updatedTask;
    saveToStorage('tasks', this.tasks);

    // Notify reviewer if submitted for review
    if (newStatus === 'IN_REVIEW' && task.reviewerId && task.reviewerId !== currentUser.id) {
      this.createNotification({
        userId: task.reviewerId,
        title: 'Review Requested',
        message: `${currentUser.name} requested your review on: "${task.title}"`,
        category: 'REVIEW_REQUEST',
        linkUrl: `/tasks?id=${task.id}`,
      });
    }

    this.logAuditEvent(
      'TASK_STATUS_UPDATED',
      `Task: ${task.id}`,
      `Status changed from ${oldStatus} to ${newStatus} by ${currentUser.name}`
    );

    return updatedTask;
  }

  public addTaskComment(taskId: string, content: string): Task {
    const currentUser = this.getCurrentUser();
    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) throw new Error('Task not found');

    const task = this.tasks[taskIndex];
    const newComment = {
      id: `c-${Date.now()}`,
      taskId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.jobTitle,
      userAvatar: currentUser.avatarUrl,
      content,
      createdAt: new Date().toISOString(),
    };

    const updatedTask: Task = {
      ...task,
      commentsCount: (task.commentsCount || 0) + 1,
      comments: [...(task.comments || []), newComment],
      updatedAt: new Date().toISOString(),
    };

    this.tasks[taskIndex] = updatedTask;
    saveToStorage('tasks', this.tasks);

    // Notify assignee if someone else commented
    if (task.assigneeId !== currentUser.id) {
      this.createNotification({
        userId: task.assigneeId,
        title: 'New Comment on Task',
        message: `${currentUser.name} commented on "${task.title}"`,
        category: 'MENTION',
        linkUrl: `/tasks?id=${task.id}`,
      });
    }

    return updatedTask;
  }

  public toggleChecklistItem(taskId: string, itemId: string): Task {
    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) throw new Error('Task not found');

    const task = this.tasks[taskIndex];
    const checklist = task.checklist.map((item) =>
      item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
    );

    const updatedTask: Task = {
      ...task,
      checklist,
      updatedAt: new Date().toISOString(),
    };

    this.tasks[taskIndex] = updatedTask;
    saveToStorage('tasks', this.tasks);
    return updatedTask;
  }

  // --- Projects ---
  public getProjects(): Project[] {
    const currentUser = this.getCurrentUser();
    // RBAC: Private projects are only visible to members or Super Admin
    if (currentUser.role === 'SUPER_ADMIN') {
      return [...this.projects];
    }

    return this.projects.filter((p) => {
      if (p.visibility === 'ORGANIZATION') return true;
      if (p.visibility === 'DEPARTMENT' && p.departmentId === currentUser.departmentId) return true;
      // If private, must be in members list or owner
      return p.ownerId === currentUser.id || p.members.some((m) => m.userId === currentUser.id);
    });
  }

  public getProjectById(projectId: string): Project | undefined {
    return this.projects.find((p) => p.id === projectId);
  }

  public createProject(projectData: Omit<Project, 'id' | 'progressPercentage' | 'tasksTotal' | 'tasksCompleted' | 'milestones' | 'members'>): Project {
    const currentUser = this.getCurrentUser();
    const id = `proj-${Date.now().toString().slice(-4)}`;

    const newProject: Project = {
      ...projectData,
      id,
      progressPercentage: 0,
      tasksTotal: 0,
      tasksCompleted: 0,
      milestones: [],
      members: [
        {
          userId: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatarUrl,
          roleInProject: 'LEAD',
        },
      ],
    };

    this.projects = [newProject, ...this.projects];
    saveToStorage('projects', this.projects);

    this.logAuditEvent('PROJECT_CREATED', `Project: ${id}`, `Created project "${newProject.name}"`);
    return newProject;
  }

  // --- Documents & Knowledge Base ---
  public getDocuments(): CompanyDocument[] {
    const currentUser = this.getCurrentUser();
    // Filter confidential documents if user is not authorized
    return this.documents.map((doc) => {
      if (doc.visibility === 'CONFIDENTIAL' && !this.hasPermission('ACCESS_CONFIDENTIAL_DOCS')) {
        return {
          ...doc,
          contentMarkdown: '🔒 **ACCESS RESTRICTED**: You do not have sufficient permissions to view this confidential document.',
          summary: '🔒 Confidential company financial record. Access restricted to Executive Management and Finance.',
        };
      }
      return doc;
    });
  }

  public acknowledgeDocument(docId: string): void {
    const currentUser = this.getCurrentUser();
    this.logAuditEvent(
      'DOCUMENT_ACKNOWLEDGED',
      `Document: ${docId}`,
      `${currentUser.name} formally acknowledged document compliance policy.`
    );
  }

  // --- Announcements ---
  public getAnnouncements(): Announcement[] {
    return [...this.announcements];
  }

  public acknowledgeAnnouncement(annId: string): void {
    this.announcements = this.announcements.map((a) =>
      a.id === annId ? { ...a, isAcknowledged: true } : a
    );
    saveToStorage('announcements', this.announcements);
  }

  // --- In-App Notifications ---
  public getNotifications(): InAppNotification[] {
    const currentUser = this.getCurrentUser();
    return this.notifications.filter((n) => n.userId === currentUser.id);
  }

  public markNotificationAsRead(notifId: string): void {
    this.notifications = this.notifications.map((n) =>
      n.id === notifId ? { ...n, isRead: true } : n
    );
    saveToStorage('notifications', this.notifications);
  }

  public markAllNotificationsAsRead(): void {
    const currentUser = this.getCurrentUser();
    this.notifications = this.notifications.map((n) =>
      n.userId === currentUser.id ? { ...n, isRead: true } : n
    );
    saveToStorage('notifications', this.notifications);
  }

  private createNotification(notif: Omit<InAppNotification, 'id' | 'createdAt' | 'isRead'>): void {
    const newNotif: InAppNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications = [newNotif, ...this.notifications];
    saveToStorage('notifications', this.notifications);
  }

  // --- Daily 9 AM–5 PM Routine ---
  public getDailyCheckIns(): DailyCheckInRecord[] {
    return [...this.dailyCheckIns];
  }

  public submitDailyCheckIn(data: {
    todayPlan: string[];
    yesterdayCompleted: string[];
    blockers: string;
    assistanceNeeded: string;
  }): DailyCheckInRecord {
    const currentUser = this.getCurrentUser();
    const newRecord: DailyCheckInRecord = {
      id: `chk-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatarUrl,
      departmentName: currentUser.departmentName,
      date: new Date().toISOString().split('T')[0],
      timeSubmitted: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WAT',
      todayPlan: data.todayPlan,
      yesterdayCompleted: data.yesterdayCompleted,
      blockers: data.blockers || 'None',
      assistanceNeeded: data.assistanceNeeded || 'None',
      status: 'SUBMITTED',
    };

    // Remove any existing check-in from today for this user
    this.dailyCheckIns = [
      newRecord,
      ...this.dailyCheckIns.filter(
        (c) => !(c.userId === currentUser.id && c.date === newRecord.date)
      ),
    ];
    saveToStorage('dailyCheckIns', this.dailyCheckIns);

    this.logAuditEvent(
      'DAILY_CHECKIN_SUBMITTED',
      `User: ${currentUser.email}`,
      `Completed 9 AM WAT daily standup check-in.`
    );

    return newRecord;
  }

  // --- Messages & Channels ---
  public getChannels(): MessageChannel[] {
    return [...this.channels];
  }

  public getMessages(channelId: string): ChatMessage[] {
    return this.chatMessages[channelId] || [];
  }

  public sendMessage(channelId: string, content: string): ChatMessage {
    const currentUser = this.getCurrentUser();
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      channelId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatarUrl,
      senderRole: currentUser.jobTitle,
      content,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    const currentList = this.chatMessages[channelId] || [];
    this.chatMessages[channelId] = [...currentList, newMsg];
    saveToStorage('chatMessages', this.chatMessages);

    // Update channel snippet
    this.channels = this.channels.map((ch) =>
      ch.id === channelId
        ? {
            ...ch,
            lastMessageSnippet: `${currentUser.name.split(' ')[0]}: ${content.slice(0, 45)}...`,
            lastMessageTime: newMsg.timestamp,
          }
        : ch
    );
    saveToStorage('channels', this.channels);

    return newMsg;
  }

  // --- Administration & Audit ---
  public getAuditLogs(): AuditLogItem[] {
    return [...this.auditLogs];
  }

  public logAuditEvent(action: string, targetResource: string, details: string): void {
    const currentUser = this.getCurrentUser();
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action,
      targetResource,
      details,
      ipAddress: '102.89.34.12 (Lagos, NG)',
      timestamp: new Date().toISOString(),
    };

    this.auditLogs = [newLog, ...this.auditLogs];
    saveToStorage('auditLogs', this.auditLogs);
  }

  public getInvitations(): Invitation[] {
    return [...this.invitations];
  }

  public inviteUser(data: {
    email: string;
    fullName: string;
    role: UserRole;
    departmentId: string;
  }): Invitation {
    const currentUser = this.getCurrentUser();
    const department = mockDepartments.find((d) => d.id === data.departmentId);
    const token = `inv_tok_${Math.random().toString(36).substring(2, 12)}`;

    const newInvite: Invitation = {
      id: `inv-${Date.now()}`,
      email: data.email,
      fullName: data.fullName,
      role: data.role,
      departmentId: data.departmentId,
      departmentName: department ? department.name : 'Engineering',
      inviterName: currentUser.name,
      token,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.invitations = [newInvite, ...this.invitations];
    saveToStorage('invitations', this.invitations);

    this.logAuditEvent(
      'USER_INVITATION_SENT',
      `User: ${data.email}`,
      `Created 48h invitation token with role ${data.role} in ${newInvite.departmentName}`
    );

    return newInvite;
  }

  public updateUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDED'): void {
    const currentUser = this.getCurrentUser();
    this.users = this.users.map((u) => (u.id === userId ? { ...u, status } : u));
    saveToStorage('users', this.users);

    this.logAuditEvent(
      'USER_STATUS_CHANGED',
      `User: ${userId}`,
      `${currentUser.name} changed status to ${status}. Active sessions invalidated.`
    );
  }

  public revokeUserSessions(userId: string): void {
    const currentUser = this.getCurrentUser();
    const targetUser = this.users.find((u) => u.id === userId);

    this.logAuditEvent(
      'SESSION_REVOCATION_TRIGGERED',
      `User: ${targetUser?.email || userId}`,
      `Immediate session kill initiated by ${currentUser.name}. All JWTs & refresh tokens blacklisted.`
    );
  }

  public acceptInvitation(token: string, newPassword: string): User {
    const inviteIndex = this.invitations.findIndex((i) => i.token === token && i.status === 'PENDING');
    if (inviteIndex === -1) {
      throw new Error('Invalid or expired invitation token');
    }

    const invite = this.invitations[inviteIndex];
    const department = mockDepartments.find((d) => d.id === invite.departmentId);

    const newUser: User = {
      id: `user-${Date.now().toString().slice(-4)}`,
      name: invite.fullName,
      email: invite.email,
      role: invite.role,
      roleTitle: invite.role.replace('_', ' '),
      departmentId: invite.departmentId,
      departmentName: department?.name || 'Engineering',
      departmentCode: department?.code || 'ENG',
      avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      status: 'ACTIVE',
      jobTitle: `${invite.role} Specialist`,
      joinedDate: new Date().toISOString().split('T')[0],
      workingHours: '9:00 AM – 5:00 PM WAT',
      timezone: 'Africa/Lagos (WAT)',
      whatsappOptIn: false,
      activeTasksCount: 0,
    };

    this.users = [...this.users, newUser];
    saveToStorage('users', this.users);

    this.invitations[inviteIndex] = { ...invite, status: 'ACCEPTED' };
    saveToStorage('invitations', this.invitations);

    this.currentUserId = newUser.id;
    saveToStorage('currentUserId', newUser.id);

    this.logAuditEvent(
      'INVITATION_ACCEPTED',
      `User: ${newUser.email}`,
      `Account activated with password setup. Initialized onboarding dashboard.`
    );

    return newUser;
  }
}

export const workspaceService = new WorkspaceService();
