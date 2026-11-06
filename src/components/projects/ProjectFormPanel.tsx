import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { createProject, ProjectChanges, updateProject } from '../../api/projects';
import {
  PersonRef,
  Project,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  ProjectStatus,
} from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AssigneePicker } from '../tasks/AssigneePicker';
import { Avatar } from '../ui/Avatar';
import { Banner } from '../ui/Banner';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { SidePanel } from '../ui/SidePanel';
import { Textarea } from '../ui/Textarea';

const STATUS_OPTIONS = PROJECT_STATUSES.map((value) => ({
  value,
  label: PROJECT_STATUS_LABELS[value],
}));

interface ProjectFormPanelProps {
  /** Edits this project. Without it, the panel creates a new one. */
  project?: Project;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

export const ProjectFormPanel: React.FC<ProjectFormPanelProps> = ({ project, onClose, onSaved }) => {
  const { user } = useSession();
  const toast = useToast();

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'ACTIVE');
  const [startDate, setStartDate] = useState(project?.startDate ?? '');
  const [dueDate, setDueDate] = useState(project?.dueDate ?? '');
  const [owner, setOwner] = useState<PersonRef | null>(project?.owner ?? null);
  const [members, setMembers] = useState<PersonRef[]>([]);

  const [errors, setErrors] = useState<{ name?: string; dueDate?: string; owner?: string }>({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const save = () => {
    if (!project) {
      return createProject({
        name: name.trim(),
        status,
        ...(description.trim() && { description: description.trim() }),
        ...(startDate && { startDate }),
        ...(dueDate && { dueDate }),
        memberIds: members.map((member) => member.id),
      });
    }
    const changes: ProjectChanges = {};
    if (name.trim() !== project.name) changes.name = name.trim();
    if (description.trim() !== (project.description ?? '')) {
      changes.description = description.trim() || null;
    }
    if (status !== project.status) changes.status = status;
    if (startDate !== (project.startDate ?? '')) changes.startDate = startDate || null;
    if (dueDate !== (project.dueDate ?? '')) changes.dueDate = dueDate || null;
    if (owner && owner.id !== project.owner.id) changes.ownerId = owner.id;
    return updateProject(project.id, changes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors = {
      name: name.trim() ? undefined : 'Give the project a name.',
      dueDate:
        startDate && dueDate && dueDate < startDate
          ? "The target date can't be before the start."
          : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.dueDate) return;

    setIsSaving(true);
    try {
      const saved = await save();
      toast.success(project ? 'Project updated.' : 'Project created.');
      onSaved(saved);
    } catch (error) {
      setIsSaving(false);
      if (error instanceof ApiError && error.code === 'INVALID_DATE_RANGE') {
        setErrors({ dueDate: error.message });
      } else if (error instanceof ApiError && error.code === 'OWNER_NOT_FOUND') {
        setErrors({ owner: error.message });
      } else if (error instanceof ApiError && error.fieldErrors.name) {
        setErrors({ name: error.fieldErrors.name });
      } else {
        setFormError(errorMessage(error));
      }
    }
  };

  const formId = project ? 'edit-project-form' : 'new-project-form';

  return (
    <SidePanel
      isOpen
      onClose={isSaving ? () => {} : onClose}
      title={project ? 'Edit project' : 'New project'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} isLoading={isSaving}>
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Banner>{formError}</Banner>}
        <Input
          label="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          maxLength={120}
          autoComplete="off"
          data-autofocus
        />
        <Textarea
          label="What is it for?"
          optional
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
        {project ? (
          <AssigneePicker
            label="Owner"
            allowNone={false}
            value={owner}
            onChange={(person) => setOwner(person)}
            error={errors.owner}
          />
        ) : (
          <p className="text-small text-text-2">
            You'll be the owner, and can hand it to someone else later.
          </p>
        )}
        <div className="grid gap-4 grid-cols-2">
          <Input
            label="Start date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Target date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            error={errors.dueDate}
          />
        </div>
        <Select
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          helperText={project ? "Projects can't be deleted. Use Completed when it's done." : undefined}
        />
        {!project && (
          <div>
            <AssigneePicker
              label="Members"
              allowNone={false}
              placeholder="Add people"
              value={null}
              excludeIds={[user.id, ...members.map((member) => member.id)]}
              onChange={(person) => person && setMembers((current) => [...current, person])}
            />
            {members.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {members.map((member) => (
                  <li key={member.id} className="chip">
                    <Avatar name={member.name} id={member.id} size="sm" />
                    {member.name}
                    <IconButton
                      icon="close"
                      size="sm"
                      label={`Remove ${member.name}`}
                      onClick={() =>
                        setMembers((current) => current.filter(({ id }) => id !== member.id))
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-small text-text-2">
              Only members and managers can see this project and its tasks.
            </p>
          </div>
        )}
      </form>
    </SidePanel>
  );
};
