import React from 'react';
import { STATUS_LABELS, Task } from '../../api/types';
import { nameAndTitle } from '../../lib/people';
import { Link } from '../../lib/router';
import { daysBetween, formatShortDate, watDate } from '../../lib/wat';
import { Avatar } from '../ui/Avatar';
import { PriorityBadge, StatusBadge, StatusIcon } from '../ui/badges';
import { Icon } from '../ui/Icon';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const isDueToday = (task: Task) =>
  Boolean(task.deadline) && !task.isOverdue && watDate(new Date(task.deadline!)) === watDate();

/** Days past the deadline, counting calendar days in WAT. */
export const daysLate = (task: Task) => daysBetween(new Date(task.deadline!), new Date());

export const DeadlineLabel: React.FC<{ task: Task }> = ({ task }) => {
  if (task.isOverdue) {
    const days = daysLate(task);
    return (
      <span className="overdue">
        <Icon name="schedule" size="sm" />
        {days > 0 ? `${plural(days, 'day')} overdue` : 'Overdue today'}
      </span>
    );
  }
  if (isDueToday(task)) {
    return (
      <span className="due-today">
        <Icon name="today" size="sm" />
        Due today
      </span>
    );
  }
  if (!task.deadline) return <span className="text-text-3">No deadline</span>;
  return <span className="text-text-2">{formatShortDate(new Date(task.deadline))}</span>;
};

const subtitle = (task: Task) =>
  [task.project?.name, task.assignedBy && `Assigned by ${task.assignedBy.name}`]
    .filter(Boolean)
    .join(' · ');

interface TaskRowProps {
  task: Task;
  /** On a project's page the project goes without saying, and who has it matters more. */
  showAssignee?: boolean;
}

export const TaskRow: React.FC<TaskRowProps> = ({ task, showAssignee = false }) => (
  <li>
    <Link to={`/tasks/${task.id}`} className="li text-text hover:no-underline">
      <span className="hidden sm:inline-flex shrink-0">
        <StatusBadge status={task.status} />
      </span>
      <span className="sm:hidden shrink-0">
        <StatusIcon status={task.status} />
      </span>
      <span className="min-w-0 grow">
        <span className="title block break-words">{task.title}</span>
        {!showAssignee && subtitle(task) && (
          <span className="hidden sm:block text-small text-text-2 truncate">{subtitle(task)}</span>
        )}
        <span className="sm:hidden flex flex-wrap items-center gap-x-1 text-small text-text-2">
          {STATUS_LABELS[task.status]} · <DeadlineLabel task={task} />
        </span>
      </span>
      <span className="shrink-0">
        <PriorityBadge priority={task.priority} />
      </span>
      {showAssignee && (
        <span className="hidden sm:block shrink-0" title={task.assignee ? nameAndTitle(task.assignee) : 'Unassigned'}>
          {task.assignee ? (
            <Avatar name={task.assignee.name} id={task.assignee.id} size="sm" />
          ) : (
            <Icon name="person" size="sm" className="text-text-3" />
          )}
        </span>
      )}
      <span className="hidden sm:block shrink-0 w-[132px] text-right">
        <DeadlineLabel task={task} />
      </span>
    </Link>
  </li>
);
