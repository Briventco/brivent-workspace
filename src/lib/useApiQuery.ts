import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

export interface ApiQuery<T> {
  data: T | undefined;
  error: unknown;
  reload: () => void;
  /** Changes what's on screen straight away, such as before a save the server hasn't confirmed. */
  mutate: (update: (current: T) => T) => void;
}

/**
 * The last answer for each page, so coming back to it shows something at once while it refreshes.
 * It only lives in memory, and the auth context empties it whenever the signed-in person changes.
 */
const cache = new Map<string, unknown>();

export function clearQueryCache(): void {
  cache.clear();
}

export function readQueryCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function writeQueryCache<T>(key: string, data: T): void {
  cache.set(key, data);
}

/**
 * Runs a fetch when deps change, cancelling any previous one. Data from the last
 * success stays visible during a reload, so a table doesn't flash on every action.
 * With a `cacheKey`, the page starts from its last answer instead of a skeleton.
 */
export function useApiQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  cacheKey?: string,
): ApiQuery<T> {
  const key = cacheKey ? `${cacheKey}|${JSON.stringify(deps)}` : null;
  const keyRef = useRef(key);
  keyRef.current = key;

  const [state, setState] = useState<{ data?: T; error: unknown }>(() => ({
    data: key ? readQueryCache<T>(key) : undefined,
    error: null,
  }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({
      data: key && cache.has(key) ? readQueryCache<T>(key) : current.data,
      error: null,
    }));

    fetcher(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        if (key) cache.set(key, data);
        setState({ data, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ error });
      },
    );

    return () => controller.abort();
    // The fetcher changes every render; deps say when it means something new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const mutate = useCallback((update: (current: T) => T) => {
    setState((current) => {
      if (current.data === undefined) return current;
      const data = update(current.data);
      if (keyRef.current) cache.set(keyRef.current, data);
      return { ...current, data };
    });
  }, []);

  return { data: state.data, error: state.error, reload, mutate };
}
