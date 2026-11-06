import React from 'react';
import { Button } from './Button';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

/** Renders nothing when everything fits on one page. */
export const Pagination: React.FC<PaginationProps> = ({ page, pageSize, total, onChange }) => {
  if (total <= pageSize) return null;

  return (
    <div className="card-foot flex items-center justify-between gap-2 text-text-2">
      <span>
        Page {page} of {Math.ceil(total / pageSize)}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
