import React from 'react';
import { useSession } from '../../context/AuthContext';
import { Link, usePathname } from '../../lib/router';
import { Icon, IconName } from '../ui/Icon';
import { BOTTOM_BAR_PATHS, isNavActive } from './navItems';

/** Under 768px this replaces the sidebar. Everything else lives behind More. */
export const BottomBar: React.FC = () => {
  const { can } = useSession();
  const pathname = usePathname();

  const tabs: { to: string; label: string; icon: IconName }[] = [
    { to: '/', label: 'Home', icon: 'space_dashboard' },
    { to: '/tasks', label: 'Tasks', icon: 'task_alt' },
    { to: '/daily', label: can('viewTeamDashboard') ? 'Check-ins' : 'Check-in', icon: 'edit_note' },
    { to: '/messages', label: 'Messages', icon: 'forum' },
    { to: '/more', label: 'More', icon: 'menu' },
  ];

  const isMore = !BOTTOM_BAR_PATHS.some((to) => isNavActive(to, pathname));

  return (
    <nav aria-label="Main" className="bottom-bar">
      {tabs.map(({ to, label, icon }) => {
        const isActive = to === '/more' ? isMore : isNavActive(to, pathname);
        return (
          <Link
            key={to}
            to={to}
            aria-current={isActive ? 'page' : undefined}
            className={`bottom-tab ${isActive ? 'on' : ''}`}
          >
            <Icon name={icon} filled={isActive} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
};
