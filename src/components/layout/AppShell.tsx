import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from '../../lib/router';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

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
    <div className="min-h-screen bg-slate-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg text-sm font-medium text-brivent-700"
      >
        Skip to content
      </a>

      <Sidebar isOpenMobile={isMobileMenuOpen} onCloseMobile={closeMobileMenu} />

      <div className="flex flex-col min-h-screen lg:pl-64">
        <TopNavbar onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
