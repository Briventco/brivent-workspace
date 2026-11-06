import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { ROLE_LABELS } from '../../api/types';
import { useAuth, useSession } from '../../context/AuthContext';
import { Link, usePathname } from '../../lib/router';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/Button';

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
        className="me"
      >
        <Avatar name={user.fullName} id={user.id} />
        <span className="hidden sm:block text-left min-w-0 max-w-[12rem]">
          <span className="block font-semibold text-text truncate">{user.fullName}</span>
          <span className="block text-caption text-text-2">{ROLE_LABELS[user.role]}</span>
        </span>
        <Icon name="expand_more" size="sm" />
      </button>

      {isOpen && (
        <div className="popover absolute right-0 mt-2 w-64 p-1.5 z-40">
          <div className="px-3 py-2 mb-1 border-b border-border">
            <p className="font-semibold text-text truncate">{user.fullName}</p>
            <p className="text-small text-text-2 truncate">{user.email}</p>
          </div>
          <Link
            to="/settings"
            className="menu-item hover:no-underline"
          >
            <Icon name="settings" />
            Settings
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="menu-item"
          >
            <Icon name="logout" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
};

export const TopNavbar: React.FC<{ onOpenMobileMenu: () => void }> = ({ onOpenMobileMenu }) => (
  <header className="topbar justify-between lg:justify-end sticky top-0 z-30">
    <IconButton
      icon="menu"
      label="Open navigation"
      onClick={onOpenMobileMenu}
      className="lg:hidden"
    />

    <div className="flex items-center gap-2">
      <UserMenu />
    </div>
  </header>
);
