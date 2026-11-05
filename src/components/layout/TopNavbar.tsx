import React, { useEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, LogOut, Menu, UserRound } from 'lucide-react';
import { ROLE_LABELS } from '../../api/types';
import { useAuth, useSession } from '../../context/AuthContext';
import { Link, usePathname } from '../../lib/router';
import { Avatar } from '../ui/Avatar';

const UserMenu: React.FC = () => {
  const { signOut } = useAuth();
  const { user } = useSession();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setIsOpen(false), [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={`Account menu for ${user.fullName}`}
        className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
      >
        <Avatar name={user.fullName} className="w-8 h-8 text-sm" />
        <span className="hidden sm:block text-left min-w-0 max-w-[12rem]">
          <span className="block text-sm font-medium text-slate-900 truncate">{user.fullName}</span>
          <span className="block text-xs text-slate-600">{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-40">
          <div className="px-4 py-3 border-b border-slate-200">
            <p className="text-sm font-medium text-slate-900 truncate">{user.fullName}</p>
            <p className="text-sm text-slate-600 truncate">{user.email}</p>
          </div>
          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:-outline-offset-2"
          >
            <UserRound className="w-4 h-4" aria-hidden="true" />
            Profile
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:-outline-offset-2"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};

export const TopNavbar: React.FC<{ onOpenMobileMenu: () => void }> = ({ onOpenMobileMenu }) => (
  <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between lg:justify-end gap-2 sticky top-0 z-30">
    <button
      type="button"
      onClick={onOpenMobileMenu}
      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden"
      aria-label="Open navigation"
    >
      <Menu className="w-5 h-5" aria-hidden="true" />
    </button>

    <div className="flex items-center gap-2">
      <Link
        to="/notifications"
        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
      </Link>
      <UserMenu />
    </div>
  </header>
);
