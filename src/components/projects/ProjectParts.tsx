import React from 'react';
import { Project, PROJECT_STATUS_LABELS, ProjectStatus } from '../../api/types';
import { tintFor } from '../ui/Avatar';
import { Icon, IconName } from '../ui/Icon';

const STATUS: Record<ProjectStatus, { className: string; icon: IconName; filled?: boolean }> = {
  ACTIVE: { className: 'st-prog', icon: 'play_circle' },
  ON_HOLD: { className: 'st-todo', icon: 'hourglass_top' },
  COMPLETED: { className: 'st-done', icon: 'check_circle', filled: true },
};

export const ProjectStatusBadge: React.FC<{ status: ProjectStatus }> = ({ status }) => {
  const { className, icon, filled } = STATUS[status];
  return (
    <span className={`badge ${className}`}>
      <Icon name={icon} size="sm" filled={filled} />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
};

export const ProjectTile: React.FC<{ project: Project; large?: boolean }> = ({ project, large }) => (
  <span
    aria-hidden="true"
    className={`av a${tintFor(project.id)} project-tile ${large ? 'is-large' : ''}`}
  >
    {project.name.trim().charAt(0).toUpperCase()}
  </span>
);

export const percentDone = ({ progress }: Project) =>
  progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

/** Who can edit it and manage its people. Team Leads only on projects they own. */
export function canManageProject(
  project: Project,
  userId: string,
  can: (action: 'manageAllProjects' | 'updateOwnProject') => boolean,
): boolean {
  return can('manageAllProjects') || (can('updateOwnProject') && project.owner.id === userId);
}
