import React, { useEffect, useRef } from 'react';
import { usePathname } from '../../lib/router';
import { BottomBar } from './BottomBar';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { useSidebarCollapsed } from './useSidebarCollapsed';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebarCollapsed();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Moves focus with the page, so keyboard and screen reader users land on the new content.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:bg-surface focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg font-semibold"
      >
        Skip to content
      </a>

      <Sidebar isCollapsed={isCollapsed} onToggle={toggle} />

      <div className={`flex flex-col min-h-screen ${isCollapsed ? 'md:pl-16' : 'md:pl-[248px]'}`}>
        <TopNavbar />
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="grow w-full max-w-[1240px] px-4 pt-5 pb-24 md:px-8 md:pt-7 md:pb-12"
        >
          {children}
        </main>
      </div>

      <BottomBar />
    </div>
  );
};
