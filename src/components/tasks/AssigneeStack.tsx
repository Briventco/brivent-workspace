import React from 'react';
import { Placement, Named } from '../../api/types';
import { personTitle } from '../../lib/people';
import { Avatar } from '../ui/Avatar';

const MAX_SHOWN = 3;

interface AssigneeStackProps {
  people: (Named & Placement)[];
  size?: 'xs' | 'sm';
  /** Writes out one person's name and position, and "Unassigned" for nobody. */
  showDetail?: boolean;
}

/** Up to three faces, then a count, with everyone's names on hover. */
export const AssigneeStack: React.FC<AssigneeStackProps> = ({
  people,
  size = 'sm',
  showDetail = false,
}) => {
  if (people.length === 0) {
    return showDetail ? <span className="text-text-3">Unassigned</span> : null;
  }

  const names = people.map(({ name }) => name).join(', ');
  const extra = people.length - MAX_SHOWN;
  const [only] = people;

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span className="av-stack shrink-0 items-center" role="img" title={names} aria-label={names}>
        {people.slice(0, MAX_SHOWN).map((person) => (
          <Avatar key={person.id} name={person.name} id={person.id} size={size} />
        ))}
        {extra > 0 && <span className="ml-1 text-small text-text-2">+{extra}</span>}
      </span>
      {showDetail && people.length === 1 && (
        <span className="min-w-0">
          {only.name}
          {personTitle(only) && (
            <span className="block text-small text-text-2">{personTitle(only)}</span>
          )}
        </span>
      )}
    </span>
  );
};
