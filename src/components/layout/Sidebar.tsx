import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  MessageSquare,
  FileText,
  Users,
  ShieldAlert,
  Settings,
  Calendar,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';
import { Badge } from '../ui/Badge';

interface SidebarProps {
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpenMobile,
  onCloseMobile,
}) => {
  const { activeTab, setActiveTab, currentUser, hasPermission, unreadNotifCount } = useWorkspace();

  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
  const isOps = currentUser.role === 'OPERATIONS';
  const canAccessAdmin = isSuperAdmin || isOps;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'daily',
      label: 'Daily 9–5 Check-in',
      icon: <Clock className="w-4 h-4" />,
      badge: '9 AM WAT',
    },
    {
      id: 'tasks',
      label: 'My Tasks',
      icon: <CheckSquare className="w-4 h-4" />,
      count: currentUser.activeTasksCount || 3,
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: <FolderKanban className="w-4 h-4" />,
    },
    {
      id: 'messages',
      label: 'Internal Messages',
      icon: <MessageSquare className="w-4 h-4" />,
      count: 2,
    },
    {
      id: 'calendar',
      label: 'Meetings & Schedule',
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

  const resourceItems = [
    {
      id: 'docs',
      label: 'Knowledge & SOPs',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      id: 'directory',
      label: 'Team Directory',
      icon: <Users className="w-4 h-4" />,
    },
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-64 bg-slate-900 text-slate-300 z-50 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-3">
          <div className="w-8 h-8 rounded-lg bg-brivent-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
            B
          </div>
          <div>
            <h1 className="font-bold text-white text-sm tracking-tight leading-tight">
              Brivent Workspace
            </h1>
            <p className="text-[11px] text-slate-400">Internal Operations Hub</p>
          </div>
        </div>

        {/* Current User Role Card */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-brivent-500/50"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser.name}
              </p>
              <p className="text-[11px] text-brivent-300 truncate font-medium">
                {currentUser.roleTitle}
              </p>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {currentUser.departmentName}
            </span>
            <span className="text-slate-400 font-mono">WAT (UTC+1)</span>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {/* Main Work section */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Daily Work
            </p>
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brivent-600 text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="text-[10px] bg-brivent-950 text-brivent-300 border border-brivent-800 px-1.5 py-0.5 rounded">
                        {item.badge}
                      </span>
                    )}
                    {item.count !== undefined && !item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-brivent-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resources section */}
          <div>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Company Knowledge
            </p>
            <div className="space-y-1">
              {resourceItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brivent-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Governance & Administration (strictly access-controlled) */}
          <div>
            <div className="px-3 flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Organization
              </span>
              {!canAccessAdmin && (
                <span title="Restricted to Super Admin & Operations">
                  <Lock className="w-3 h-3 text-slate-600" />
                </span>
              )}
            </div>

            <div className="space-y-1">
              {canAccessAdmin ? (
                <button
                  onClick={() => handleNavClick('admin')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'admin'
                      ? 'bg-rose-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Admin & Audit</span>
                  </span>
                  <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded">
                    RBAC
                  </span>
                </button>
              ) : (
                <div className="px-3 py-2 text-[11px] text-slate-500 italic bg-slate-950/40 rounded-lg border border-slate-800">
                  Admin portal restricted to authorized personnel.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Footer & Settings */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <button
            onClick={() => handleNavClick('settings')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-brivent-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Settings className="w-4 h-4" />
              <span>Settings & Integrations</span>
            </span>
            <span className="text-[10px] text-slate-500">WhatsApp / API</span>
          </button>

          <div className="px-3 py-2 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Brivent v1.0 (MVP)</span>
            <span>Policy: 9AM–5PM WAT</span>
          </div>
        </div>
      </aside>
    </>
  );
};
