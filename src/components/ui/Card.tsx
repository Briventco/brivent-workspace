import React from 'react';
import { Link } from '../../lib/router';
import { Icon, IconName } from './Icon';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<DivProps> = ({ className = '', ...props }) => (
  <div className={`card overflow-hidden ${className}`} {...props} />
);

export const CardHeader: React.FC<DivProps> = ({ className = '', ...props }) => (
  <div className={`card-head ${className}`} {...props} />
);

export const CardBody: React.FC<DivProps> = ({ className = '', ...props }) => (
  <div className={`card-pad ${className}`} {...props} />
);

export const CardFooter: React.FC<DivProps> = ({ className = '', ...props }) => (
  <div className={`card-foot ${className}`} {...props} />
);

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: IconName;
  hint?: string;
  /** Marks a number that needs action, such as overdue work. */
  attention?: boolean;
  /** Every number is a link to the list behind it. */
  to?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, hint, attention, to }) => {
  const body = (
    <>
      <span className={`k ${attention ? 'text-danger' : ''}`}>
        {icon && <Icon name={icon} size="sm" />}
        {label}
      </span>
      <span className={`v ${attention ? 'text-danger' : ''}`}>{value}</span>
      {hint && <span className="text-caption text-text-3">{hint}</span>}
    </>
  );
  const className = `card kpi ${attention ? 'attn' : ''}`;

  return to ? (
    <Link to={to} className={`${className} no-underline hover:no-underline text-text`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
};
