import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  Bell,
  Search,
  Plus,
  CheckCheck,
  ExternalLink,
  Menu,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface TopNavbarProps {
  onOpenMobileMenu: () => void;
  onOpenNewTaskModal: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onOpenMobileMenu,
  onOpenNewTaskModal,
}) => {
  const {
    currentUser,
    notifications,
    unreadNotifCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    setIsSearchOpen,
    setActiveTab,
    hasPermission,
  } = useWorkspace();

  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canCreateTask = hasPermission('CREATE_TASK');

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Mobile Toggle & Workspace Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brivent-600 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
            B
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-sm tracking-tight">
                Brivent Workspace
              </span>
              <span className="text-[10px] uppercase font-semibold text-brivent-600 bg-brivent-50 border border-brivent-200 px-1.5 py-0.2 rounded">
                WAT
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Brivent Global Innovations Limited
            </p>
          </div>
        </div>
      </div>

      {/* Middle: Global Search Button */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-1.5 text-sm text-slate-500 bg-slate-100 hover:bg-slate-150/80 border border-slate-200 rounded-lg transition-colors group"
        >
          <span className="flex items-center gap-2 text-slate-400 group-hover:text-slate-600">
            <Search className="w-4 h-4" />
            <span>Search tasks, projects, docs, colleagues...</span>
          </span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions, Notifications & Profile */}
      <div className="flex items-center gap-3">
        {/* Mobile search icon */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg md:hidden"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Quick Create Task Button */}
        {canCreateTask && (
          <Button
            size="sm"
            variant="primary"
            onClick={onOpenNewTaskModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="hidden sm:inline-flex"
          >
            New Task
          </Button>
        )}

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifDropdownOpen((prev) => !prev)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg relative transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadNotifCount}
              </span>
            )}
          </button>

          {isNotifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Notifications</h4>
                  <p className="text-[11px] text-slate-500">
                    {unreadNotifCount} unread workspace alert{unreadNotifCount !== 1 ? 's' : ''}
                  </p>
                </div>
                {unreadNotifCount > 0 && (
                  <button
                    onClick={markAllNotificationsAsRead}
                    className="text-xs text-brivent-600 hover:text-brivent-700 font-medium flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No notifications right now.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markNotificationAsRead(n.id);
                        setActiveTab('tasks');
                        setIsNotifDropdownOpen(false);
                      }}
                      className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-3 ${
                        !n.isRead ? 'bg-brivent-50/40' : ''
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 mt-0.5">
                        <Sparkles className="w-4 h-4 text-brivent-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-xs ${!n.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            Just now
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/70 text-center">
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setIsNotifDropdownOpen(false);
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  Configure WhatsApp & Email channels →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Current User Pill */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.name}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
          />
          <div className="hidden xl:block text-left">
            <p className="text-xs font-semibold text-slate-900 leading-tight">
              {currentUser.name}
            </p>
            <p className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
              {currentUser.departmentName}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

