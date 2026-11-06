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
  /** A shorter label for phones, where the card is a third of the screen. */
  phoneLabel?: string;
  value: React.ReactNode;
  icon?: IconName;
  hint?: React.ReactNode;
  /** Marks a number that needs action, such as overdue work. */
  attention?: boolean;
  /** Every number is a link to the list behind it. */
  to?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  phoneLabel,
  value,
  icon,
  hint,
  attention,
  to,
  className: extraClass = '',
}) => {
  const body = (
    <>
      <span className={`k ${attention ? 'text-danger' : ''}`}>
        {icon && <Icon name={icon} size="sm" />}
        {phoneLabel ? (
          <>
            <span className="md:hidden" aria-hidden="true">
              {phoneLabel}
            </span>
            <span className="max-md:sr-only">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
      <span className={`v ${attention ? 'text-danger' : ''}`}>{value}</span>
      {hint && <span className="kpi-hint text-caption text-text-3">{hint}</span>}
    </>
  );
  const className = `card kpi ${attention ? 'attn' : ''} ${extraClass}`;

  return to ? (
    <Link to={to} className={`${className} no-underline hover:no-underline text-text`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
};
