import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Conversation } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { conversationName, isDeactivated } from '../../lib/messages';
import { Link } from '../../lib/router';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/Button';
import { CountBadge } from '../ui/CountBadge';
import { Icon, IconName } from '../ui/Icon';
import { Input } from '../ui/Input';

function channelIcon({ isAnnouncement, visibility }: Conversation): IconName {
  if (isAnnouncement) return 'campaign';
  return visibility === 'PRIVATE' ? 'lock' : 'tag';
}

export const ConversationIcon: React.FC<{ conversation: Conversation }> = ({ conversation }) =>
  conversation.kind === 'DM' ? (
    <Avatar
      name={conversationName(conversation)}
      id={conversation.otherUser?.id}
      avatar={conversation.otherUser?.avatar}
      size="sm"
    />
  ) : (
    <Icon name={channelIcon(conversation)} size="sm" className="text-text-2" />
  );

const Row: React.FC<{ conversation: Conversation; isOpen: boolean }> = ({
  conversation,
  isOpen,
}) => {
  const { user } = useSession();
  const { id, unreadCount, mentionCount, lastMessage, isMuted } = conversation;
  const name = conversationName(conversation);
  const isUnread = unreadCount > 0;

  const author = lastMessage?.authorName === user.fullName ? 'You' : lastMessage?.authorName.split(' ')[0];

  return (
    <li>
      <Link
        to={`/messages/${id}`}
        aria-current={isOpen ? 'page' : undefined}
        className={`flex items-center gap-2.5 min-h-[56px] md:min-h-[36px] px-3 md:px-2.5 py-1.5 md:rounded-md border-b border-border md:border-0 hover:no-underline ${
          isOpen ? 'bg-brand-50 text-brand font-semibold' : 'text-text hover:bg-surface-2'
        }`}
      >
        <ConversationIcon conversation={conversation} />
        <span className="grow min-w-0">
          <span
            className={`block truncate ${isUnread ? 'font-bold' : ''} ${
              isDeactivated(conversation) ? 'text-text-3' : ''
            }`}
          >
            {name}
          </span>
          {lastMessage && (
            <span className="block md:hidden text-small font-normal text-text-2 truncate">
              {author}: {lastMessage.bodyPreview}
            </span>
          )}
        </span>
        {isMuted && (
          <span title="Muted" className="text-text-3 inline-flex">
            <Icon name="do_not_disturb_on" size="sm" />
            <span className="sr-only">Muted</span>
          </span>
        )}
        {mentionCount > 0 && <CountBadge count={mentionCount} label="mentions" isMention />}
        {isUnread && <CountBadge count={unreadCount} label="unread" />}
      </Link>
    </li>
  );
};

const Section: React.FC<{
  title: string;
  conversations: Conversation[];
  openId: string | null;
}> = ({ title, conversations, openId }) => (
  <section aria-label={title} className="mb-4">
    <h2 className="t-over text-text-2 px-3 mb-1">{title}</h2>
    <ul>
      {conversations.map((conversation) => (
        <Row
          key={conversation.id}
          conversation={conversation}
          isOpen={conversation.id === openId}
        />
      ))}
    </ul>
  </section>
);

interface ComposeMenuProps {
  onNewDm: () => void;
  onBrowse: () => void;
  /** Left out for roles that can't create channels. */
  onNewChannel?: () => void;
}

const ComposeMenu: React.FC<ComposeMenuProps> = ({ onNewDm, onBrowse, onNewChannel }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const item = (icon: IconName, label: string, onSelect: () => void) => (
    <button
      type="button"
      className="menu-item"
      onClick={() => {
        setIsOpen(false);
        onSelect();
      }}
    >
      <Icon name={icon} />
      {label}
    </button>
  );

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        icon="edit_square"
        label="New conversation"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen && (
        <div className="popover absolute right-0 mt-1 w-56 p-1.5 z-40">
          {item('person', 'New direct message', onNewDm)}
          {onNewChannel && item('add', 'New channel', onNewChannel)}
          {item('tag', 'Browse channels', onBrowse)}
        </div>
      )}
    </div>
  );
};

interface ConversationListProps extends ComposeMenuProps {
  conversations: Conversation[];
  openId: string | null;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  openId,
  ...menu
}) => {
  const [search, setSearch] = useState('');

  const matches = useMemo(() => {
    const text = search.trim().toLowerCase();
    return text
      ? conversations.filter((item) => conversationName(item).toLowerCase().includes(text))
      : conversations;
  }, [conversations, search]);

  const channels = matches.filter(({ kind }) => kind === 'CHANNEL');
  const directMessages = matches.filter(({ kind }) => kind === 'DM');

  return (
    <>
      <div className="flex items-center justify-between px-4 md:px-3 pt-4 pb-3">
        <h1 className="t-h2">Messages</h1>
        <ComposeMenu {...menu} />
      </div>

      <div className="px-4 md:px-3 pb-3">
        <Input
          label="Find a channel or person"
          hideLabel
          type="search"
          icon="search"
          placeholder="Find a channel or person"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      {matches.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-text-2 mb-2">Nothing matches that name.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setSearch('')}>
            Clear search
          </button>
        </div>
      ) : (
        <div className="md:px-1 pb-4">
          {channels.length > 0 && (
            <Section title="Channels" conversations={channels} openId={openId} />
          )}
          {directMessages.length > 0 && (
            <Section title="Direct messages" conversations={directMessages} openId={openId} />
          )}
        </div>
      )}
    </>
  );
};
