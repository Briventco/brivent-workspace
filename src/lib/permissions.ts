/** Permission names from the backend's GET /me. The UI checks these, never role names. */
export const PERMISSIONS = {
  USERS_VIEW_ALL: 'users.view_all',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DEACTIVATE: 'users.deactivate',
  USERS_ASSIGN_SUPER_ADMIN: 'users.assign_super_admin',
  USERS_RESET_PASSWORD: 'users.reset_password',
  DIRECTORY_VIEW: 'directory.view',
  TASKS_CREATE: 'tasks.create',
  TASKS_VIEW_OWN: 'tasks.view_own',
  TASKS_VIEW_ALL: 'tasks.view_all',
  TASKS_EDIT_ALL: 'tasks.edit_all',
  TASKS_UPDATE_OWN_STATUS: 'tasks.update_own_status',
  TASKS_ASSIGN: 'tasks.assign',
  TASKS_DELETE: 'tasks.delete',
  TASKS_COMMENT: 'tasks.comment',
} as const;
