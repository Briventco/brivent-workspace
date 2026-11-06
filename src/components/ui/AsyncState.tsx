import React from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { ApiQuery } from '../../lib/useApiQuery';
import { Link } from '../../lib/router';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { IconName } from './Icon';
import { SkeletonList } from './Skeleton';

export const LoadingState: React.FC<{ label?: string }> = ({ label }) => (
  <SkeletonList label={label} />
);

export const ErrorState: React.FC<{
  title?: string;
  message: string;
  icon?: IconName;
  onRetry?: () => void;
}> = ({ title = "Couldn't load this", message, icon = 'error', onRetry }) => (
  <EmptyState icon={icon} tone="danger" title={title} description={message}>
    {onRetry && (
      <Button variant="secondary" icon="refresh" onClick={onRetry}>
        Try again
      </Button>
    )}
  </EmptyState>
);

interface NoAccessProps {
  title?: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
}

/** Only reached by following a link: normal navigation never leads here. */
export const NoAccess: React.FC<NoAccessProps> = ({
  title = "You don't have access to this",
  description = 'If you think that\'s a mistake, ask your administrator.',
  backTo = '/',
  backLabel = 'Back to dashboard',
}) => (
  <EmptyState icon="lock" tone="neutral" title={title} description={description}>
    <Link to={backTo} className="btn btn-ghost">
      {backLabel}
    </Link>
  </EmptyState>
);

interface AsyncStateProps<T> {
  query: ApiQuery<T>;
  loadingLabel?: string;
  errorTitle?: string;
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}

/** The loading, error, 403 and empty states every data fetch needs. */
export function AsyncState<T>({
  query,
  loadingLabel,
  errorTitle,
  isEmpty,
  empty,
  children,
}: AsyncStateProps<T>) {
  const { data, error, reload } = query;

  if (error instanceof ApiError && error.isForbidden) return <NoAccess />;
  if (error) return <ErrorState title={errorTitle} message={errorMessage(error)} onRetry={reload} />;
  if (data === undefined) return <LoadingState label={loadingLabel} />;
  if (isEmpty?.(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}
