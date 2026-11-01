import React from 'react';
import { TaskPriority } from '../../types';
import { Badge, BadgeVariant } from '../ui/Badge';
import { ArrowDown, ArrowUp, Flame, Minus } from 'lucide-react';

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  size?: 'sm' | 'md';
}

export const TaskPriorityBadge: React.FC<TaskPriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const config: Record<
    TaskPriority,
    { label: string; variant: BadgeVariant; icon: React.ReactNode }
  > = {
    LOW: {
      label: 'Low',
      variant: 'neutral',
      icon: <ArrowDown className="w-3 h-3 text-slate-500" />,
    },
    MEDIUM: {
      label: 'Medium',
      variant: 'info',
      icon: <Minus className="w-3 h-3 text-cyan-600" />,
    },
    HIGH: {
      label: 'High',
      variant: 'warning',
      icon: <ArrowUp className="w-3 h-3 text-amber-600" />,
    },
    URGENT: {
      label: 'Urgent',
      variant: 'danger',
      icon: <Flame className="w-3 h-3 text-rose-600" />,
    },
  };

  const item = config[priority] || {
    label: priority,
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

