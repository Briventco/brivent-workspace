import React, { useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import {
  createDepartment,
  createPosition,
  Department,
  DepartmentInput,
  Position,
  setPositionArchived,
  updateDepartment,
} from '../../api/departments';
import { Named } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { AssigneePicker } from '../tasks/AssigneePicker';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { SidePanel } from '../ui/SidePanel';
import { Textarea } from '../ui/Textarea';

const FORM_ID = 'department-form';

const people = (count: number) => (count === 1 ? '1 person' : `${count} people`);

interface PositionsProps {
  department: Department;
  onChanged: () => void;
}

const Positions: React.FC<PositionsProps> = ({ department, onChanged }) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [isAdding, setIsAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Position | null>(null);

  const positions = [...department.positions].sort(
    (a, b) => Number(a.isArchived) - Number(b.isArchived),
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter a position name.');
      return;
    }
    setNameError(undefined);
    setIsAdding(true);
    try {
      await createPosition(department.id, trimmed);
      setName('');
      onChanged();
    } catch (error) {
      setNameError(errorMessage(error));
    } finally {
      setIsAdding(false);
    }
  };

  const setArchived = async (position: Position, isArchived: boolean) => {
    setBusyId(position.id);
    try {
      await setPositionArchived(position.id, isArchived);
      toast.success(`${position.name} ${isArchived ? 'archived' : 'restored'}.`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
      setArchiving(null);
    }
  };

  return (
    <section className="mt-6">
      <h3 className="t-over text-text-2 mb-2">Positions · {positions.length}</h3>
      {positions.length === 0 ? (
        <p className="text-text-2 mb-3">No positions yet.</p>
      ) : (
        <ul className="divide-y divide-border mb-3">
          {positions.map((position) => (
            <li key={position.id} className="flex items-center gap-2 py-2 min-w-0">
              <span className="grow min-w-0">
                <span className={`block truncate ${position.isArchived ? 'text-text-2' : ''}`}>
                  {position.name}
                </span>
                <span className="block text-small text-text-2">
                  {people(position.memberCount)}
                  {position.isArchived && ' · Archived'}
                </span>
              </span>
              {position.isArchived ? (
                <Button
                  variant="ghost"
                  size="sm"
                  isLoading={busyId === position.id}
                  aria-label={`Restore ${position.name}`}
                  onClick={() => setArchived(position, false)}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Archive ${position.name}`}
                  onClick={() => setArchiving(position)}
                >
                  Archive
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {department.isArchived ? (
        <p className="text-small text-text-2">Restore this department to add positions.</p>
      ) : (
        <form onSubmit={add} noValidate className="flex items-start gap-2">
          <div className="grow min-w-0">
            <Input
              label="New position"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError}
              maxLength={120}
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="secondary" isLoading={isAdding} className="mt-[26px]">
            Add
          </Button>
        </form>
      )}

      <ConfirmDialog
        isOpen={archiving !== null}
        title="Archive position?"
        description={`${archiving?.name} won't be offered for anyone new. ${people(archiving?.memberCount ?? 0)} on it will keep it. You can restore it later.`}
        confirmLabel="Archive"
        isLoading={busyId !== null}
        onConfirm={() => archiving && setArchived(archiving, true)}
        onClose={() => setArchiving(null)}
      />
    </section>
  );
};

interface DepartmentPanelProps {
  /** null when adding one. */
  department: Department | null;
  onClose: () => void;
  /** Keeps the panel open on the new department, ready for its positions. */
  onCreated: (department: Department) => void;
  onChanged: () => void;
}

export const DepartmentPanel: React.FC<DepartmentPanelProps> = ({
  department,
  onClose,
  onCreated,
  onChanged,
}) => {
  const toast = useToast();
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [lead, setLead] = useState<Named | null>(department?.lead ?? null);
  const [nameError, setNameError] = useState<string>();
  const [leadError, setLeadError] = useState<string>();
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const showError = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'DEPARTMENT_NAME_TAKEN') {
      setNameError(error.message);
    } else if (error instanceof ApiError && error.code === 'LEAD_NOT_ACTIVE') {
      setLeadError(error.message);
    } else {
      setFormError(errorMessage(error));
    }
  };

  const changesFrom = (input: DepartmentInput, original: Department) => {
    const changes: Partial<DepartmentInput> = {};
    if (input.name !== original.name) changes.name = input.name;
    if (input.description !== original.description) changes.description = input.description;
    if (input.leadId !== (original.lead?.id ?? null)) changes.leadId = input.leadId;
    return changes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setLeadError(undefined);

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter a department name.');
      return;
    }
    setNameError(undefined);

    const input: DepartmentInput = {
      name: trimmed,
      description: description.trim() || null,
      leadId: lead?.id ?? null,
    };

    setIsSaving(true);
    try {
      if (department) {
        const changes = changesFrom(input, department);
        if (Object.keys(changes).length > 0) {
          await updateDepartment(department.id, changes);
          toast.success(`${trimmed} has been updated.`);
          onChanged();
        }
        onClose();
      } else {
        const created = await createDepartment(input);
        toast.success(`${trimmed} has been added. You can add its positions now.`);
        onCreated(created);
      }
    } catch (error) {
      showError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const setArchived = async (isArchived: boolean) => {
    if (!department) return;
    setIsArchiving(true);
    try {
      await updateDepartment(department.id, { isArchived });
      toast.success(`${department.name} ${isArchived ? 'archived' : 'restored'}.`);
      onChanged();
      if (isArchived) onClose();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setIsArchiving(false);
      setIsConfirming(false);
    }
  };

  return (
    <SidePanel
      isOpen
      onClose={onClose}
      title={department ? department.name : 'Add department'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Close
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSaving}>
            {department ? 'Save changes' : 'Add department'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError && <Banner>{formError}</Banner>}
        {department?.leadIsActive === false && (
          <Banner tone="warn">
            {department.lead?.name} has been deactivated. Choose a new lead.
          </Banner>
        )}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          maxLength={120}
          autoComplete="off"
          data-autofocus
        />
        <Textarea
          label="Description"
          optional
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={2}
        />
        <AssigneePicker
          label="Lead"
          noneLabel="No lead"
          value={lead}
          onChange={setLead}
          error={leadError}
        />
      </form>

      {department && (
        <>
          <Positions department={department} onChanged={onChanged} />

          <section className="mt-6">
            {department.isArchived ? (
              <Button
                variant="secondary"
                isLoading={isArchiving}
                onClick={() => setArchived(false)}
              >
                Restore department
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setIsConfirming(true)}>
                Archive department
              </Button>
            )}
          </section>

          <ConfirmDialog
            isOpen={isConfirming}
            title="Archive department?"
            description={`${department.name} won't be offered for anyone new. ${people(department.memberCount)} in it will keep it. You can restore it later.`}
            confirmLabel="Archive"
            isLoading={isArchiving}
            onConfirm={() => setArchived(true)}
            onClose={() => setIsConfirming(false)}
          />
        </>
      )}
    </SidePanel>
  );
};
