import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'brivent.sidebarCollapsed';
const NARROW = '(max-width: 1279px)';

function readStored(): boolean | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === null ? null : value === 'true';
  } catch {
    return null;
  }
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** Starts collapsed under 1280px, then remembers the choice per device. `[` toggles it. */
export function useSidebarCollapsed() {
  const [stored, setStored] = useState(readStored);
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW).matches);

  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const handleChange = () => setIsNarrow(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const isCollapsed = stored ?? isNarrow;

  const toggle = useCallback(() => {
    const next = !isCollapsed;
    setStored(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Blocked storage only means the choice lasts until the page reloads.
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      toggle();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { isCollapsed, toggle };
}
