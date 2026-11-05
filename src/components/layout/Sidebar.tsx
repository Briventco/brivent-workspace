import React, { useEffect } from 'react';
import {
  Calendar,
  CheckSquare,
  Clock,
  Contact,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LucideIcon,
  MessageSquare,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useSession } from '../../context/AuthContext';
import { PERMISSIONS } from '../../lib/permissions';
import { Link, usePathname } from '../../lib/router';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  permission?: string;
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Daily work',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/daily', label: 'Daily Check-in', icon: Clock, comingSoon: true },
      {
        to: '/tasks',
        label: 'My Tasks',
        icon: CheckSquare,
        permission: PERMISSIONS.TASKS_VIEW_OWN,
      },
      { to: '/projects', label: 'Projects', icon: FolderKanban, comingSoon: true },
      { to: '/messages', label: 'Internal Messages', icon: MessageSquare, comingSoon: true },
      { to: '/calendar', label: 'Meetings & Schedule', icon: Calendar, comingSoon: true },
    ],
  },
  {
    title: 'Company',
    items: [
      { to: '/docs', label: 'Knowledge & SOPs', icon: FileText, comingSoon: true },
      {
        to: '/directory',
        label: 'Team Directory',
        icon: Contact,
        permission: PERMISSIONS.DIRECTORY_VIEW,
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        to: '/users',
        label: 'User Management',
        icon: ShieldCheck,
        permission: PERMISSIONS.USERS_VIEW_ALL,
      },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpenMobile, onCloseMobile }) => {
  const { hasPermission } = useSession();
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
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* `invisible` keeps the closed off-canvas links out of the tab order. */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 z-50 flex flex-col transition-transform duration-200 lg:visible lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800 shrink-0">
          <img src="/logo.svg" alt="" className="w-8 h-8" />
          <span className="flex-1 font-bold text-white tracking-tight">Brivent Workspace</span>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter(
              (item) => !item.permission || hasPermission(item.permission),
            );
            if (items.length === 0) return null;

            return (
              <div key={section.title}>
                <h2 className="px-3 mb-2 text-xs font-semibold text-slate-400">{section.title}</h2>
                <ul className="space-y-1">
                  {items.map(({ to, label, icon: Icon, comingSoon }) => {
                    const isActive = pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
                    return (
                      <li key={to}>
                        <Link
                          to={to}
                          onClick={onCloseMobile}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-brivent-400 ${
                            isActive
                              ? 'bg-brivent-600 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span className="flex-1 truncate">{label}</span>
                          {comingSoon && (
                            <span
                              className={`text-xs ${isActive ? 'text-brivent-100' : 'text-slate-400'}`}
                            >
                              Soon
                            </span>
                          )}
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
