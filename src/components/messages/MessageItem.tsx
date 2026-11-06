import React, { useState } from 'react';
import { Message } from '../../api/types';
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

interface MessageItemProps {
  message: Message;
  /** Follows the same person's last message, so the name and time aren't repeated. */
  isContinued: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isContinued,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const { author, body, mentions, linkedTasks, editedAt, createdAt } = message;
  const isGone = author.status === 'DEACTIVATED';
  const isDeleted = body === null;
  const parts = isDeleted ? [] : bodyParts(body, mentions, linkedTasks);
  const edited = editedAt && !isDeleted && (
    <span className="text-caption text-text-3"> (edited)</span>
  );

  return (
    <li
      // A tap focuses the row, which is how touch screens reach the actions.
      tabIndex={-1}
      className={`message-row group relative flex gap-3 px-4 md:px-6 hover:bg-surface-2 ${
        isContinued ? 'py-0.5' : 'pt-2 pb-0.5'
      }`}
    >
      <div className="w-8 shrink-0">
        {!isContinued && <Avatar name={author.name} id={author.id} />}
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

      {!isDeleted && !isEditing && (canEdit || canDelete) && (
        <div className="absolute right-4 md:right-6 -top-2 flex gap-0.5 rounded-md border border-border bg-surface shadow-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 group-focus:opacity-100 [@media(hover:none)]:invisible [@media(hover:none)]:group-focus-within:visible">
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
