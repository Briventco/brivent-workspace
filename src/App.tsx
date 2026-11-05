import React, { useEffect } from 'react';
import { errorMessage } from './api/client';
import { Session } from './api/types';
import { AppShell } from './components/layout/AppShell';
import { AccessDenied, ErrorState, LoadingState } from './components/ui/AsyncState';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { navigate, usePathname } from './lib/router';
import { resolvePublicRoute, resolveRoute } from './routes';
import { ForcePasswordChangeView } from './views/ForcePasswordChangeView';
import { LoginView } from './views/LoginView';
import { NotFoundView } from './views/NotFoundView';

const LOGIN = '/login';
const CHANGE_PASSWORD = '/change-password';

/** The page to return to after login. Only same-site paths, so a link can't send someone away. */
function returnPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && /^\/(?!\/)/.test(next) ? next : '/';
}

function redirectFor(session: Session | null, pathname: string): string | null {
  if (resolvePublicRoute(pathname)) return null;
  if (!session) {
    if (pathname === LOGIN) return null;
    return pathname === '/' ? LOGIN : `${LOGIN}?next=${encodeURIComponent(pathname)}`;
  }
  if (session.user.mustChangePassword) {
    return pathname === CHANGE_PASSWORD ? null : CHANGE_PASSWORD;
  }
  return pathname === LOGIN || pathname === CHANGE_PASSWORD ? returnPath() : null;
}

function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | Brivent Workspace`;
  }, [title]);
}

const PublicPage: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  usePageTitle(title);
  return <>{children}</>;
};

const AuthenticatedPage: React.FC<{ session: Session; pathname: string }> = ({
  session,
  pathname,
}) => {
  const route = resolveRoute(pathname);
  usePageTitle(route?.title ?? 'Page not found');

  if (!route) return <NotFoundView />;
  if (route.permission && !session.permissions.includes(route.permission)) {
    return <AccessDenied />;
  }
  return <>{route.element}</>;
};

const Root: React.FC = () => {
  const { state, retry } = useAuth();
  const pathname = usePathname();

  const session = state.status === 'authenticated' ? state.session : null;
  const isSettled = state.status === 'authenticated' || state.status === 'anonymous';
  const redirect = isSettled ? redirectFor(session, pathname) : null;

  useEffect(() => {
    if (redirect) navigate(redirect, { replace: true });
  }, [redirect]);

  // Before any auth state: these never depend on who's signed in, or on /me succeeding.
  const publicRoute = resolvePublicRoute(pathname);
  if (publicRoute) return <PublicPage title={publicRoute.title}>{publicRoute.element}</PublicPage>;

  if (state.status === 'failed') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <ErrorState message={errorMessage(state.error)} onRetry={retry} />
        </div>
      </main>
    );
  }

  if (state.status === 'loading' || redirect) {
    return <LoadingState label="Loading your workspace…" />;
  }

  if (!session) return <LoginView />;
  if (session.user.mustChangePassword) return <ForcePasswordChangeView />;

  return (
    <AppShell>
      <AuthenticatedPage session={session} pathname={pathname} />
    </AppShell>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ToastProvider>
  );
}
