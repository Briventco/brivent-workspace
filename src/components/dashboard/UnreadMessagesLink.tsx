import React from 'react';
import { TaskSummary } from '../../api/types';
import { useRealtime } from '../../context/RealtimeContext';
import { Link } from '../../lib/router';
import { Icon } from '../ui/Icon';

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Live from the socket, and only once the summary shows the backend sends these counts. */
export const UnreadMessagesLink: React.FC<{ summary: TaskSummary }> = ({ summary }) => {
  const { unread } = useRealtime();
  if (summary.unreadMessages === undefined || (!unread.messages && !unread.mentions)) return null;

  const facts = [
    unread.messages > 0 && `${count(unread.messages, 'unread message')}`,
    unread.mentions > 0 && `${count(unread.mentions, 'mention')}`,
  ].filter(Boolean);

  return (
    <Link
      to="/messages"
      className="flex items-center gap-2 mb-5 text-small font-semibold text-brand hover:underline"
    >
      <Icon name="forum" size="sm" />
      {facts.join(' and ')}
    </Link>
  );
};
