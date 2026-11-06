import { request } from './client';
import { Project, ProjectStatus } from './types';

const MAX_LIMIT = 100;

export interface NewProject {
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  dueDate?: string;
  memberIds: string[];
}

export interface ProjectChanges {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  dueDate?: string | null;
  ownerId?: string;
}

/** Everything this person can see. The tabs and search work on the whole list. */
export async function listAllProjects(signal?: AbortSignal): Promise<Project[]> {
  const projects: Project[] = [];
  for (let page = 1; ; page += 1) {
    const data = await request<{ projects: Project[]; total: number }>(
      `/projects?page=${page}&limit=${MAX_LIMIT}`,
      { signal },
    );
    projects.push(...data.projects);
    if (data.projects.length === 0 || projects.length >= data.total) return projects;
  }
}

export async function getProject(id: string, signal?: AbortSignal): Promise<Project> {
  const data = await request<{ project: Project }>(`/projects/${id}`, { signal });
  return data.project;
}

export async function createProject(project: NewProject): Promise<Project> {
  const data = await request<{ project: Project }>('/projects', { method: 'POST', body: project });
  return data.project;
}

export async function updateProject(id: string, changes: ProjectChanges): Promise<Project> {
  const data = await request<{ project: Project }>(`/projects/${id}`, {
    method: 'PATCH',
    body: changes,
  });
  return data.project;
}

export async function addProjectMembers(id: string, userIds: string[]): Promise<Project> {
  const data = await request<{ project: Project }>(`/projects/${id}/members`, {
    method: 'POST',
    body: { userIds },
  });
  return data.project;
}

export async function removeProjectMember(id: string, userId: string): Promise<void> {
  await request<null>(`/projects/${id}/members/${userId}`, { method: 'DELETE' });
}
