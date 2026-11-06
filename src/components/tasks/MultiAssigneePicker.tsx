import React from 'react';
import { MAX_ASSIGNEES, PersonRef } from '../../api/types';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/Button';
import { AssigneePicker } from './AssigneePicker';

interface MultiAssigneePickerProps {
  value: PersonRef[];
  onChange: (people: PersonRef[]) => void;
  error?: string;
  /** Bumped by the parent to re-read the list, such as after ASSIGNEE_DEACTIVATED. */
  refreshKey?: number;
  label?: string;
  limit?: number;
  /** Replaces the picker once `limit` is reached. */
  limitNote?: string;
}

export const MultiAssigneePicker: React.FC<MultiAssigneePickerProps> = ({
  value,
  onChange,
  error,
  refreshKey,
  label = 'Assignees',
  limit = MAX_ASSIGNEES,
  limitNote = `A task can have up to ${MAX_ASSIGNEES} people. Remove someone to add another.`,
}) => (
  <div>
    {value.length < limit ? (
      <AssigneePicker
        label={label}
        allowNone={false}
        keepOpen
        placeholder="Add people"
        value={null}
        excludeIds={value.map(({ id }) => id)}
        onChange={(person) => person && onChange([...value, person])}
        error={error}
        refreshKey={refreshKey}
      />
    ) : (
      <>
        <p className="label">{label}</p>
        <p className="text-small text-text-2">{limitNote}</p>
      </>
    )}
    {value.length > 0 && (
      <ul className="mt-2 flex flex-wrap gap-2">
        {value.map((person) => (
          <li key={person.id} className="chip">
            <Avatar name={person.name} id={person.id} size="sm" />
            {person.name}
            <IconButton
              icon="close"
              size="sm"
              label={`Remove ${person.name}`}
              onClick={() => onChange(value.filter(({ id }) => id !== person.id))}
            />
          </li>
        ))}
      </ul>
    )}
  </div>
);
