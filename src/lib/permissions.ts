/** Permission names from the backend's GET /me. The UI checks these, never role names. */
export const PERMISSIONS = {
  USERS_VIEW_ALL: 'users.view_all',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DEACTIVATE: 'users.deactivate',
  USERS_ASSIGN_SUPER_ADMIN: 'users.assign_super_admin',
} as const;
