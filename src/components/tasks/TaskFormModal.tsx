import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { createTask, TaskChanges, updateTask } from '../../api/tasks';
import { PersonRef, PRIORITY_LABELS, Task, TASK_PRIORITIES, TaskPriority } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PERMISSIONS } from '../../lib/permissions';
import { canEditDetails, fromDeadlineInput, toDeadlineInput } from '../../lib/tasks';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { AssigneePicker } from './AssigneePicker';

interface TaskFormModalProps {
  /** Edits this task. Without it, the form creates a new one. */
  task?: Task;
  onClose: () => void;
  onSaved: (task: Task) => void;
}

const PRIORITY_OPTIONS = TASK_PRIORITIES.map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ task, onClose, onSaved }) => {
  const { user, hasPermission } = useSession();
  const toast = useToast();

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM');
  const [deadline, setDeadline] = useState(toDeadlineInput(task?.deadline ?? null));
  const [assignee, setAssignee] = useState<PersonRef | null>(task?.assignee ?? null);

  const [errors, setErrors] = useState<{ title?: string; assignee?: string; deadline?: string }>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickerRefresh, setPickerRefresh] = useState(0);

  // The backend refuses the whole save if any field isn't allowed, so only show what is.
  const canEdit = !task || canEditDetails(task, user.id, hasPermission);
  const canAssign =
    hasPermission(PERMISSIONS.TASKS_ASSIGN) && hasPermission(PERMISSIONS.DIRECTORY_VIEW);

  const save = (): Promise<Task | null> => {
    if (!task) {
      return createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        ...(deadline && { deadline: fromDeadlineInput(deadline) }),
        ...(canAssign && assignee && { assigneeId: assignee.id }),
      });
    }

    const changes: TaskChanges = {};
    if (canEdit) {
      if (title.trim() !== task.title) changes.title = title.trim();
      if (description.trim() !== task.description) changes.description = description.trim();
      if (priority !== task.priority) changes.priority = priority;
      if (deadline !== toDeadlineInput(task.deadline)) {
        changes.deadline = deadline ? fromDeadlineInput(deadline) : null;
      }
    }
    if (canAssign && (assignee?.id ?? null) !== task.assigneeId) {
      changes.assigneeId = assignee?.id ?? null;
    }
    return Object.keys(changes).length > 0 ? updateTask(task.id, changes) : Promise.resolve(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors = {
      title: canEdit && !title.trim() ? 'Give the task a title.' : undefined,
      deadline:
        !task && deadline && new Date(deadline) < new Date()
          ? 'Choose a time in the future.'
          : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.deadline) return;

    setIsSubmitting(true);
    try {
      const saved = await save();
      if (saved) {
        toast.success(task ? 'Task updated.' : 'Task created.');
        onSaved(saved);
      } else {
        onClose();
      }
    } catch (error) {
      setIsSubmitting(false);
      if (error instanceof ApiError && error.code.startsWith('ASSIGNEE_')) {
        setErrors({ assignee: error.message });
        setPickerRefresh((n) => n + 1);
      } else if (error instanceof ApiError && error.fieldErrors.title) {
        setErrors({ title: error.fieldErrors.title });
      } else if (error instanceof ApiError && error.fieldErrors.deadline) {
        setErrors({ deadline: error.fieldErrors.deadline });
      } else {
        setFormError(errorMessage(error));
      }
    }
  };

  return (
    <Modal
      isOpen
      onClose={isSubmitting ? () => {} : onClose}
      title={task ? 'Edit task' : 'New task'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Alert>{formError}</Alert>}

        {canEdit && (
          <>
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              maxLength={200}
              autoComplete="off"
              data-autofocus
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={10000}
              rows={4}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                options={PRIORITY_OPTIONS}
              />
              <Input
                label="Deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                error={errors.deadline}
              />
            </div>
          </>
        )}

        {canAssign && (
          <AssigneePicker
            value={assignee}
            onChange={(person) => {
              setAssignee(person);
              setErrors((current) => ({ ...current, assignee: undefined }));
            }}
            error={errors.assignee}
            refreshKey={pickerRefresh}
          />
        )}

        <div className="pt-2 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
