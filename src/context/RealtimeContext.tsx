import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { getMe } from '../api/auth';
import { API_ORIGIN, getToken } from '../api/client';
import { getTaskSummary } from '../api/tasks';
import { Conversation, Message, ReplyQuote } from '../api/types';
import { Draft } from '../lib/messages';

const POLL_MS = 15_000;
const RETRY_MS = 5_000;
const MAX_RETRIES = 5;

export type RealtimeEvent =
  /** Connected, or reconnected. Nothing sent while away is replayed, so listeners refetch. */
  | { type: 'ready' }
  /** Every 15 seconds while the socket is down. Listeners refetch what's on screen. */
  | { type: 'poll' }
  | { type: 'message:new' | 'message:updated' | 'message:deleted'; message: Message }
  | {
      type: 'conversation:updated';
      conversation: Pick<Conversation, 'id' | 'kind' | 'name' | 'description' | 'isArchived'>;
    }
  | { type: 'conversation:read'; conversationId: string; lastReadAt: string };

type Listener = (event: RealtimeEvent) => void;

export interface PendingMessage {
  clientId: string;
  conversationId: string;
  body: string;
  /** What it replies to, sent as replyToId and shown while it's on its way. */
  replyTo: ReplyQuote | null;
  /** Set when sending failed: what went wrong, in words for the person. */
  error: string | null;
}

interface Unread {
  messages: number;
  mentions: number;
}

interface RealtimeApi {
  isReconnecting: boolean;
  /** Null until the first count arrives. */
  unread: Unread | null;
  /** What a badge shows. A mention in a muted conversation still counts. */
  unreadBadge: number;
  subscribe: (listener: Listener) => () => void;
  /**
   * Unsent text lives here rather than on the page, so leaving Messages doesn't lose it, and
   * signing out does.
   */
  pending: PendingMessage[];
  setPending: React.Dispatch<React.SetStateAction<PendingMessage[]>>;
  drafts: React.MutableRefObject<Map<string, Draft>>;
}

const RealtimeContext = createContext<RealtimeApi | undefined>(undefined);

/** Mounted behind the login, so the socket opens after sign-in and closes on sign-out. */
export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [unread, setUnread] = useState<Unread | null>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const drafts = useRef(new Map<string, Draft>());
  const listeners = useRef(new Set<Listener>());

  const loadUnread = useCallback(() => {
    getTaskSummary().then(
      ({ unreadMessages = 0, unreadMentions = 0 }) =>
        setUnread({ messages: unreadMessages, mentions: unreadMentions }),
      () => {
        // The badge keeps its last count. The next event or poll corrects it.
      },
    );
  }, []);

  useEffect(() => {
    const emit = (event: RealtimeEvent) => listeners.current.forEach((listener) => listener(event));

    let isClosed = false;
    let retries = 0;
    let retryTimer: number | undefined;

    // Read on every attempt, so a password change's new token is the one that's sent.
    const socket = io(API_ORIGIN, { auth: (send) => send({ token: getToken() }) });

    /**
     * The server closed the door, which socket.io won't retry by itself. A dead session signs out
     * through the 401 from /me. Otherwise it's safe to try again, a few times, while polling
     * covers the gap.
     */
    const checkSession = () => {
      getMe().then(
        () => {
          if (isClosed || retries >= MAX_RETRIES) return;
          retries += 1;
          retryTimer = window.setTimeout(() => socket.connect(), RETRY_MS * retries);
        },
        () => {
          // A 401 has already signed out. Anything else leaves polling to carry on.
        },
      );
    };

    const handleDown = () => {
      setIsReconnecting(true);
      if (!socket.active) checkSession();
    };

    socket.on('ready', () => {
      retries = 0;
      setIsReconnecting(false);
      loadUnread();
      emit({ type: 'ready' });
    });
    socket.on('disconnect', handleDown);
    socket.on('connect_error', handleDown);

    for (const type of ['message:new', 'message:updated', 'message:deleted'] as const) {
      socket.on(type, ({ message }: { message: Message }) => emit({ type, message }));
    }
    socket.on('conversation:updated', ({ conversation }) =>
      emit({ type: 'conversation:updated', conversation }),
    );
    socket.on('conversation:read', ({ conversationId, lastReadAt }) =>
      emit({ type: 'conversation:read', conversationId, lastReadAt }),
    );
    socket.on('unread:changed', ({ unreadMessages, unreadMentions }) =>
      setUnread({ messages: unreadMessages, mentions: unreadMentions }),
    );

    loadUnread();

    return () => {
      isClosed = true;
      window.clearTimeout(retryTimer);
      socket.off();
      socket.disconnect();
    };
  }, [loadUnread]);

  useEffect(() => {
    if (!isReconnecting) return;
    const timer = window.setInterval(() => {
      loadUnread();
      listeners.current.forEach((listener) => listener({ type: 'poll' }));
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isReconnecting, loadUnread]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({
      isReconnecting,
      unread,
      unreadBadge: unread ? Math.max(unread.messages, unread.mentions) : 0,
      subscribe,
      pending,
      setPending,
      drafts,
    }),
    [isReconnecting, unread, subscribe, pending],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used within a RealtimeProvider');
  return context;
};
