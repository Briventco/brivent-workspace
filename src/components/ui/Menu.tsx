import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { IconButton } from './Button';
import { Icon, IconName } from './Icon';

export interface MenuItem {
  label: string;
  icon: IconName;
  onSelect: () => void;
  tone?: 'danger';
  /** Draws a line above it, to set a destructive action apart. */
  separated?: boolean;
}

interface MenuProps {
  /** The button's name, such as "Actions for Ada Lovelace". */
  label: string;
  items: MenuItem[];
}

const WIDTH = 220;
const GAP = 4;

/**
 * A "..." menu. It's fixed to the viewport, so a scrolling table or a card's overflow can't clip
 * it. It follows its button while the page scrolls, and closes once the button leaves the screen.
 */
export const Menu: React.FC<MenuProps> = ({ label, items }) => {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const close = useCallback((returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  /** Below the button, or above it when there's no room below. False once it's off screen. */
  const place = useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return true;
    const trigger = triggerRef.current.getBoundingClientRect();
    if (trigger.bottom < 0 || trigger.top > window.innerHeight) return false;
    const height = menuRef.current.offsetHeight;
    const below = trigger.bottom + GAP;
    const top = below + height > window.innerHeight ? trigger.top - GAP - height : below;
    const left = Math.max(8, Math.min(trigger.right - WIDTH, window.innerWidth - WIDTH - 8));
    setPosition({ top: Math.max(8, top), left });
    return true;
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    place();
    // Focus without scrolling: a scroll here would move the page under the menu.
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointer = (e: MouseEvent) => {
      const path = e.composedPath();
      if (!path.includes(menuRef.current!) && !path.includes(triggerRef.current!)) close(false);
    };
    const follow = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (!place()) close(false);
    };
    document.addEventListener('mousedown', handlePointer);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [isOpen, close, place]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const options = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = options.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      options[(index + step + options.length) % options.length]?.focus();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      <IconButton
        ref={triggerRef}
        icon="more_horiz"
        size="sm"
        label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={handleKeyDown}
          className="popover fixed z-50 p-1.5"
          style={{ top: position.top, left: position.left, width: WIDTH }}
        >
          {items.map((item) => (
            <React.Fragment key={item.label}>
              {item.separated && <div role="separator" className="my-1 border-t border-border" />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={`menu-item ${item.tone === 'danger' ? 'text-danger' : ''}`}
                onClick={() => {
                  close(true);
                  item.onSelect();
                }}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
};
