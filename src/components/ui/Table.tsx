import React from 'react';

interface TableProps {
  /** Named for screen readers. The wrapper scrolls sideways, so keyboards need to reach it. */
  caption: string;
  children: React.ReactNode;
  /** Extra table classes, such as table-pin-first to keep names in view while scrolling. */
  className?: string;
}

export const Table: React.FC<TableProps> = ({ caption, children, className = '' }) => (
  <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
    <table className={`table table-sticky ${className}`}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  </div>
);

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  /** Makes the whole row open the item, by mouse or keyboard. */
  onOpen?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({
  selected = false,
  onOpen,
  className = '',
  ...props
}) => (
  <tr
    className={`${selected ? 'sel' : ''} ${onOpen ? 'row-link' : ''} ${className}`}
    aria-selected={onOpen ? selected : undefined}
    tabIndex={onOpen ? 0 : undefined}
    onClick={
      onOpen &&
      ((e) => {
        // A button or link inside the row does its own thing.
        if (!(e.target as HTMLElement).closest('a, button, select, input')) onOpen();
      })
    }
    onKeyDown={
      onOpen &&
      ((e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) onOpen();
      })
    }
    {...props}
  />
);
