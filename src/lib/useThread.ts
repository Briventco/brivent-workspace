import { useCallback, useEffect, useRef, useState } from 'react';
import { listMessages } from '../api/messages';
import { Message } from '../api/types';
import { mergeMessages, refreshQuotes } from './messages';

interface ThreadState {
  /** Oldest first. */
  messages: Message[];
  isLoaded: boolean;
  hasMore: boolean;
  error: unknown;
  isLoadingOlder: boolean;
  olderFailed: boolean;
}

const INITIAL: ThreadState = {
  messages: [],
  isLoaded: false,
  hasMore: false,
  error: null,
  isLoadingOlder: false,
  olderFailed: false,
};

/** One conversation's messages. Everything that arrives goes through a merge on id. */
export function useThread(conversationId: string | null) {
  const [state, setState] = useState(INITIAL);
  const currentId = useRef(conversationId);
  currentId.current = conversationId;
  const latest = useRef(state);
  latest.current = state;

  const fetchLatest = useCallback(
    async (signal?: AbortSignal) => {
      if (!conversationId) return;
      const { messages, hasMore } = await listMessages(conversationId, undefined, signal);
      if (currentId.current !== conversationId || signal?.aborted) return;

      const newest = [...messages].reverse();
      setState((current) => {
        const known = new Set(current.messages.map(({ id }) => id));
        const joinsUp = current.isLoaded && newest.some(({ id }) => known.has(id));
        // More than a page went by unseen, so what's held can't be joined to this. Starting
        // again from the newest page beats a hole in the conversation.
        return joinsUp
          ? { ...current, messages: mergeMessages(current.messages, newest), error: null }
          : { ...current, messages: newest, hasMore, isLoaded: true, error: null };
      });
    },
    [conversationId],
  );

  useEffect(() => {
    setState(INITIAL);
    if (!conversationId) return;

    const controller = new AbortController();
    fetchLatest(controller.signal).catch((error: unknown) => {
      if (!controller.signal.aborted) setState((current) => ({ ...current, error }));
    });
    return () => controller.abort();
  }, [conversationId, fetchLatest]);

  /** For catching up. What's on screen stays if this fails, and the next try corrects it. */
  const refetch = useCallback(() => {
    fetchLatest().catch(() => {});
  }, [fetchLatest]);

  const retry = useCallback(() => {
    setState(INITIAL);
    fetchLatest().catch((error: unknown) => setState((current) => ({ ...current, error })));
  }, [fetchLatest]);

  const apply = useCallback((message: Message) => {
    if (message.conversationId !== currentId.current) return;
    setState((current) =>
      current.isLoaded
        ? { ...current, messages: refreshQuotes(mergeMessages(current.messages, [message]), message) }
        : current,
    );
  }, []);

  /**
   * Loads older pages until a message is on screen, for jumping to the original of a quote.
   * Resolves false if the conversation runs out first.
   */
  const loadUntil = useCallback(
    async (messageId: string): Promise<boolean> => {
      if (!conversationId) return false;
      let { messages, hasMore } = latest.current;
      for (let page = 0; page < 40; page += 1) {
        if (messages.some(({ id }) => id === messageId)) return true;
        if (!hasMore || messages.length === 0) return false;
        setState((current) => ({ ...current, isLoadingOlder: true }));
        const older = await listMessages(conversationId, messages[0].id);
        if (currentId.current !== conversationId) return false;
        messages = mergeMessages(messages, older.messages);
        hasMore = older.hasMore;
        const merged = messages;
        setState((current) => ({
          ...current,
          messages: mergeMessages(current.messages, merged),
          hasMore: older.hasMore,
          isLoadingOlder: false,
        }));
      }
      return false;
    },
    [conversationId],
  );

  const oldestId = state.messages[0]?.id;
  const canLoadOlder = state.hasMore && !state.isLoadingOlder;

  const loadOlder = useCallback(async () => {
    if (!conversationId || !oldestId || !canLoadOlder) return;
    setState((current) => ({ ...current, isLoadingOlder: true, olderFailed: false }));
    try {
      const { messages, hasMore } = await listMessages(conversationId, oldestId);
      if (currentId.current !== conversationId) return;
      setState((current) => ({
        ...current,
        messages: mergeMessages(current.messages, messages),
        hasMore,
        isLoadingOlder: false,
      }));
    } catch {
      if (currentId.current !== conversationId) return;
      setState((current) => ({ ...current, isLoadingOlder: false, olderFailed: true }));
    }
  }, [conversationId, oldestId, canLoadOlder]);

  return { ...state, apply, refetch, retry, loadOlder, loadUntil };
}

export type Thread = ReturnType<typeof useThread>;
