import React, { useSyncExternalStore } from 'react';

const LOCATION_CHANGE = 'brivent:locationchange';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(LOCATION_CHANGE, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(LOCATION_CHANGE, onChange);
  };
}

export const usePathname = () => useSyncExternalStore(subscribe, () => window.location.pathname);

export function navigate(to: string, { replace = false } = {}): void {
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(LOCATION_CHANGE));
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export const Link: React.FC<LinkProps> = ({ to, onClick, children, ...props }) => (
  <a
    href={to}
    onClick={(e) => {
      onClick?.(e);
      // Leave cmd/ctrl-click and friends to the browser.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to);
    }}
    {...props}
  >
    {children}
  </a>
);
