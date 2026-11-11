import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api/client';
import {
  browseChannels,
  deleteMessage,
  editMessage,
  joinChannel,
  leaveChannel,
  markRead,
  sendMessage,
  setMuted,
  updateChannel,
} from '../api/messages';
import { Conversation, Message } from '../api/types';
import { ErrorState, NoAccess } from '../components/ui/AsyncState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';
import {
  AddMembersModal,
  BrowseChannelsModal,
  ChannelFormModal,
  NewDmModal,
} from '../components/messages/ChannelDialogs';
import { ConversationDetails } from '../components/messages/ConversationDetails';
import { ConversationList } from '../components/messages/ConversationList';
import { ThreadPane } from '../components/messages/ThreadPane';
import { useSession } from '../context/AuthContext';
import { PendingMessage, RealtimeEvent, useRealtime } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { conversationTitle, EMPTY_DRAFT } from '../lib/messages';
import { useDetailTitle } from '../lib/pageTitle';
import { navigate } from '../lib/router';
import { useApiQuery } from '../lib/useApiQuery';
import { useConversations } from '../lib/useConversations';
import { useThread } from '../lib/useThread';

type Dialog = 'dm' | 'channel' | 'browse' | 'edit' | 'addPeople' | 'details' | null;
type Confirming = { kind: 'delete'; message: Message } | { kind: 'leave' } | { kind: 'archive' };

