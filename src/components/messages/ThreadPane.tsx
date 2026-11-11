import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../api/client';
import { Attachment, Conversation, Message, ReplyQuote } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PendingMessage } from '../../context/RealtimeContext';
import {
  bodyParts,
  continuesFrom,
  conversationName,
  conversationTitle,
  Draft,
  isDeactivated,
  messageDay,
} from '../../lib/messages';
import { Link } from '../../lib/router';
import { Thread } from '../../lib/useThread';
import { addDays, formatDayHeading, watDate } from '../../lib/wat';
import { ErrorState } from '../ui/AsyncState';
import { Avatar } from '../ui/Avatar';
import { Button, IconButton } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';
import { Spinner } from '../ui/Spinner';
import { Composer } from './Composer';
import { ConversationIcon } from './ConversationList';
import { useImageUploads } from '../../lib/useImageUploads';
import { Recording } from '../../lib/useVoiceRecorder';
import { PhotoGrid } from './media/PhotoGrid';
import { MessageItem, MessageText, ReplyQuote as QuoteView } from './MessageItem';

const NEAR_EDGE_PX = 120;
const AT_BOTTOM_PX = 40;

function dayLabel(day: string, createdAt: string): string {
  const today = new Date();
  if (day === watDate(today)) return 'Today';
  if (day === watDate(addDays(today, -1))) return 'Yesterday';
  return formatDayHeading(new Date(createdAt));
}

const DayDivider: React.FC<{ label: string }> = ({ label }) => (
  <li className="day-divider px-4 md:px-6 py-3" role="separator">
    {label}
  </li>
);

const PendingItem: React.FC<{
  item: PendingMessage;
  onResend: () => void;
  onDiscard: () => void;
}> = ({ item, onResend, onDiscard }) => {
  const { user } = useSession();
  return (
    <li className={`flex gap-3 px-4 md:px-6 pt-2 pb-0.5 ${item.error ? '' : 'opacity-60'}`}>
      <div className="w-8 shrink-0">
        <Avatar name={user.fullName} id={user.id} avatar={user.avatar} />
      </div>
      <div className="grow min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="font-semibold truncate">{user.fullName}</span>
          {!item.error && !item.voice && <span className="text-caption text-text-2">Sending…</span>}
        </p>
        {item.replyTo && <QuoteView quote={item.replyTo} />}
        {item.attachments.length > 0 && (
          <PhotoGrid photos={item.attachments} author={user.fullName} onExpired={() => {}} />
        )}
        {item.voice && !item.error && (
          <p role="status" className="flex items-center gap-2 text-small text-text-2">
            <Spinner size="sm" />
            {item.voice.uploaded ? 'Sending voice note…' : 'Processing voice note…'}
          </p>
        )}
        {item.body && <MessageText parts={bodyParts(item.body, [], [])} />}
        {item.error && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span role="alert" className="flex items-center gap-1 text-small text-danger">
              <Icon name="sms_failed" size="sm" />
              {item.voice ? "Voice note didn't send." : "Message didn't send."} {item.error}
            </span>
            <Button size="sm" variant="secondary" icon="refresh" onClick={onResend}>
              Resend
            </Button>
            <Button size="sm" variant="ghost" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        )}
      </div>
    </li>
  );
};

const ThreadSkeleton: React.FC = () => {
  const [isDue, setIsDue] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setIsDue(true), 300);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-label="Loading messages…" className="grow px-4 md:px-6 py-4 space-y-5">
      {isDue &&
        [0, 1, 2, 3].map((row) => (
          <div key={row} className="flex gap-3" aria-hidden="true">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="grow space-y-2">
              <Skeleton className="w-1/4" />
              <Skeleton className="w-2/3" />
            </div>
          </div>
        ))}
    </div>
  );
};

