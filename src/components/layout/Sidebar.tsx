import React, { useEffect } from 'react';
import { useSession } from '../../context/AuthContext';
import logo from '../../assets/brivent/logos/brivent-logo-cobalt-lavender.svg';
import { Action } from '../../lib/permissions';
import { Icon, IconName } from '../ui/Icon';
import { Link, usePathname } from '../../lib/router';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  comingSoon?: boolean;
  action?: Action;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Daily work',
    items: [
      { to: '/', label: 'Dashboard', icon: 'space_dashboard' },
      { to: '/daily', label: 'Daily Check-in', icon: 'edit_note', comingSoon: true },
      {
        to: '/tasks',
        label: 'My Tasks',
        icon: 'task_alt',
        action: 'viewOwnTasks',
      },
      { to: '/projects', label: 'Projects', icon: 'folder_open', comingSoon: true },
      { to: '/messages', label: 'Internal Messages', icon: 'forum', comingSoon: true },
      { to: '/calendar', label: 'Meetings & Schedule', icon: 'calendar_month', comingSoon: true },
    ],
  },
  {
    title: 'Company',
    items: [
      { to: '/docs', label: 'Knowledge & SOPs', icon: 'menu_book', comingSoon: true },
      {
        to: '/directory',
        label: 'Team Directory',
        icon: 'groups',
        action: 'viewDirectory',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        to: '/users',
        label: 'User Management',
        icon: 'manage_accounts',
        action: 'viewUsers',
      },
      { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

interface SidebarProps {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpenMobile, onCloseMobile }) => {
  const { can } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    if (!isOpenMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpenMobile, onCloseMobile]);

  return (
    <>
      {isOpenMobile && (
        <div
          className="scrim fixed inset-0 z-40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* `invisible` keeps the closed off-canvas links out of the tab order. */}
      <aside
        className={`nav fixed inset-y-0 left-0 z-50 transition-transform duration-200 lg:visible lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="nav-brand">
          <img src={logo} alt="Brivent" />
          <span className="ws grow">Workspace</span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden text-nav-text hover:text-white rounded"
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav aria-label="Main" className="grow overflow-y-auto">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => !item.action || can(item.action));
            if (items.length === 0) return null;

            return (
              <div key={section.title}>
                <h2 className="nav-label">{section.title}</h2>
                <ul>
                  {items.map(({ to, label, icon, comingSoon }) => {
                    const isActive = pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
                    return (
                      <li key={to}>
                        <Link
                          to={to}
                          onClick={onCloseMobile}
                          aria-current={isActive ? 'page' : undefined}
                          className={`nav-item ${isActive ? 'on' : ''}`}
                        >
                          <Icon name={icon} filled={isActive} />
                          <span className="grow truncate">{label}</span>
                          {comingSoon && <span className="text-caption text-nav-label">Soon</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
