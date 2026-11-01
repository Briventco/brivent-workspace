import React from 'react';
import { TaskStatus } from '../../types';
import { Badge, BadgeVariant } from '../ui/Badge';
import { AlertCircle, CheckCircle2, Clock, PauseCircle, PlayCircle, XCircle } from 'lucide-react';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const config: Record<
    TaskStatus,
    { label: string; variant: BadgeVariant; icon: React.ReactNode }
  > = {
    BACKLOG: {
      label: 'Backlog',
      variant: 'neutral',
      icon: <Clock className="w-3 h-3" />,
    },
    TODO: {
      label: 'To Do',
      variant: 'secondary',
      icon: <Clock className="w-3 h-3" />,
    },
    IN_PROGRESS: {
      label: 'In Progress',
      variant: 'primary',
      icon: <PlayCircle className="w-3 h-3" />,
    },
    BLOCKED: {
      label: 'Blocked',
      variant: 'danger',
      icon: <AlertCircle className="w-3 h-3" />,
    },
    IN_REVIEW: {
      label: 'In Review',
      variant: 'warning',
      icon: <PauseCircle className="w-3 h-3" />,
    },
    COMPLETED: {
      label: 'Completed',
      variant: 'success',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    CANCELLED: {
      label: 'Cancelled',
      variant: 'neutral',
      icon: <XCircle className="w-3 h-3" />,
    },
  };

  const item = config[status] || {
    label: status,
    variant: 'neutral',
    icon: null,
  };

  return (
    <Badge variant={item.variant} size={size}>
      <span className="flex items-center gap-1">
        {item.icon}
        <span>{item.label}</span>
      </span>
    </Badge>
  );
};