interface MessageListProps {
  conversation: Conversation;
  thread: Thread;
  pending: PendingMessage[];
  isMember: boolean;
  onRead: (messageId: string) => void;
  onEdit: (message: Message, body: string) => Promise<void>;
  onDelete: (message: Message) => void;
  onResend: (item: PendingMessage) => void;
  onDiscard: (item: PendingMessage) => void;
  onReply: (message: Message) => void;
}

const HIGHLIGHT_MS = 1600;

const MessageList: React.FC<MessageListProps> = ({
  conversation,
  thread,
  pending,
  isMember,
  onRead,
  onEdit,
  onDelete,
  onResend,
  onDiscard,
  onReply,
}) => {
  const { user, can } = useSession();
  const toast = useToast();
  const canReply = isMember && conversation.canPost;
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  const { messages, loadOlder } = thread;
  const scroller = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);

  const latestId = messages[messages.length - 1]?.id;
  const lastPending = pending[pending.length - 1];
  // Failing adds a line under the message, and that has to come into view like a new message.
  const lastKey = lastPending ? `${lastPending.clientId}:${lastPending.error}` : latestId;
  const lastIsMine = pending.length > 0 || messages[messages.length - 1]?.author.id === user.id;
  const seen = useRef({ firstId: messages[0]?.id, lastKey: undefined as string | undefined, height: 0 });

  const toBottom = useCallback(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
    isAtBottom.current = true;
    setHasNewBelow(false);
  }, []);

  // Before paint, so the view never visibly jumps: older pages keep your place, and new messages
  // follow you only if you were already at the bottom, or sent them.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;

    const firstId = messages[0]?.id;
    const previous = seen.current;
    if (previous.lastKey === undefined) toBottom();
    else if (firstId !== previous.firstId && lastKey === previous.lastKey) {
      element.scrollTop += element.scrollHeight - previous.height;
    } else if (lastKey !== previous.lastKey) {
      if (isAtBottom.current || lastIsMine) toBottom();
      else setHasNewBelow(true);
    }
    seen.current = { firstId, lastKey, height: element.scrollHeight };
  }, [messages, lastKey, lastIsMine, toBottom]);

  // Runs once the original is on screen, which may be after older pages have loaded and the
  // layout effect above has kept the reader's place.
  useEffect(() => {
    if (!jumpTo || !messages.some(({ id }) => id === jumpTo)) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(`message-${jumpTo}`)
      ?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    setHighlightId(jumpTo);
    setJumpTo(null);
  }, [jumpTo, messages]);

  // Its own effect, so clearing the jump above can't cancel the fade.
  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  const lastRefresh = useRef(0);
  const refreshExpiredMedia = useCallback(() => {
    // A broken image or recording usually means its signed address ran out after an hour. One
    // refetch brings fresh ones. Spaced out, so a file that's truly gone can't cause a loop.
    if (Date.now() - lastRefresh.current < 30_000) return;
    lastRefresh.current = Date.now();
    thread.refetch();
  }, [thread]);

  const openQuote = useCallback(
    async (messageId: string) => {
      setJumpTo(messageId);
      if (messages.some(({ id }) => id === messageId)) return;
      const found = await thread.loadUntil(messageId).catch(() => false);
      if (!found) {
        setJumpTo(null);
        toast.error("Couldn't find the original message.");
      }
    },
    [messages, thread, toast],
  );

  // The composer grows with a quote bar or a long draft, which shrinks this list. Whoever was
  // reading the latest message keeps it in view rather than having it slide under the composer.
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (isAtBottom.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const readIfVisible = useCallback(() => {
    if (latestId && isMember && isAtBottom.current && document.visibilityState === 'visible') {
      onRead(latestId);
    }
  }, [latestId, isMember, onRead]);

  useEffect(readIfVisible, [readIfVisible]);

  useEffect(() => {
    document.addEventListener('visibilitychange', readIfVisible);
    return () => document.removeEventListener('visibilitychange', readIfVisible);
  }, [readIfVisible]);

  const handleScroll = () => {
    const element = scroller.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    isAtBottom.current = distance < AT_BOTTOM_PX;
    if (isAtBottom.current) {
      setHasNewBelow(false);
      readIfVisible();
    }
    if (element.scrollTop < NEAR_EDGE_PX) loadOlder();
  };

  const rows = useMemo(() => {
    let lastDay = '';
    return messages.map((message, index) => {
      const day = messageDay(message.createdAt);
      const divider = day === lastDay ? null : dayLabel(day, message.createdAt);
      lastDay = day;
      return { message, divider, isContinued: continuesFrom(messages[index - 1], message) };
    });
  }, [messages]);

  const today = watDate();
  const needsTodayDivider =
    pending.length > 0 && (messages.length === 0 || lastDayOf(messages) !== today);
  const isEmpty = messages.length === 0 && pending.length === 0;

  return (
    <div className="relative grow min-h-0 flex flex-col">
      <div
        ref={scroller}
        onScroll={handleScroll}
        // Scroll position is managed above, and the browser's own anchoring would add to it.
        style={{ overflowAnchor: 'none' }}
        className="grow min-h-0 overflow-y-auto py-2"
      >
        {thread.isLoadingOlder && (
          <p role="status" className="flex justify-center py-2">
            <Spinner size="sm" />
            <span className="sr-only">Loading older messages…</span>
          </p>
        )}
        {thread.olderFailed && (
          <p className="text-center py-2 text-small text-text-2">
            Couldn't load older messages.{' '}
            <button type="button" className="btn btn-ghost btn-sm" onClick={loadOlder}>
              Try again
            </button>
          </p>
        )}

        {isEmpty ? (
          <EmptyState
            icon="forum"
            title={`Say hello to ${conversationTitle(conversation)}`}
            description={
              conversation.kind === 'CHANNEL'
                ? 'This is the start of the channel. Messages stay here for everyone in it.'
                : 'This is the start of your conversation.'
            }
          />
        ) : (
          <ol aria-label={`Messages in ${conversationTitle(conversation)}`}>
            {rows.map(({ message, divider, isContinued }) => {
              const isMine = message.author.id === user.id;
              return (
                <React.Fragment key={message.id}>
                  {divider && <DayDivider label={divider} />}
                  <MessageItem
                    message={message}
                    isContinued={isContinued && !divider}
                    canEdit={isMine && isMember}
                    canDelete={isMine || can('deleteAnyMessage')}
                    onEdit={(body) => onEdit(message, body)}
                    onDelete={() => onDelete(message)}
                    onReply={canReply ? () => onReply(message) : undefined}
                    onOpenQuote={openQuote}
                    onMediaExpired={refreshExpiredMedia}
                    isHighlighted={highlightId === message.id}
                  />
                </React.Fragment>
              );
            })}
            {needsTodayDivider && <DayDivider label="Today" />}
            {pending.map((item) => (
              <PendingItem
                key={item.clientId}
                item={item}
                onResend={() => onResend(item)}
                onDiscard={() => onDiscard(item)}
              />
            ))}
          </ol>
        )}
      </div>

      {hasNewBelow && (
        <button
          type="button"
          onClick={toBottom}
          className="btn btn-secondary btn-sm absolute bottom-2 left-1/2 -translate-x-1/2 shadow-sm"
        >
          <Icon name="keyboard_arrow_down" size="sm" />
          New messages
        </button>
      )}
    </div>
  );
};

