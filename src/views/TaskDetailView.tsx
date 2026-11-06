import React, { useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { ApiError, errorMessage } from '../api/client';
import { deleteTask, getTask, updateTaskStatus } from '../api/tasks';
import { STATUS_LABELS, Task, TASK_STATUSES, TaskStatus } from '../api/types';
import { TaskComments } from '../components/tasks/TaskComments';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { AsyncState } from '../components/ui/AsyncState';
import { PriorityBadge, StatusBadge } from '../components/ui/badges';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Select';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Link, navigate } from '../lib/router';
import { canChangeStatus, canEditDetails, formatDateTime } from '../lib/tasks';
import { useApiQuery } from '../lib/useApiQuery';

const STATUS_OPTIONS = TASK_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

const BackLink: React.FC = () => (
  <Link
    to="/tasks"
    className="inline-flex items-center gap-1.5 mb-4 font-semibold rounded"
  >
    <Icon name="arrow_back" size="sm" />
    My Tasks
  </Link>
);

const TaskDetails: React.FC<{ task: Task; onChanged: () => void }> = ({ task, onChanged }) => {
  const { user, can } = useSession();
  const toast = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const canEdit =
    canEditDetails(task, user.id, can) || can('assignTask');

  const handleStatusChange = async (status: TaskStatus) => {
    setIsChangingStatus(true);
    try {
      await updateTaskStatus(task.id, status);
      toast.success(`Moved to ${STATUS_LABELS[status]}.`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTask(task.id);
      toast.success('Task deleted.');
      navigate('/tasks', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  const facts = [
    { label: 'Assignee', value: task.assignee?.name ?? 'Unassigned' },
    ...(task.assignedBy && task.assignedAt
      ? [
          { label: 'Assigned by', value: task.assignedBy.name },
          { label: 'Assigned on', value: formatDateTime(task.assignedAt) },
        ]
      : []),
    { label: 'Deadline', value: task.deadline ? formatDateTime(task.deadline) : 'No deadline' },
    { label: 'Created by', value: task.creator.name },
    { label: 'Created on', value: formatDateTime(task.createdAt) },
    ...(task.completedAt ? [{ label: 'Completed on', value: formatDateTime(task.completedAt) }] : []),
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="t-h1 break-words">
            {task.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.isOverdue && (
              <span className="overdue">
                <Icon name="schedule" size="sm" />
                Overdue
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {canEdit && (
            <Button variant="secondary" icon="edit" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
          {can('deleteTask') && (
            <Button variant="danger-ghost" onClick={() => setIsConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        <Card className="lg:col-span-2">
          <CardBody>
            <h2 className="t-h2 mb-2">Description</h2>
            <p className="whitespace-pre-wrap break-words">
              {task.description || 'No description.'}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            {canChangeStatus(task, user.id, can) && (
              <div className="mb-5">
                <Select
                  label="Status"
                  value={task.status}
                  options={STATUS_OPTIONS}
                  disabled={isChangingStatus}
                  onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                />
              </div>
            )}
            <dl className="space-y-3">
              {facts.map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-text-2 shrink-0">{label}</dt>
                  <dd className="font-semibold text-right break-words min-w-0">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>

      <TaskComments taskId={task.id} />

      {isEditing && (
        <TaskFormModal
          task={task}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            onChanged();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        title="Delete task?"
        description={`"${task.title}" and all its comments will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete task"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setIsConfirmingDelete(false)}
      />
    </>
  );
};

export const TaskDetailView: React.FC<{ taskId: string }> = ({ taskId }) => {
  const query = useApiQuery<Task>((signal) => getTask(taskId, signal), [taskId]);
  const { error } = query;

  // The API answers 404 for tasks you can't see, and 400 for an id that isn't one at all.
  const isMissing = error instanceof ApiError && (error.status === 404 || error.status === 400);

  return (
    <>
      <BackLink />
      {isMissing ? (
        <EmptyState
          icon="search"
          title="Task not found"
          description="It may have been deleted, or you may not have access to it."
        />
      ) : (
        <AsyncState query={query} loadingLabel="Loading task…">
          {(task) => <TaskDetails task={task} onChanged={query.reload} />}
        </AsyncState>
      )}
    </>
  );
};
