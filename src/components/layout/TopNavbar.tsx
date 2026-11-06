import React, { useEffect, useRef, useState } from 'react';
import brandIcon from '../../assets/brivent/logos/brivent-icon-cobalt.svg';
import { useAuth, useSession } from '../../context/AuthContext';
import { personTitle } from '../../lib/people';
import { Link, navigate, usePathname } from '../../lib/router';
import { resolveRoute } from '../../routes';
import { TaskFormModal } from '../tasks/TaskFormModal';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

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
          <span className="block text-caption text-text-2 truncate">{personTitle(user)}</span>
        </span>
        <Icon name="expand_more" size="sm" />
      </button>

      {isOpen && (
        <div className="popover absolute right-0 mt-2 w-64 p-1.5 z-40">
          <div className="px-3 py-2 mb-1 border-b border-border">
            <p className="font-semibold text-text truncate">{user.fullName}</p>
            <p className="text-small text-text-2 truncate">{personTitle(user)}</p>
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

/** Phones have no sidebar to say where you are, so the bar does. */
function usePhoneTitle(): string {
  const pathname = usePathname();
  if (pathname === '/') return 'Home';
  if (pathname === '/more') return 'Brivent';
  return resolveRoute(pathname)?.title ?? 'Brivent';
}

export const TopNavbar: React.FC<{ hideOnPhone?: boolean }> = ({ hideOnPhone = false }) => {
  const { can } = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const title = usePhoneTitle();

  return (
    <header
      className={`topbar justify-between md:justify-end sticky top-0 z-30 ${
        hideOnPhone ? 'max-md:hidden' : ''
      }`}
    >
      <div className="md:hidden flex items-center gap-2 min-w-0">
        <img src={brandIcon} alt="" className="w-6 h-6 shrink-0" />
        <span className="t-h3 truncate">{title}</span>
      </div>

      <div className="flex items-center gap-3">
        {can('createTask') && (
          <Button icon="add" onClick={() => setIsCreating(true)} className="hidden md:inline-flex">
            New task
          </Button>
        )}
        <UserMenu />
      </div>

      {isCreating && (
        <TaskFormModal
          onClose={() => setIsCreating(false)}
          onSaved={(task) => {
            setIsCreating(false);
            navigate(`/tasks/${task.id}`);
          }}
        />
      )}
    </header>
  );
};
