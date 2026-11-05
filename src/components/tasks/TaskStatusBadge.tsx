import React from 'react';
import { STATUS_LABELS, TaskStatus } from '../../api/types';
import { Badge, BadgeVariant } from '../ui/Badge';
import { AlertCircle, CheckCircle2, Clock, PlayCircle } from 'lucide-react';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

const CONFIG: Record<TaskStatus, { variant: BadgeVariant; icon: React.ReactNode }> = {
  TODO: { variant: 'secondary', icon: <Clock className="w-3 h-3" aria-hidden="true" /> },
  IN_PROGRESS: { variant: 'primary', icon: <PlayCircle className="w-3 h-3" aria-hidden="true" /> },
  BLOCKED: { variant: 'danger', icon: <AlertCircle className="w-3 h-3" aria-hidden="true" /> },
  DONE: { variant: 'success', icon: <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> },
};

export const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, size = 'sm' }) => (
  <Badge variant={CONFIG[status].variant} size={size}>
    {CONFIG[status].icon}
    {STATUS_LABELS[status]}
  </Badge>
);
