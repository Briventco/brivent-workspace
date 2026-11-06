import { useSession } from '../../context/AuthContext';
import { Action } from '../../lib/permissions';
import { IconName } from '../ui/Icon';

export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  comingSoon?: boolean;
  action?: Action;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const DAILY_WORK: NavSection = {
  title: 'Daily work',
  items: [
    { to: '/', label: 'Dashboard', icon: 'space_dashboard' },
    { to: '/daily', label: 'Daily Check-in', icon: 'edit_note', action: 'submitCheckin' },
    { to: '/tasks', label: 'My Tasks', icon: 'task_alt', action: 'viewOwnTasks' },
    { to: '/projects', label: 'Projects', icon: 'folder_open', action: 'viewProjects' },
    { to: '/messages', label: 'Internal Messages', icon: 'forum', comingSoon: true },
    { to: '/calendar', label: 'Meetings & Schedule', icon: 'calendar_month', action: 'viewMeetings' },
  ],
};

const COMPANY: NavSection = {
  title: 'Company',
  items: [
    { to: '/docs', label: 'Knowledge & SOPs', icon: 'menu_book', comingSoon: true },
    { to: '/directory', label: 'Team Directory', icon: 'groups', action: 'viewDirectory' },
  ],
};

const USERS: NavItem = { to: '/users', label: 'User Management', icon: 'manage_accounts' };
const SETTINGS: NavItem = { to: '/settings', label: 'Settings', icon: 'settings' };

/** Administration only shows for people who can manage users. Everyone else gets Account. */
export function useNavSections(): NavSection[] {
  const { can } = useSession();
  const last: NavSection = can('viewUsers')
    ? { title: 'Administration', items: [USERS, SETTINGS] }
    : { title: 'Account', items: [SETTINGS] };

  return [DAILY_WORK, COMPANY, last]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.action || can(item.action)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Always one tap away on a phone, so the More page leaves them out. */
export const BOTTOM_BAR_PATHS = ['/', '/tasks', '/daily', '/messages'];

export const isNavActive = (to: string, pathname: string) =>
  pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
