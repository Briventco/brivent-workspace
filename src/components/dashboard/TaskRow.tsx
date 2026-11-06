import React from 'react';
import { STATUS_LABELS, Task } from '../../api/types';
import { Link } from '../../lib/router';
import { daysBetween, formatShortDate, watDate } from '../../lib/wat';
import { PriorityBadge, StatusBadge, StatusIcon } from '../ui/badges';
import { Icon } from '../ui/Icon';
import { AssigneeStack } from '../tasks/AssigneeStack';
import { useSession } from '../../context/AuthContext';

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

/** Who gave this person the task, or else the first person to get it. */
const assignerOf = (task: Task, userId: string) =>
  (task.assignees.find(({ id }) => id === userId) ?? task.assignees[0])?.assignedBy;

const subtitle = (task: Task, userId: string) => {
  const assigner = assignerOf(task, userId);
  return [task.project?.name, assigner && `Assigned by ${assigner.name}`]
    .filter(Boolean)
    .join(' · ');
};

interface TaskRowProps {
  task: Task;
  /** On a project's page the project goes without saying, and who has it matters more. */
  showAssignee?: boolean;
}

export const TaskRow: React.FC<TaskRowProps> = ({ task, showAssignee = false }) => {
  const { user } = useSession();
  const line = subtitle(task, user.id);
  // Your own list doesn't need your name, but a task you share should say so.
  const showPeople = showAssignee || task.assignees.length > 1;

  return (
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
          {!showAssignee && line && (
            <span className="hidden sm:block text-small text-text-2 truncate">{line}</span>
          )}
          <span className="sm:hidden flex flex-wrap items-center gap-x-1 text-small text-text-2">
            {STATUS_LABELS[task.status]} · <DeadlineLabel task={task} />
          </span>
        </span>
        <span className="shrink-0">
          <PriorityBadge priority={task.priority} />
        </span>
        {showPeople && (
          <span className="shrink-0">
            {task.assignees.length > 0 ? (
              <AssigneeStack people={task.assignees} />
            ) : (
              <span title="Unassigned" className="hidden sm:inline-flex">
                <Icon name="person" size="sm" className="text-text-3" />
              </span>
            )}
          </span>
        )}
        <span className="hidden sm:block shrink-0 w-[132px] text-right">
          <DeadlineLabel task={task} />
        </span>
      </Link>
    </li>
  );
};
