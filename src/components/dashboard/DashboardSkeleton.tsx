import React, { useEffect, useState } from 'react';
import { Skeleton } from '../ui/Skeleton';

const DELAY_MS = 300;

const CardShape: React.FC<{ rows: number }> = ({ rows }) => (
  <div className="card" aria-hidden="true">
    <div className="px-5 py-4 border-b border-border">
      <Skeleton className="w-40" />
    </div>
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="li">
        <Skeleton className="w-6 h-6 rounded-full shrink-0" />
        <div className="grow space-y-2">
          <Skeleton className="w-2/3" />
          <Skeleton className="w-1/3 h-2" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * The dashboard's own shape: stat cards, then a main column and a side column. Its space is held
 * from the first frame, and the grey only shows after 300ms, so a fast load doesn't flicker.
 */
export const DashboardSkeleton: React.FC<{ stats?: number; side?: boolean }> = ({
  stats = 4,
  side = true,
}) => {
  const [isDue, setIsDue] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setIsDue(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-label="Loading your dashboard…" className="min-h-[640px]">
      {isDue && (
        <>
          <div
            className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-[repeat(var(--stats),minmax(0,1fr))] gap-3 md:gap-4 mb-5"
            style={{ '--stats': stats } as React.CSSProperties}
            aria-hidden="true"
          >
            {Array.from({ length: stats }, (_, index) => (
              <Skeleton key={index} className="h-[104px] rounded-lg" />
            ))}
          </div>
          <div className={`grid gap-5 items-start ${side ? 'xl:grid-cols-[minmax(0,1fr)_300px]' : ''}`}>
            <CardShape rows={4} />
            {side && (
              <div className="space-y-5">
                <CardShape rows={3} />
                <CardShape rows={2} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
