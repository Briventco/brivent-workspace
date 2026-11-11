import React, { useState } from 'react';
import { listAllProjects } from '../api/projects';
import { Project, PROJECT_STATUS_LABELS, PROJECT_STATUSES, ProjectStatus } from '../api/types';
import { ProjectFormPanel } from '../components/projects/ProjectFormPanel';
import { percentDone, ProjectTile } from '../components/projects/ProjectParts';
import { AsyncState } from '../components/ui/AsyncState';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Tabs } from '../components/ui/Tabs';
import { useSession } from '../context/AuthContext';
import { Link, navigate } from '../lib/router';
import { useApiQuery } from '../lib/useApiQuery';
import { formatMonthDay, watDayStart } from '../lib/wat';

const MAX_AVATARS = 4;

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
  const { progress, members } = project;
  return (
    <Link to={`/projects/${project.id}`} className="card card-pad block text-text hover:no-underline">
      <div className="flex items-center gap-3 min-w-0">
        <ProjectTile project={project} />
        <div className="min-w-0">
          <h2 className="t-h3 truncate">{project.name}</h2>
          {project.description && (
            <p className="text-small text-text-2 truncate">{project.description}</p>
          )}
        </div>
      </div>
      <div className="mt-4 mb-1.5 flex justify-between text-small">
        <span className="text-text-2">
          {progress.done} of {progress.total} tasks done
        </span>
        <span className="font-semibold">{percentDone(project)}%</span>
      </div>
      <div className="bar">
        <i style={{ width: `${percentDone(project)}%` }} />
      </div>
      <div className="mt-4 flex items-center gap-3 text-small text-text-2">
        <span className="av-stack grow" aria-label={`${members.length} members`}>
          {members.slice(0, MAX_AVATARS).map((member) => (
            <Avatar key={member.id} name={member.name} id={member.id} avatar={member.avatar} size="sm" />
          ))}
          {members.length > MAX_AVATARS && (
            <span className="ml-2">+{members.length - MAX_AVATARS}</span>
          )}
        </span>
        {progress.overdue > 0 && (
          <span className="overdue">
            <Icon name="schedule" size="sm" />
            {progress.overdue} overdue
          </span>
        )}
        {project.dueDate && (
          <span className="inline-flex items-center gap-1">
            <Icon name="flag" size="sm" />
            {formatMonthDay(watDayStart(project.dueDate))}
          </span>
        )}
      </div>
    </Link>
  );
};

export const ProjectsView: React.FC = () => {
  const { can } = useSession();
  const canCreate = can('createProject');
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE');
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const query = useApiQuery((signal) => listAllProjects(signal), [], 'projects');
  const projects = query.data ?? [];
  const term = search.trim().toLowerCase();
  const shown = projects.filter(
    (project) =>
      project.status === status &&
      (!term ||
        project.name.toLowerCase().includes(term) ||
        project.description?.toLowerCase().includes(term)),
  );

  const newProject = canCreate && (
    <Button icon="add" onClick={() => setIsCreating(true)}>
      New project
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Projects"
        description="Group related tasks and the people working on them."
        actions={newProject}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs<ProjectStatus>
          label="Project status"
          tabs={PROJECT_STATUSES.map((value) => ({
            value,
            label: PROJECT_STATUS_LABELS[value],
            count: projects.filter((project) => project.status === value).length,
          }))}
          value={status}
          onChange={setStatus}
        />
        <div className="w-full sm:w-64">
          <Input
            label="Search projects"
            hideLabel
            icon="search"
            placeholder="Search projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <AsyncState
        query={query}
        loadingLabel="Loading projects…"
        errorTitle="Couldn't load projects"
        isEmpty={() => shown.length === 0}
        empty={
          term ? (
            <EmptyState
              icon="search"
              title="No projects match"
              description="Try another name, or clear the search."
            >
              <Button variant="secondary" onClick={() => setSearch('')}>
                Clear search
              </Button>
            </EmptyState>
          ) : projects.length > 0 ? (
            <EmptyState
              icon="folder_open"
              title={`No ${PROJECT_STATUS_LABELS[status].toLowerCase()} projects`}
              description="Projects with this status will show up here."
            />
          ) : (
            <EmptyState
              icon="folder_open"
              title="No projects yet"
              description={
                canCreate
                  ? 'Create one to group related tasks.'
                  : "You'll see projects here once you're added to one."
              }
            >
              {newProject}
            </EmptyState>
          )
        }
      >
        {() => (
          <div className="grid gap-4 md:grid-cols-2">
            {shown.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </AsyncState>

      {isCreating && (
        <ProjectFormPanel
          onClose={() => setIsCreating(false)}
          onSaved={(project) => navigate(`/projects/${project.id}`)}
        />
      )}
    </>
  );
};
