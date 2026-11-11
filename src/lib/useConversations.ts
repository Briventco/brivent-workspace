import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listConversations } from '../api/messages';
import { Conversation } from '../api/types';
import { ApiQuery, readQueryCache, writeQueryCache } from './useApiQuery';

const CACHE_KEY = 'conversations';

/**
 * Like useApiQuery, but this list reloads on every event, so a failed reload keeps what's on
 * screen. Only the first load can fail visibly, and only the newest response counts.
 */
export function useConversations() {
  const [data, setStoredData] = useState<Conversation[] | undefined>(() =>
    readQueryCache<Conversation[]>(CACHE_KEY),
  );
  const setData = useCallback(
    (update: Conversation[] | ((list: Conversation[] | undefined) => Conversation[] | undefined)) => {
      setStoredData((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        if (next) writeQueryCache(CACHE_KEY, next);
        return next;
      });
    },
    [],
  );
  const [error, setError] = useState<unknown>(null);
  const latest = useRef(0);

  const reload = useCallback(() => {
    latest.current += 1;
    const request = latest.current;
    setError(null);
    listConversations().then(
      (conversations) => {
        if (request === latest.current) setData(conversations);
      },
      (failure: unknown) => {
        if (request === latest.current) setError(failure);
      },
    );
  }, [setData]);

  useEffect(reload, [reload]);

  const patch = useCallback((id: string, changes: Partial<Conversation>) => {
    setData((list) =>
      list?.map((conversation) =>
        conversation.id === id ? { ...conversation, ...changes } : conversation,
      ),
    );
  }, [setData]);

  /** Puts a new conversation in place at once, so opening it can't outrun the reload. */
  const add = useCallback((conversation: Conversation) => {
    setData((list) => [
      conversation,
      ...(list ?? []).filter(({ id }) => id !== conversation.id),
    ]);
  }, [setData]);

  const mutate = useCallback(
    (update: (current: Conversation[]) => Conversation[]) =>
      setData((list) => (list ? update(list) : list)),
    [setData],
  );

  const query: ApiQuery<Conversation[]> = useMemo(
    () => ({ data, error: data ? null : error, reload, mutate }),
    [data, error, reload, mutate],
  );

  return { query, patch, add };
}
