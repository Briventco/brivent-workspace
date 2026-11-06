import React, { useEffect } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { listDepartments } from '../../api/departments';
import { User } from '../../api/types';
import { PlacementIds } from '../../api/users';
import { useApiQuery } from '../../lib/useApiQuery';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';

/** The form's values, where an empty string means none. */
export interface PlacementValue {
  departmentId: string;
  positionId: string;
}

export interface PlacementErrors {
  department?: string;
  position?: string;
}

export const NO_PLACEMENT: PlacementValue = { departmentId: '', positionId: '' };

export const placementOf = (user: User): PlacementValue => ({
  departmentId: user.department?.id ?? '',
  positionId: user.position?.id ?? '',
});

export const toPlacementIds = ({ departmentId, positionId }: PlacementValue): PlacementIds => ({
  departmentId: departmentId || null,
  positionId: positionId || null,
});

/** The placement errors the API can return, or null for anything else. */
export function placementErrors(error: unknown): PlacementErrors | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code.startsWith('DEPARTMENT_')) return { department: errorMessage(error) };
  if (error.code.startsWith('POSITION_')) return { position: errorMessage(error) };
  return null;
}

interface PlacementFieldsProps {
  value: PlacementValue;
  onChange: (value: PlacementValue) => void;
  errors?: PlacementErrors;
  /** Bumped by the parent to re-read the options, such as after one was archived. */
  refreshKey?: number;
  /** Who's being edited. They keep an archived option, which the API no longer lists. */
  user?: Pick<User, 'department' | 'position'>;
}

export const PlacementFields: React.FC<PlacementFieldsProps> = ({
  value,
  onChange,
  errors,
  refreshKey = 0,
  user,
}) => {
  const query = useApiQuery((signal) => listDepartments(signal), [refreshKey]);
  const isLoaded = query.data !== undefined;
  const departments = query.data ?? [];
  const chosen = departments.find(({ id }) => id === value.departmentId);
  const label = (name: string) => (isLoaded ? `${name} (archived)` : name);

  const departmentOptions = [
    { value: '', label: 'No department' },
    ...departments.map(({ id, name }) => ({ value: id, label: name })),
  ];
  if (user?.department && !departments.some(({ id }) => id === user.department?.id)) {
    departmentOptions.push({ value: user.department.id, label: label(user.department.name) });
  }

  const positionOptions = [
    { value: '', label: 'No position' },
    ...(chosen?.positions ?? []).map(({ id, name }) => ({ value: id, label: name })),
  ];
  if (
    user?.position &&
    value.departmentId === user.department?.id &&
    !positionOptions.some((option) => option.value === user.position?.id)
  ) {
    positionOptions.push({ value: user.position.id, label: label(user.position.name) });
  }

  // A choice can be archived while the form is open. Don't keep a value the list can't show.
  useEffect(() => {
    if (!isLoaded) return;
    if (!departmentOptions.some((option) => option.value === value.departmentId)) {
      onChange(NO_PLACEMENT);
    } else if (!positionOptions.some((option) => option.value === value.positionId)) {
      onChange({ ...value, positionId: '' });
    }
    // Only a fresh list can make the current value unavailable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  return (
    <>
      <Select
        label="Department"
        optional
        value={value.departmentId}
        options={departmentOptions}
        disabled={!isLoaded}
        error={errors?.department ?? (query.error ? "Couldn't load departments." : undefined)}
        // The old position belongs to the old department, and the API refuses that pairing.
        onChange={(e) => onChange({ departmentId: e.target.value, positionId: '' })}
      />
      {query.error != null && (
        <Button variant="ghost" size="sm" onClick={query.reload}>
          Try again
        </Button>
      )}
      <Select
        label="Position"
        optional
        value={value.positionId}
        options={positionOptions}
        disabled={!isLoaded || !value.departmentId}
        error={errors?.position}
        helperText={isLoaded && !value.departmentId ? 'Choose a department first.' : undefined}
        onChange={(e) => onChange({ ...value, positionId: e.target.value })}
      />
    </>
  );
};
