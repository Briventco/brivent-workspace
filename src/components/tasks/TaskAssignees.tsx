import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { setTaskAssignees } from '../../api/tasks';
import { MAX_ASSIGNEES, Task, TaskAssignee } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { personTitle } from '../../lib/people';
import { formatDateTime } from '../../lib/tasks';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/Button';
import { AssigneePicker } from './AssigneePicker';

function assignedLine({ assignedBy, assignedAt }: TaskAssignee): string {
  if (!assignedBy || !assignedAt) return '';
  return `Assigned by ${assignedBy.name}, ${formatDateTime(assignedAt)}`;
}

interface TaskAssigneesProps {
  task: Task;
  onChanged: () => void;
}

export const TaskAssignees: React.FC<TaskAssigneesProps> = ({ task, onChanged }) => {
  const { can } = useSession();
  const toast = useToast();
  const [isBusy, setIsBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canAssign = can('assignTask') && can('viewDirectory');
  const ids = task.assignees.map(({ id }) => id);

  // The API replaces the whole set, so everyone who stays has to be in the list.
  const save = async (next: string[], message: string) => {
    setIsBusy(true);
    try {
      await setTaskAssignees(task.id, next);
      toast.success(message);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
      if (error instanceof ApiError && error.code.startsWith('ASSIGNEE_')) {
        setRefreshKey((key) => key + 1);
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="mt-5 pt-5 border-t border-border">
      <h2 className="t-over text-text-2 mb-2">Assignees · {task.assignees.length}</h2>
      {task.assignees.length === 0 ? (
        <p className="text-text-2">Nobody is assigned yet.</p>
      ) : (
        <ul className="space-y-3">
          {task.assignees.map((person) => (
            <li key={person.id} className="flex items-start gap-2.5 min-w-0">
              <Avatar name={person.name} id={person.id} avatar={person.avatar} size="sm" />
              <div className="min-w-0 grow">
                <p className="font-semibold break-words">{person.name}</p>
                {personTitle(person) && (
                  <p className="text-small text-text-2 break-words">{personTitle(person)}</p>
                )}
                {assignedLine(person) && (
                  <p className="text-small text-text-2 break-words">{assignedLine(person)}</p>
                )}
              </div>
              {canAssign && (
                <IconButton
                  icon="close"
                  size="sm"
                  label={`Remove ${person.name}`}
                  disabled={isBusy}
                  onClick={() =>
                    save(
                      ids.filter((id) => id !== person.id),
                      `${person.name} removed.`,
                    )
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {canAssign &&
        (ids.length < MAX_ASSIGNEES ? (
          <div className="mt-3">
            <AssigneePicker
              label="Add assignee"
              allowNone={false}
              placeholder="Add people"
              value={null}
              excludeIds={ids}
              refreshKey={refreshKey}
              onChange={(person) =>
                person && save([...ids, person.id], `${person.name} added.`)
              }
            />
          </div>
        ) : (
          <p className="mt-3 text-small text-text-2">
            A task can have up to {MAX_ASSIGNEES} people. Remove someone to add another.
          </p>
        ))}
    </section>
  );
};
