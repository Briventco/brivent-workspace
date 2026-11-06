import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listConversations } from '../api/messages';
import { Conversation } from '../api/types';
import { ApiQuery } from './useApiQuery';

/**
 * Like useApiQuery, but this list reloads on every event, so a failed reload keeps what's on
 * screen. Only the first load can fail visibly, and only the newest response counts.
 */
export function useConversations() {
  const [data, setData] = useState<Conversation[]>();
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
  }, []);

  useEffect(reload, [reload]);

  const patch = useCallback((id: string, changes: Partial<Conversation>) => {
    setData((list) =>
      list?.map((conversation) =>
        conversation.id === id ? { ...conversation, ...changes } : conversation,
      ),
    );
  }, []);

  /** Puts a new conversation in place at once, so opening it can't outrun the reload. */
  const add = useCallback((conversation: Conversation) => {
    setData((list) => [
      conversation,
      ...(list ?? []).filter(({ id }) => id !== conversation.id),
    ]);
  }, []);

  const query: ApiQuery<Conversation[]> = useMemo(
    () => ({ data, error: data ? null : error, reload }),
    [data, error, reload],
  );

  return { query, patch, add };
}
