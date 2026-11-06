import React from 'react';
import logo from '../../assets/brivent/logos/brivent-logo-cobalt-lavender.svg';
import icon from '../../assets/brivent/logos/brivent-icon-lavender.svg';
import { useRealtime } from '../../context/RealtimeContext';
import { Link, usePathname } from '../../lib/router';
import { CountBadge } from '../ui/CountBadge';
import { Icon } from '../ui/Icon';
import { isNavActive, useNavSections } from './navItems';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

/** From 768px up. Phones get the bottom bar instead. */
export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const sections = useNavSections();
  const pathname = usePathname();
  const { unreadBadge } = useRealtime();

  return (
    <aside className={`nav app-sidebar ${isCollapsed ? 'is-collapsed' : ''}`}>
      <div className="nav-brand">
        <img src={isCollapsed ? icon : logo} alt="Brivent" />
        {!isCollapsed && <span className="ws grow">Workspace</span>}
      </div>

      <nav aria-label="Main" className="grow overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="nav-label">{section.title}</h2>
            <ul>
              {section.items.map(({ to, label, icon: itemIcon, comingSoon }) => {
                const isActive = isNavActive(to, pathname);
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      title={isCollapsed ? label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={`nav-item ${isActive ? 'on' : ''}`}
                    >
                      <Icon name={itemIcon} filled={isActive} />
                      <span className="nav-text grow truncate">{label}</span>
                      {to === '/messages' && unreadBadge > 0 && (
                        <CountBadge count={unreadBadge} label="unread" />
                      )}
                      {comingSoon && !isCollapsed && (
                        <span className="text-caption text-nav-label">Soon</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="nav-foot">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expand sidebar' : undefined}
          className="nav-item w-full bg-transparent border-0 cursor-pointer"
        >
          <Icon name={isCollapsed ? 'left_panel_open' : 'left_panel_close'} />
          <span className="nav-text grow text-left">
            {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </span>
          {!isCollapsed && <kbd className="nav-key">[</kbd>}
        </button>
      </div>
    </aside>
  );
};
