import React, { useRef, useState } from 'react';
import { Message, ReplyQuote as Quote } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { BodyPart, bodyParts, toBody, toDraft } from '../../lib/messages';
import { Link } from '../../lib/router';
import { formatTime } from '../../lib/wat';
import { AssigneeStack } from '../tasks/AssigneeStack';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../ui/badges';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Textarea } from '../ui/Textarea';

/** Bodies are plain text: React escapes every part, and nothing here renders HTML. */
export const MessageText: React.FC<{ parts: BodyPart[]; children?: React.ReactNode }> = ({
  parts,
  children,
}) => {
  const { user } = useSession();
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.kind === 'text') return <React.Fragment key={index}>{part.text}</React.Fragment>;
        if (part.kind === 'task') {
          return (
            <Link key={index} to={`/tasks/${part.task.id}`} className="font-semibold">
              {part.task.title}
            </Link>
          );
        }
        return (
          <span key={index} className={`mention ${part.id === user.id ? 'is-me' : ''}`}>
            @{part.name}
          </span>
        );
      })}
      {children}
    </p>
  );
};

const TaskCard: React.FC<{ task: Message['linkedTasks'][number] }> = ({ task }) => (
  <Link
    to={`/tasks/${task.id}`}
    className="flex items-center gap-3 mt-2 p-3 max-w-md rounded-lg border border-border bg-surface text-text hover:no-underline hover:bg-surface-2"
  >
    <Icon name="task_alt" className="text-brand" />
    <span className="grow min-w-0">
      <span className="block font-semibold truncate">{task.title}</span>
      <span className="block mt-1">
        <StatusBadge status={task.status} />
      </span>
    </span>
    {task.assignees.length > 0 && <AssigneeStack people={task.assignees} size="xs" />}
  </Link>
);

