/**
 * What the UI can offer, based on the design's permission matrix. Each action reads one permission
 * from GET /me, so the backend's rules decide: Team Leads can assign anyone, and only Super Admin
 * and Admin can delete tasks. Hiding is for clarity. The server checks every action again.
 */
const ACTIONS = {
  viewOwnTasks: 'tasks.view_own',
  changeOwnTaskStatus: 'tasks.update_own_status',
  commentOnTask: 'tasks.comment',
  createTask: 'tasks.create',
  assignTask: 'tasks.assign',
  editAnyTask: 'tasks.edit_all',
  deleteTask: 'tasks.delete',
  viewAllTasks: 'tasks.view_all',
  viewTeamDashboard: 'tasks.view_all',
  submitCheckin: 'updates.submit',
  viewTeamCheckins: 'updates.view_all',
  reviewCheckins: 'updates.review',
  viewProjects: 'projects.view_own',
  createProject: 'projects.create',
  updateOwnProject: 'projects.update',
  manageAllProjects: 'projects.manage_all',
  viewMeetings: 'meetings.view',
  createMeeting: 'meetings.create',
  manageAllMeetings: 'meetings.manage_all',
  useMessages: 'messages.use',
  createChannel: 'channels.create',
  deleteAnyMessage: 'messages.delete_any',
  viewLearning: 'learning.view',
  createTrack: 'learning.create',
  manageAllLearning: 'learning.manage_all',
  reviewAllLearning: 'learning.review_all',
  viewDirectory: 'directory.view',
  viewUsers: 'users.view_all',
  inviteUser: 'users.create',
  updateUser: 'users.update',
  deactivateUser: 'users.deactivate',
  assignSuperAdmin: 'users.assign_super_admin',
  resetUserPassword: 'users.reset_password',
  resendInvite: 'users.resend_invite',
  manageDepartments: 'departments.manage',
} as const;

export type Action = keyof typeof ACTIONS;

export function can(session: { permissions: readonly string[] }, action: Action): boolean {
  return session.permissions.includes(ACTIONS[action]);
}
