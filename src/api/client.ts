const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
/** Where the API lives, without /api. Socket.IO connects here. */
export const API_ORIGIN = BASE_URL ? new URL(BASE_URL).origin : window.location.origin;

const TOKEN_KEY = 'brivent.authToken';
const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Per-field messages from a VALIDATION_ERROR, keyed by field name. */
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isForbidden() {
    return this.status === 403;
  }
}

/** The message to show a person for any error thrown by a request. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Other 403 codes carry a specific reason worth showing, such as SELF_DEACTIVATION.
    return error.code === 'FORBIDDEN' ? "You don't have access to do that." : error.message;
  }
  return 'Something went wrong. Please try again.';
}

// sessionStorage, not localStorage: it survives a refresh but not closing the tab, which
// limits how long an XSS bug could reach the token.
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage blocked: the request that needs the token fails with a 401 and returns to login.
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored, so nothing to clear.
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registers what happens when the session dies. The auth context owns this. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Sends no token, and a 401 is a form error rather than an expired session. */
  anonymous?: boolean;
  /** Sends this token rather than the stored one, for a session that is already closing. */
  token?: string;
}

interface ErrorPayload {
  error?: {
    code?: string;
    message?: string;
    details?: { fields?: { path: string; message: string }[] };
  };
}

function toApiError(status: number, payload: ErrorPayload | null): ApiError {
  const { code = 'UNKNOWN_ERROR', message, details } = payload?.error ?? {};
  const fields = details?.fields ?? [];
  const fieldErrors = Object.fromEntries(fields.map((field) => [field.path, field.message]));
  // "The request is invalid." helps nobody when the real reason is in the details.
  const best = code === 'VALIDATION_ERROR' && fields[0] ? fields[0].message : message;
  return new ApiError(status, code, best ?? 'Something went wrong. Please try again.', fieldErrors);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, anonymous = false } = options;

  if (!BASE_URL) {
    throw new ApiError(0, 'CONFIG_ERROR', 'The app is missing VITE_API_BASE_URL. See .env.example.');
  }

  const token = anonymous ? null : (options.token ?? getToken());
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const timeout = AbortSignal.timeout(TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw timeout.aborted
      ? new ApiError(0, 'TIMEOUT', 'The server took too long to respond. Please try again.')
      : new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Check your connection and try again.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload as T;

  // A request sent with a token that has since been replaced says nothing about the
  // current session, for example one still in flight when a password change rotates it.
  if (response.status === 401 && token && token === getToken()) {
    clearToken();
    unauthorizedHandler?.();
  }

  throw toApiError(response.status, payload as ErrorPayload | null);
}
