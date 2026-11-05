import React from 'react';
import { PERMISSIONS } from './lib/permissions';
import { CalendarView } from './views/CalendarView';
import { DailyRoutineView } from './views/DailyRoutineView';
import { DashboardView } from './views/DashboardView';
import { DirectoryView } from './views/DirectoryView';
import { DocumentsView } from './views/DocumentsView';
import { MessagesView } from './views/MessagesView';
import { NotificationsView } from './views/NotificationsView';
import { ProjectsView } from './views/ProjectsView';
import { SettingsView } from './views/SettingsView';
import { TaskDetailView } from './views/TaskDetailView';
import { TasksView } from './views/TasksView';
import { UsersView } from './views/UsersView';

interface AppRoute {
  title: string;
  element: React.ReactNode;
  /** Required to see the page. Pages without one are open to anyone signed in. */
  permission?: string;
}

const ROUTES: Record<string, AppRoute> = {
  '/': { title: 'Dashboard', element: <DashboardView /> },
  '/daily': { title: 'Daily Check-in', element: <DailyRoutineView /> },
  '/tasks': {
    title: 'My Tasks',
    element: <TasksView />,
    permission: PERMISSIONS.TASKS_VIEW_OWN,
  },
  '/projects': { title: 'Projects', element: <ProjectsView /> },
  '/messages': { title: 'Internal Messages', element: <MessagesView /> },
  '/calendar': { title: 'Meetings & Schedule', element: <CalendarView /> },
  '/docs': { title: 'Knowledge & SOPs', element: <DocumentsView /> },
  '/directory': {
    title: 'Team Directory',
    element: <DirectoryView />,
    permission: PERMISSIONS.DIRECTORY_VIEW,
  },
  '/notifications': { title: 'Notifications', element: <NotificationsView /> },
  '/settings': { title: 'Settings', element: <SettingsView /> },
  '/profile': { title: 'Settings', element: <SettingsView /> },
  '/users': {
    title: 'User Management',
    element: <UsersView />,
    permission: PERMISSIONS.USERS_VIEW_ALL,
  },
};

export function resolveRoute(pathname: string): AppRoute | undefined {
  const taskId = pathname.match(/^\/tasks\/([^/]+)$/)?.[1];
  if (taskId) {
    return {
      title: 'Task',
      element: <TaskDetailView key={taskId} taskId={taskId} />,
      permission: PERMISSIONS.TASKS_VIEW_OWN,
    };
  }
  return ROUTES[pathname];
}
