import React, { useEffect, useState } from 'react';

const DELAY_MS = 300;

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`sk ${className}`} />
);

/** Under 300ms a load shows nothing at all, so fast pages don't flicker. */
function useDelayed(ms: number): boolean {
  const [isDue, setIsDue] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setIsDue(true), ms);
    return () => window.clearTimeout(timer);
  }, [ms]);
  return isDue;
}

interface SkeletonListProps {
  /** Announced to screen readers. */
  label?: string;
  rows?: number;
}

/** Copies the shape of a list row, so nothing jumps when the content lands. */
export const SkeletonList: React.FC<SkeletonListProps> = ({ label = 'Loading…', rows = 4 }) => {
  const isDue = useDelayed(DELAY_MS);

  return (
    <div role="status" aria-label={label}>
      {isDue && (
        <div className="card" aria-hidden="true">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="li">
              <Skeleton className="w-6 h-6 rounded-full shrink-0" />
              <div className="grow space-y-2">
                <Skeleton className="w-1/2" />
                <Skeleton className="w-1/3 h-2" />
              </div>
              <Skeleton className="w-16 hidden sm:block" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
