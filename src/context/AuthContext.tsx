import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as authApi from '../api/auth';
import { ApiError, clearToken, getToken, setUnauthorizedHandler } from '../api/client';
import { Session } from '../api/types';
import { navigate } from '../lib/router';
import { useToast } from './ToastContext';

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'failed'; error: unknown }
  | { status: 'authenticated'; session: Session };

interface AuthApi {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Re-reads the session, for after an edit that may have changed the logged-in user. */
  refresh: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthApi | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const [state, setState] = useState<AuthState>(() =>
    getToken() ? { status: 'loading' } : { status: 'anonymous' },
  );
  const [attempt, setAttempt] = useState(0);

  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setState({ status: 'anonymous' });
      toastRef.current.error('Your session has expired. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!getToken()) return;

    const controller = new AbortController();
    setState({ status: 'loading' });

    authApi.getMe(controller.signal).then(
      (session) => {
        if (!controller.signal.aborted) setState({ status: 'authenticated', session });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        // A 401 has already been handled by the client. Anything else, like the server
        // being down, doesn't mean the session is bad, so the token is kept for a retry.
        if (error instanceof ApiError && error.status === 401) return;
        setState({ status: 'failed', error });
      },
    );

    return () => controller.abort();
  }, [attempt]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(email, password);
    setState({ status: 'authenticated', session });
  }, []);

  const signOut = useCallback(() => {
    const token = getToken();
    clearToken();
    setState({ status: 'anonymous' });
    navigate('/login', { replace: true });
    // Signing out never waits on this. If it fails the token is already gone from this
    // browser, and it expires by itself on the server.
    if (token) authApi.logout(token).catch(() => {});
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const session = await authApi.changePassword(currentPassword, newPassword);
    setState({ status: 'authenticated', session });
  }, []);

  const refresh = useCallback(async () => {
    const session = await authApi.getMe();
    setState({ status: 'authenticated', session });
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({ state, signIn, signOut, changePassword, refresh, retry }),
    [state, signIn, signOut, changePassword, refresh, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

/** For anything rendered behind the login: the session is guaranteed to exist there. */
export const useSession = () => {
  const { state } = useAuth();
  if (state.status !== 'authenticated') {
    throw new Error('useSession must be used behind authentication');
  }

  const { user, permissions } = state.session;
  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions],
  );
  return { user, hasPermission };
};
