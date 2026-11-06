import React from 'react';
import { Action } from './lib/permissions';
import { CalendarView } from './views/CalendarView';
import { DailyCheckinView } from './views/DailyCheckinView';
import { DashboardView } from './views/DashboardView';
import { DirectoryView } from './views/DirectoryView';
import { DocumentsView } from './views/DocumentsView';
import { ForgotPasswordView } from './views/ForgotPasswordView';
import { MessagesView } from './views/MessagesView';
import { MoreView } from './views/MoreView';
import { NotificationsView } from './views/NotificationsView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { ProjectsView } from './views/ProjectsView';
import { ResetPasswordView } from './views/ResetPasswordView';
import { SetPasswordView } from './views/SetPasswordView';
import { SettingsView } from './views/SettingsView';
import { TaskDetailView } from './views/TaskDetailView';
import { TasksView } from './views/TasksView';
import { UsersView } from './views/UsersView';

interface AppRoute {
  title: string;
  element: React.ReactNode;
  /** Required to see the page. Pages without one are open to anyone signed in. */
  action?: Action;
}

// Dynamic and behind DEV, so production builds leave the gallery out entirely.
const DesignSystemView = import.meta.env.DEV
  ? React.lazy(() => import('./views/DesignSystemView'))
  : null;

const ROUTES: Record<string, AppRoute> = {
  '/': { title: 'Dashboard', element: <DashboardView /> },
  '/daily': { title: 'Daily Check-in', element: <DailyCheckinView />, action: 'submitCheckin' },
  '/tasks': {
    title: 'My Tasks',
    element: <TasksView />,
    action: 'viewOwnTasks',
  },
  '/projects': { title: 'Projects', element: <ProjectsView />, action: 'viewProjects' },
  '/messages': { title: 'Internal Messages', element: <MessagesView /> },
  '/calendar': { title: 'Meetings & Schedule', element: <CalendarView />, action: 'viewMeetings' },
  '/docs': { title: 'Knowledge & SOPs', element: <DocumentsView /> },
  '/directory': {
    title: 'Team Directory',
    element: <DirectoryView />,
    action: 'viewDirectory',
  },
  '/notifications': { title: 'Notifications', element: <NotificationsView /> },
  '/more': { title: 'More', element: <MoreView /> },
  '/settings': { title: 'Settings', element: <SettingsView /> },
  '/profile': { title: 'Settings', element: <SettingsView /> },
  '/users': {
    title: 'User Management',
    element: <UsersView />,
    action: 'viewUsers',
  },
};

/** Opened from an email or the login page, so they work signed out, signed in, or mid-loading. */
const PUBLIC_ROUTES: Record<string, AppRoute> = {
  '/set-password': { title: 'Set your password', element: <SetPasswordView /> },
  '/reset-password': { title: 'Reset your password', element: <ResetPasswordView /> },
  '/forgot-password': { title: 'Forgot password', element: <ForgotPasswordView /> },
  ...(DesignSystemView && {
    '/design-system': {
      title: 'Design system',
      element: (
        <React.Suspense fallback={null}>
          <DesignSystemView />
        </React.Suspense>
      ),
    },
  }),
};

export function resolvePublicRoute(pathname: string): AppRoute | undefined {
  return PUBLIC_ROUTES[pathname.replace(/\/+$/, '')];
}

export function resolveRoute(pathname: string): AppRoute | undefined {
  const taskId = pathname.match(/^\/tasks\/([^/]+)$/)?.[1];
  if (taskId) {
    return {
      title: 'Task',
      element: <TaskDetailView key={taskId} taskId={taskId} />,
      action: 'viewOwnTasks',
    };
  }
  const projectId = pathname.match(/^\/projects\/([^/]+)$/)?.[1];
  if (projectId) {
    return {
      title: 'Project',
      element: <ProjectDetailView key={projectId} projectId={projectId} />,
      action: 'viewProjects',
    };
  }
  return ROUTES[pathname];
}
