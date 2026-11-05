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
    <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
      <span>
        Page {page} of {Math.ceil(total / pageSize)}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
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
