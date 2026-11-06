import React from 'react';
import { Checkin, CheckinReply } from '../../api/types';
import { Link } from '../../lib/router';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../ui/badges';
import { Icon } from '../ui/Icon';
import { AssigneeStack } from '../tasks/AssigneeStack';

export const Answer: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <p className="t-over text-text-2">{label}</p>
    <p className="whitespace-pre-wrap break-words">{children}</p>
  </div>
);

export const BlockerBox: React.FC<{ checkin: Checkin }> = ({ checkin }) => (
  <div className={`blocker-box ${checkin.blockerHandled ? 'is-handled' : ''}`}>
    <Icon name="flag" size="sm" className="mt-0.5 shrink-0" />
    <p className="min-w-0 whitespace-pre-wrap break-words">{checkin.blockers}</p>
  </div>
);

export const Replies: React.FC<{ replies: CheckinReply[]; youId?: string }> = ({
  replies,
  youId,
}) => (
  <>
    {replies.map((reply) => (
      <div key={reply.id} className="reply-box">
        <Avatar name={reply.author.name} id={reply.author.id} size="sm" />
        <p className="min-w-0 whitespace-pre-wrap break-words">
          <span className="font-semibold">
            {reply.author.id === youId ? 'You' : reply.author.name.split(' ')[0]}:
          </span>{' '}
          {reply.body}
        </p>
      </div>
    ))}
  </>
);

export const LinkedTasks: React.FC<{ checkin: Checkin }> = ({ checkin }) =>
  checkin.linkedTasks.length > 0 ? (
    <ul className="flex flex-col gap-1.5">
      {checkin.linkedTasks.map((task) => (
        <li key={task.id} className="flex items-center gap-2 min-w-0">
          <StatusBadge status={task.status} />
          <Link to={`/tasks/${task.id}`} className="grow min-w-0 truncate text-text">
            {task.title}
          </Link>
          <AssigneeStack people={task.assignees} size="xs" />
        </li>
      ))}
    </ul>
  ) : null;

export const LateTag: React.FC = () => <span className="tag-late">Late</span>;