export const MessagesView: React.FC<{ conversationId?: string }> = ({ conversationId = null }) => {
  const { can } = useSession();
  const toast = useToast();
  const { isReconnecting, subscribe, pending, setPending, drafts } = useRealtime();
  const { query: conversations, patch, add } = useConversations();

  const mine = conversations.data?.find(({ id }) => id === conversationId);

  // Not one of yours: a public channel can still be read before joining, from a browse link.
  const needsBrowse = conversationId !== null && conversations.data !== undefined && !mine;
  const browse = useApiQuery(
    async (signal) => ({
      conversationId,
      channels: needsBrowse ? await browseChannels(signal) : [],
    }),
    [needsBrowse, conversationId],
  );
  // Tagged with the conversation it was fetched for, so the answer for the last one can't be
  // mistaken for "not found" here.
  const browsed = needsBrowse && browse.data?.conversationId === conversationId ? browse.data : null;
  const preview = browsed?.channels.find(({ id }) => id === conversationId);
  const open = mine ?? preview;
  useDetailTitle(open ? conversationTitle(open) : null);

  const thread = useThread(open ? conversationId : null);

  const [dialog, setDialog] = useState<Dialog>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const lastRead = useRef(new Map<string, string>());

  useEffect(() => setDialog(null), [conversationId]);

  const handlers = useRef<(event: RealtimeEvent) => void>(() => {});
  handlers.current = (event) => {
    switch (event.type) {
      case 'ready':
      case 'poll':
        conversations.reload();
        thread.refetch();
        break;
      case 'message:new':
      case 'message:updated':
      case 'message:deleted':
        thread.apply(event.message);
        conversations.reload();
        break;
      case 'conversation:updated':
        conversations.reload();
        if (event.conversation.isArchived && event.conversation.id === conversationId) {
          toast.success(`#${event.conversation.name} was archived.`);
          navigate('/messages', { replace: true });
        }
        break;
      case 'conversation:read':
        conversations.reload();
        break;
    }
  };

  useEffect(() => subscribe((event) => handlers.current(event)), [subscribe]);

  // Task status has no event of its own, so coming back to the tab brings the cards up to date.
  const { refetch } = thread;
  useEffect(() => {
    window.addEventListener('focus', refetch);
    return () => window.removeEventListener('focus', refetch);
  }, [refetch]);

  const deliver = useCallback(
    async (item: PendingMessage) => {
      setPending((list) =>
        list.map((other) =>
          other.clientId === item.clientId ? { ...other, error: null } : other,
        ),
      );
      try {
        thread.apply(await sendMessage(item.conversationId, item.body, item.clientId));
        setPending((list) => list.filter(({ clientId }) => clientId !== item.clientId));
      } catch (error) {
        setPending((list) =>
          list.map((other) =>
            other.clientId === item.clientId ? { ...other, error: errorMessage(error) } : other,
          ),
        );
      }
    },
    [thread.apply, setPending],
  );

  const send = (body: string) => {
    if (!conversationId) return;
    const item = { clientId: crypto.randomUUID(), conversationId, body, error: null };
    setPending((list) => [...list, item]);
    deliver(item);
  };

  const discard = ({ clientId }: PendingMessage) =>
    setPending((list) => list.filter((item) => item.clientId !== clientId));

  const read = useCallback(
    (messageId: string) => {
      if (!conversationId || lastRead.current.get(conversationId) === messageId) return;
      lastRead.current.set(conversationId, messageId);
      const before = conversations.data?.find(({ id }) => id === conversationId);
      patch(conversationId, { unreadCount: 0, mentionCount: 0 });
      markRead(conversationId, messageId).then(
        () => conversations.reload(),
        () => {
          lastRead.current.delete(conversationId);
          if (before) {
            patch(conversationId, {
              unreadCount: before.unreadCount,
              mentionCount: before.mentionCount,
            });
          }
        },
      );
    },
    [conversationId, patch, conversations.reload, conversations.data],
  );

  const edit = async (message: Message, body: string) => {
    try {
      thread.apply(await editMessage(message.id, body));
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  };

  // A message that arrives over the socket or a refetch while its POST looked failed is the same
  // message, so the local copy gives way to it.
  const visiblePending = useMemo(
    () =>
      pending.filter(
        ({ clientId, conversationId: id }) =>
          id === conversationId && !thread.messages.some((message) => message.clientId === clientId),
      ),
    [pending, conversationId, thread.messages],
  );

  const opened = (conversation: Conversation) => {
    add(conversation);
    setDialog(null);
    navigate(`/messages/${conversation.id}`);
    conversations.reload();
  };

  const join = async () => {
    if (!conversationId) return;
    try {
      add(await joinChannel(conversationId));
      conversations.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const toggleMute = async (isMuted: boolean) => {
    if (!conversationId) return;
    try {
      add(await setMuted(conversationId, isMuted));
      conversations.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const confirm = async () => {
    if (!confirming || !conversationId) return;
    setIsConfirming(true);
    try {
      if (confirming.kind === 'delete') {
        thread.apply(await deleteMessage(confirming.message.id));
      } else {
        if (confirming.kind === 'leave') await leaveChannel(conversationId);
        else await updateChannel(conversationId, { isArchived: true });
        navigate('/messages', { replace: true });
        conversations.reload();
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsConfirming(false);
      setConfirming(null);
    }
  };

  const CONFIRM_COPY = {
    delete: {
      title: 'Delete this message?',
      description: 'Everyone in the conversation will see "Message deleted" instead.',
      label: 'Delete',
    },
    leave: {
      title: `Leave ${open ? conversationTitle(open) : 'this channel'}?`,
      description: 'It leaves your list. Its messages stay for everyone else.',
      label: 'Leave',
    },
    archive: {
      title: `Archive ${open ? conversationTitle(open) : 'this channel'}?`,
      description: 'It disappears for everyone and nobody can post in it.',
      label: 'Archive',
    },
  };
  const copy = CONFIRM_COPY[confirming?.kind ?? 'delete'];

  const renderThread = () => {
    if (!conversationId) {
      return (
        <div className="grow hidden md:flex items-center justify-center p-6">
          <EmptyState
            icon="forum"
            title="Pick a conversation"
            description="Choose a channel or person on the left."
          />
        </div>
      );
    }
    if (conversations.error) return null;
    if (open) {
      return (
        <ThreadPane
          conversation={open}
          isMember={Boolean(mine)}
          isReconnecting={isReconnecting}
          thread={thread}
          pending={visiblePending}
          draft={drafts.current.get(conversationId) ?? EMPTY_DRAFT}
          onDraftChange={(draft) => drafts.current.set(conversationId, draft)}
          onSend={send}
          onRead={read}
          onEdit={edit}
          onDelete={(message) => setConfirming({ kind: 'delete', message })}
          onResend={deliver}
          onDiscard={discard}
          onJoin={join}
          onOpenDetails={() => setDialog('details')}
        />
      );
    }
    if (browsed && !browse.error) {
      return (
        <div className="grow flex items-center justify-center p-6">
          <NoAccess
            title="This channel is private"
            description="Ask someone in the channel to add you."
            backTo="/messages"
            backLabel="Back to messages"
          />
        </div>
      );
    }
    if (browse.error) {
      return (
        <div className="grow p-4">
          <ErrorState
            title="Couldn't load this conversation"
            message={errorMessage(browse.error)}
            onRetry={browse.reload}
          />
        </div>
      );
    }
    return (
      <div className="grow p-4">
        <SkeletonList label="Loading messages…" />
      </div>
    );
  };

  const hasThread = conversationId !== null;

  return (
    <div className="messages-page">
      <div
        className={`messages-list w-full md:w-[272px] xl:w-[320px] shrink-0 md:border-r border-border bg-surface md:bg-surface-2 pb-24 md:pb-0 ${
          hasThread ? 'max-md:hidden' : ''
        }`}
      >
        {conversations.error ? (
          <div className="p-4">
            <ErrorState
              title="Couldn't load your messages"
              message={errorMessage(conversations.error)}
              onRetry={conversations.reload}
            />
          </div>
        ) : conversations.data ? (
          <ConversationList
            conversations={conversations.data}
            openId={conversationId}
            onNewDm={() => setDialog('dm')}
            onBrowse={() => setDialog('browse')}
            onNewChannel={can('createChannel') ? () => setDialog('channel') : undefined}
          />
        ) : (
          <div className="p-3">
            <SkeletonList label="Loading your conversations…" rows={6} />
          </div>
        )}
      </div>

      <section
        aria-label="Conversation"
        className={`messages-thread grow ${hasThread ? 'is-open' : 'max-md:hidden'}`}
      >
        {renderThread()}
      </section>

      {dialog === 'dm' && <NewDmModal onClose={() => setDialog(null)} onOpened={opened} />}
      {dialog === 'channel' && (
        <ChannelFormModal onClose={() => setDialog(null)} onSaved={opened} />
      )}
      {dialog === 'browse' && (
        <BrowseChannelsModal
          onClose={() => setDialog(null)}
          onOpen={({ id }) => {
            setDialog(null);
            navigate(`/messages/${id}`);
          }}
        />
      )}
      {dialog === 'edit' && open && (
        <ChannelFormModal
          channel={open}
          onClose={() => setDialog(null)}
          onSaved={(conversation) => {
            add(conversation);
            setDialog(null);
            conversations.reload();
          }}
        />
      )}
      {dialog === 'addPeople' && open && (
        <AddMembersModal
          channel={open}
          onClose={() => setDialog(null)}
          onAdded={(_, count) => {
            setDialog(null);
            toast.success(count === 1 ? 'Added 1 person.' : `Added ${count} people.`);
          }}
        />
      )}
      {dialog === 'details' && open && (
        <ConversationDetails
          conversation={open}
          onClose={() => setDialog(null)}
          onToggleMute={toggleMute}
          onAddPeople={() => setDialog('addPeople')}
          onEdit={() => setDialog('edit')}
          onLeave={() => setConfirming({ kind: 'leave' })}
          onArchive={() => setConfirming({ kind: 'archive' })}
        />
      )}

      <ConfirmDialog
        isOpen={confirming !== null}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.label}
        confirmVariant="danger"
        isLoading={isConfirming}
        onConfirm={confirm}
        onClose={() => setConfirming(null)}
      />
    </div>
  );
};
