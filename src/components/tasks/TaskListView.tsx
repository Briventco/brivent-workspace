import React from 'react';
import { AlertTriangle, Calendar, UserRound } from 'lucide-react';
import { STATUS_LABELS, Task, TASK_STATUSES, TaskStatus } from '../../api/types';
import { Link } from '../../lib/router';
import { formatDateTime } from '../../lib/tasks';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { TaskStatusBadge } from './TaskStatusBadge';

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
  <ul className="divide-y divide-slate-200">
    {tasks.map((task) => (
      <li
        key={task.id}
        className={`px-4 sm:px-5 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center ${
          task.isOverdue ? 'bg-rose-50/60' : ''
        }`}
      >
        <div className="flex-1 min-w-0">
          <Link
            to={`/tasks/${task.id}`}
            className="block font-medium text-slate-900 hover:text-brivent-700 break-words rounded"
          >
            {task.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-600">
            <TaskPriorityBadge priority={task.priority} />
            {task.isOverdue && (
              <Badge variant="danger" size="sm">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                Overdue
              </Badge>
            )}
            {task.deadline && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                {formatDateTime(task.deadline)}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="w-3.5 h-3.5" aria-hidden="true" />
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
            <TaskStatusBadge status={task.status} />
          )}
        </div>
      </li>
    ))}
  </ul>
);
