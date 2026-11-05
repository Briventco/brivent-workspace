import { navigate } from './router';

export interface LoginHandoff {
  notice: string;
  email?: string;
}

/** Kept in history state rather than the URL, so an email address never lands in a link. */
export function goToLogin(handoff: LoginHandoff): void {
  navigate('/login', { replace: true, state: handoff });
}

export function readLoginHandoff(): LoginHandoff | null {
  const state: unknown = window.history.state;
  return state && typeof state === 'object' && 'notice' in state ? (state as LoginHandoff) : null;
}