const lastDayOf = (messages: Message[]) => messageDay(messages[messages.length - 1].createdAt);

const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center justify-center gap-3 flex-wrap px-4 py-3 border-t border-border text-small text-text-2 pb-[max(12px,env(safe-area-inset-bottom))]">
    {children}
  </div>
);

function readOnlyNote(conversation: Conversation): string {
  if (conversation.isAnnouncement) {
    return 'Only Super Admin, Admin and Operations can post in announcements.';
  }
  if (isDeactivated(conversation)) {
    return `${conversationName(conversation)} is no longer active, so this conversation is read-only.`;
  }
  return "You can't post here.";
}

interface ThreadPaneProps extends Omit<MessageListProps, 'conversation' | 'isMember'> {
  onSendVoice: (recording: Recording) => void;
  replyTarget: ReplyQuote | null;
  onCancelReply: () => void;
  conversation: Conversation;
  isMember: boolean;
  isReconnecting: boolean;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
  onSend: (body: string, attachments: Attachment[]) => void;
  onJoin: () => Promise<void>;
  onOpenDetails: () => void;
}

export const ThreadPane: React.FC<ThreadPaneProps> = ({
  conversation,
  isMember,
  isReconnecting,
  draft,
  onDraftChange,
  onSend,
  onJoin,
  onOpenDetails,
  replyTarget,
  onCancelReply,
  onSendVoice,
  ...list
}) => {
  const { thread } = list;
  const [isJoining, setIsJoining] = useState(false);
  const uploads = useImageUploads(conversation.id);
  const [isDropping, setIsDropping] = useState(false);
  const canAttach = isMember && conversation.canPost;
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');
  const name = conversationName(conversation);
  const subtitle =
    conversation.kind === 'DM' ? conversation.otherUser?.position?.name : conversation.description;

  const join = async () => {
    setIsJoining(true);
    await onJoin().finally(() => setIsJoining(false));
  };

  return (
    <div
      className="contents"
      onDragEnter={(e) => canAttach && hasFiles(e) && setIsDropping(true)}
      onDragOver={(e) => {
        if (!canAttach || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setIsDropping(false);
      }}
      onDrop={(e) => {
        if (!canAttach || !hasFiles(e)) return;
        e.preventDefault();
        setIsDropping(false);
        uploads.add([...e.dataTransfer.files].filter((file) => file.type.startsWith('image/') || /\.hei[cf]$/i.test(file.name)));
      }}
    >
      {isDropping && (
        <div className="drop-overlay" aria-hidden="true">
          <Icon name="image" size="xl" />
          Drop photos to attach them
        </div>
      )}
      <header className="flex items-center gap-2 min-h-[60px] px-2 md:px-6 py-2 border-b border-border">
        <Link
          to="/messages"
          aria-label="Back to messages"
          className="btn btn-icon btn-ghost md:hidden"
        >
          <Icon name="arrow_back" />
        </Link>
        <ConversationIcon conversation={conversation} />
        <div className="grow min-w-0">
          <h2 className={`t-h3 truncate ${isDeactivated(conversation) ? 'text-text-3' : ''}`}>
            {name}
          </h2>
          {subtitle && <p className="text-small text-text-2 truncate">{subtitle}</p>}
        </div>
        {isMember && <IconButton icon="info" label="Conversation details" onClick={onOpenDetails} />}
      </header>

      {isReconnecting && (
        <p role="status" className="px-4 md:px-6 py-1 text-caption text-text-2 bg-surface-2">
          Reconnecting…
        </p>
      )}

      {thread.error ? (
        <div className="grow p-4">
          <ErrorState
            title="Couldn't load messages"
            message={errorMessage(thread.error)}
            onRetry={thread.retry}
          />
        </div>
      ) : !thread.isLoaded ? (
        <ThreadSkeleton />
      ) : (
        <MessageList
          key={conversation.id}
          conversation={conversation}
          isMember={isMember}
          {...list}
        />
      )}

      {!isMember ? (
        <Notice>
          <span>You're not in {conversationTitle(conversation)} yet.</span>
          <Button size="sm" onClick={join} isLoading={isJoining}>
            Join channel
          </Button>
        </Notice>
      ) : conversation.canPost ? (
        <Composer
          key={`composer-${conversation.id}`}
          conversation={conversation}
          initialDraft={draft}
          onDraftChange={onDraftChange}
          onSend={onSend}
          onSendVoice={onSendVoice}
          uploads={uploads}
          replyTo={replyTarget}
          onCancelReply={onCancelReply}
        />
      ) : (
        <Notice>{readOnlyNote(conversation)}</Notice>
      )}
    </div>
  );
};
