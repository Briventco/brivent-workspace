import React from 'react';
import { Icon, IconName } from './Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: React.ReactNode;
  tone?: 'brand' | 'danger' | 'neutral';
  /** The one action, and only when this viewer can take it. */
  children?: React.ReactNode;
}

const TONE_CLASS = { brand: '', danger: 'danger', neutral: 'neutral' };

/** A soft icon tile, what happened, and what's next. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  tone = 'brand',
  children,
}) => (
  <div className="card empty">
    <span className={`empty-icon ${TONE_CLASS[tone]}`}>
      <Icon name={icon} size="lg" />
    </span>
    <h2 className="t-h3">{title}</h2>
    <p>{description}</p>
    {children && <div className="mt-1">{children}</div>}
  </div>
);
