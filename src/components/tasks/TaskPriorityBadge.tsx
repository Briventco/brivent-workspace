import React from 'react';
import { PRIORITY_LABELS, TaskPriority } from '../../api/types';
import { Badge, BadgeVariant } from '../ui/Badge';
import { ArrowDown, ArrowUp, Flame, Minus } from 'lucide-react';

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  size?: 'sm' | 'md';
}

const CONFIG: Record<TaskPriority, { variant: BadgeVariant; icon: React.ReactNode }> = {
  LOW: { variant: 'neutral', icon: <ArrowDown className="w-3 h-3" aria-hidden="true" /> },
  MEDIUM: { variant: 'info', icon: <Minus className="w-3 h-3" aria-hidden="true" /> },
  HIGH: { variant: 'warning', icon: <ArrowUp className="w-3 h-3" aria-hidden="true" /> },
  URGENT: { variant: 'danger', icon: <Flame className="w-3 h-3" aria-hidden="true" /> },
};

export const TaskPriorityBadge: React.FC<TaskPriorityBadgeProps> = ({ priority, size = 'sm' }) => (
  <Badge variant={CONFIG[priority].variant} size={size}>
    {CONFIG[priority].icon}
    {PRIORITY_LABELS[priority]}
  </Badge>
);
