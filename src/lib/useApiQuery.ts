import { DependencyList, useCallback, useEffect, useState } from 'react';

export interface ApiQuery<T> {
  data: T | undefined;
  error: unknown;
  reload: () => void;
}

/**
 * Runs a fetch when deps change, cancelling any previous one. Data from the last
 * success stays visible during a reload, so a table doesn't flash on every action.
 */
export function useApiQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
): ApiQuery<T> {
  const [state, setState] = useState<{ data?: T; error: unknown }>({ error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ data: current.data, error: null }));

    fetcher(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, error: null });
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
  return { data: state.data, error: state.error, reload };
}