const EditForm: React.FC<{
  message: Message;
  onSave: (body: string) => Promise<void>;
  onCancel: () => void;
}> = ({ message, onSave, onCancel }) => {
  const [draft] = useState(() => toDraft(message.body ?? ''));
  const [text, setText] = useState(draft.text);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(toBody({ text: trimmed, mentions: draft.mentions }));
    } catch {
      // The toast has said why. The text stays so it can be tried again.
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-1">
      <Textarea
        label="Edit message"
        hideLabel
        value={text}
        rows={2}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={save} isLoading={isSaving} disabled={!text.trim()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

const ATTACHMENT_LABEL = { IMAGE: 'Photo', VOICE: 'Voice note' } as const;
const ATTACHMENT_ICON = { IMAGE: 'image', VOICE: 'mic' } as const;

/** The compact quote above a reply. With `onOpen`, clicking it jumps to the original. */
export const ReplyQuote: React.FC<{ quote: Quote; onOpen?: () => void }> = ({ quote, onOpen }) => {
  const { user } = useSession();
  const isGone = quote.deletedAt !== null;
  const isToMe = quote.author.id === user.id;

  let text: React.ReactNode = quote.bodyPreview;
  if (isGone) {
    text = <span className="italic">Original message deleted</span>;
  } else if (!quote.bodyPreview && quote.attachmentKind) {
    text = (
      <span className="inline-flex items-center gap-1">
        <Icon name={ATTACHMENT_ICON[quote.attachmentKind]} size="sm" />
        {ATTACHMENT_LABEL[quote.attachmentKind]}
      </span>
    );
  }

  const content = (
    <>
      <span className={`block font-semibold truncate ${isToMe ? 'text-brand' : ''}`}>
        {quote.author.name}
      </span>
      <span className="block truncate text-text-2">{text}</span>
    </>
  );
  const className = `reply-quote ${isToMe ? 'is-mine' : ''}`;

  return onOpen && !isGone ? (
    <button
      type="button"
      onClick={onOpen}
      className={`${className} text-left`}
      aria-label={`Replying to ${quote.author.name}: ${quote.bodyPreview ?? ''}. Go to the original message`}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
};

const SWIPE_TO_REPLY = 56;
const LONG_PRESS_MS = 450;

interface MessageItemProps {
  message: Message;
  /** Follows the same person's last message, so the name and time aren't repeated. */
  isContinued: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => void;
  /** Left out where replying isn't possible, like a channel you haven't joined. */
  onReply?: () => void;
  onOpenQuote: (messageId: string) => void;
  isHighlighted: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isContinued,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onReply,
  onOpenQuote,
  isHighlighted,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [swipe, setSwipe] = useState(0);
  const rowRef = useRef<HTMLLIElement>(null);
  const touch = useRef<{ x: number; y: number; timer: number; isSwiping: boolean } | null>(null);
  const { author, body, mentions, linkedTasks, editedAt, createdAt } = message;
  const isGone = author.status === 'DEACTIVATED';
  const isDeleted = body === null;
  const parts = isDeleted ? [] : bodyParts(body, mentions, linkedTasks);
  const edited = editedAt && !isDeleted && (
    <span className="text-caption text-text-3"> (edited)</span>
  );

  const canReply = Boolean(onReply) && !isDeleted;

  // Phones: swipe right to reply, or hold to bring up the actions, as a tap also does.
  const handleTouchStart = (e: React.TouchEvent) => {
    const { clientX, clientY } = e.touches[0];
    const timer = window.setTimeout(() => rowRef.current?.focus(), LONG_PRESS_MS);
    touch.current = { x: clientX, y: clientY, timer, isSwiping: false };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touch.current;
    if (!start) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) window.clearTimeout(start.timer);
    if (!canReply) return;
    if (!start.isSwiping && dx > 12 && Math.abs(dx) > Math.abs(dy) * 2) start.isSwiping = true;
    if (start.isSwiping) setSwipe(Math.max(0, Math.min(dx, SWIPE_TO_REPLY + 16)));
  };
  const handleTouchEnd = () => {
    const start = touch.current;
    if (start) window.clearTimeout(start.timer);
    if (start?.isSwiping && swipe >= SWIPE_TO_REPLY) onReply?.();
    touch.current = null;
    setSwipe(0);
  };

  return (
    <li
      ref={rowRef}
      id={`message-${message.id}`}
      // A tap focuses the row, which is how touch screens reach the actions.
      tabIndex={-1}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`message-row group relative flex gap-3 px-4 md:px-6 hover:bg-surface-2 ${
        isContinued ? 'py-0.5' : 'pt-2 pb-0.5'
      } ${isHighlighted ? 'is-highlighted' : ''}`}
      style={swipe ? { transform: `translateX(${swipe}px)` } : undefined}
    >
      {swipe > 0 && (
        <span
          aria-hidden="true"
          className={`absolute left-1 top-1/2 -translate-y-1/2 -translate-x-full ${
            swipe >= SWIPE_TO_REPLY ? 'text-brand' : 'text-text-3'
          }`}
        >
          <Icon name="reply" />
        </span>
      )}
      <div className="w-8 shrink-0">
        {!isContinued && <Avatar name={author.name} id={author.id} avatar={author.avatar} />}
      </div>

      <div className="grow min-w-0">
        {!isContinued && (
          <p className="flex items-baseline gap-2">
            <span className={`font-semibold truncate ${isGone ? 'text-text-3' : ''}`}>
              {author.name}
            </span>
            <time dateTime={createdAt} className="text-caption text-text-2 whitespace-nowrap">
              {formatTime(new Date(createdAt))}
            </time>
          </p>
        )}

        {message.replyTo && !isDeleted && (
          <ReplyQuote quote={message.replyTo} onOpen={() => onOpenQuote(message.replyTo!.id)} />
        )}
        {isDeleted ? (
          <p className="italic text-text-3">Message deleted</p>
        ) : isEditing ? (
          <EditForm
            message={message}
            onCancel={() => setIsEditing(false)}
            onSave={async (next) => {
              await onEdit(next);
              setIsEditing(false);
            }}
          />
        ) : (
          <>
            {parts.length > 0 ? <MessageText parts={parts}>{edited}</MessageText> : edited}
            {linkedTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </>
        )}
      </div>

      {!isDeleted && !isEditing && (canEdit || canDelete || canReply) && (
        <div className="absolute right-4 md:right-6 -top-2 flex gap-0.5 rounded-md border border-border bg-surface shadow-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 group-focus:opacity-100 [@media(hover:none)]:invisible [@media(hover:none)]:group-focus-within:visible">
          {canReply && (
            <IconButton icon="reply" size="sm" label="Reply" onClick={onReply} />
          )}
          {canEdit && (
            <IconButton
              icon="edit"
              size="sm"
              label="Edit message"
              onClick={() => setIsEditing(true)}
            />
          )}
          {canDelete && (
            <IconButton icon="cancel" size="sm" label="Delete message" onClick={onDelete} />
          )}
        </div>
      )}
    </li>
  );
};
