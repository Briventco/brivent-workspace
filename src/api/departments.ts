import { request } from './client';
import { Named } from './types';

export interface Position extends Named {
  departmentId: string;
  isArchived: boolean;
  memberCount: number;
}

export interface Department extends Named {
  description: string | null;
  lead: Named | null;
  /** null with no lead. false means the lead was deactivated and needs replacing. */
  leadIsActive: boolean | null;
  memberCount: number;
  positions: Position[];
  isArchived: boolean;
}

export interface DepartmentInput {
  name: string;
  description: string | null;
  leadId: string | null;
}

/** Archived departments and positions only come back for people who can manage them. */
export async function listDepartments(
  signal?: AbortSignal,
  { includeArchived = false } = {},
): Promise<Department[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  const data = await request<{ departments: Department[] }>(`/departments${query}`, { signal });
  return data.departments;
}

export async function createDepartment(input: DepartmentInput): Promise<Department> {
  const data = await request<{ department: Department }>('/departments', {
    method: 'POST',
    body: input,
  });
  return data.department;
}

export async function updateDepartment(
  id: string,
  changes: Partial<DepartmentInput> & { isArchived?: boolean },
): Promise<Department> {
  const data = await request<{ department: Department }>(`/departments/${id}`, {
    method: 'PATCH',
    body: changes,
  });
  return data.department;
}

export async function createPosition(departmentId: string, name: string): Promise<Position> {
  const data = await request<{ position: Position }>(`/departments/${departmentId}/positions`, {
    method: 'POST',
    body: { name },
  });
  return data.position;
}

export async function setPositionArchived(id: string, isArchived: boolean): Promise<Position> {
  const data = await request<{ position: Position }>(`/positions/${id}`, {
    method: 'PATCH',
    body: { isArchived },
  });
  return data.position;
}
