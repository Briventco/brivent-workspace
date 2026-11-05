import React from 'react';
import { AlertTriangle, ShieldX } from 'lucide-react';
import { ApiError, errorMessage } from '../../api/client';
import { ApiQuery } from '../../lib/useApiQuery';
import { Link } from '../../lib/router';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Spinner } from './Spinner';

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div role="status" className="flex items-center justify-center gap-2.5 py-16 text-sm text-slate-600">
    <Spinner />
    <span>{label}</span>
  </div>
);

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <EmptyState
    icon={<AlertTriangle className="w-6 h-6" aria-hidden="true" />}
    title="We couldn't load this"
    description={message}
  >
    {onRetry && (
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    )}
  </EmptyState>
);

export const AccessDenied: React.FC = () => (
  <EmptyState
    icon={<ShieldX className="w-6 h-6" aria-hidden="true" />}
    title="You don't have access"
    description="Your account doesn't have permission to view this. If you think that's a mistake, ask your administrator."
  >
    <Link to="/" className="text-sm font-medium text-brivent-700 hover:underline rounded">
      Back to dashboard
    </Link>
  </EmptyState>
);

interface AsyncStateProps<T> {
  query: ApiQuery<T>;
  loadingLabel?: string;
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}

/** The loading, error, 403 and empty states every data fetch needs. */
export function AsyncState<T>({ query, loadingLabel, isEmpty, empty, children }: AsyncStateProps<T>) {
  const { data, error, reload } = query;

  if (error instanceof ApiError && error.isForbidden) return <AccessDenied />;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={reload} />;
  if (data === undefined) return <LoadingState label={loadingLabel} />;
  if (isEmpty?.(data)) return <>{empty}</>;
  return <>{children(data)}</>;
}
