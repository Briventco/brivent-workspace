import React from 'react';

interface CountBadgeProps {
  count: number;
  /** Read out after the number, such as "unread". */
  label: string;
  isMention?: boolean;
}

export const CountBadge: React.FC<CountBadgeProps> = ({ count, label, isMention = false }) => (
  <span className={`count-badge ${isMention ? 'is-mention' : ''}`}>
    <span aria-hidden="true">
      {isMention && '@'}
      {count > 99 ? '99+' : count}
    </span>
    <span className="sr-only">
      {count} {label}
    </span>
  </span>
);
