import React from 'react';
import { Icon } from '../ui/Icon';
import { STATUS_LABELS, Task, TASK_STATUSES, TaskStatus } from '../../api/types';
import { Link } from '../../lib/router';
import { formatDateTime } from '../../lib/tasks';
import { PriorityBadge, StatusBadge } from '../ui/badges';
import { Select } from '../ui/Select';

const STATUS_OPTIONS = TASK_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

interface TaskListViewProps {
  tasks: Task[];
  canChangeStatus: (task: Task) => boolean;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  busyTaskId: string | null;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  canChangeStatus,
  onStatusChange,
  busyTaskId,
}) => (
  <ul className="divide-y divide-border">
    {tasks.map((task) => (
      <li
        key={task.id}
        className="px-4 sm:px-5 py-3 flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="flex-1 min-w-0">
          <Link
            to={`/tasks/${task.id}`}
            className="block font-semibold text-text break-words rounded"
          >
            {task.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-small text-text-2">
            {task.project && (
              <Link
                to={`/projects/${task.project.id}`}
                className="inline-flex items-center gap-1.5 text-text-2"
              >
                <Icon name="folder_open" size="sm" />
                {task.project.name}
              </Link>
            )}
            <PriorityBadge priority={task.priority} />
            {task.isOverdue && (
              <span className="overdue">
                <Icon name="schedule" size="sm" />
                Overdue
              </span>
            )}
            {task.deadline && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar_today" size="sm" />
                {formatDateTime(task.deadline)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Icon name="person" size="sm" />
              {task.assignee?.name ?? 'Unassigned'}
            </span>
          </div>
        </div>

        <div className="sm:w-40 shrink-0">
          {canChangeStatus(task) ? (
            <Select
              label={`Status of ${task.title}`}
              hideLabel
              value={task.status}
              options={STATUS_OPTIONS}
              disabled={busyTaskId === task.id}
              onChange={(e) => onStatusChange(task, e.target.value as TaskStatus)}
            />
          ) : (
            <StatusBadge status={task.status} />
          )}
        </div>
      </li>
    ))}
  </ul>
);
