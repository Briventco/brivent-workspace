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
}

export const MultiAssigneePicker: React.FC<MultiAssigneePickerProps> = ({
  value,
  onChange,
  error,
  refreshKey,
}) => (
  <div>
    {value.length < MAX_ASSIGNEES ? (
      <AssigneePicker
        label="Assignees"
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
        <p className="label">Assignees</p>
        <p className="text-small text-text-2">
          A task can have up to {MAX_ASSIGNEES} people. Remove someone to add another.
        </p>
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
