import React, { useMemo, useState } from 'react';
import { ApiError, errorMessage } from '../api/client';
import { addProjectMembers, getProject, removeProjectMember } from '../api/projects';
import { listEveryTask, listOpenTasks } from '../api/tasks';
import { Project, ROLE_LABELS, Task } from '../api/types';
import { TaskRow } from '../components/dashboard/TaskRow';
import { ProjectFormPanel } from '../components/projects/ProjectFormPanel';
import {
  canManageProject,
  percentDone,
  ProjectStatusBadge,
  ProjectTile,
} from '../components/projects/ProjectParts';
import { AssigneePicker } from '../components/tasks/AssigneePicker';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { AsyncState, ErrorState, LoadingState, NoAccess } from '../components/ui/AsyncState';
import { Avatar } from '../components/ui/Avatar';
import { Button, IconButton } from '../components/ui/Button';
import { Card, CardBody, CardHeader, StatCard } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Icon } from '../components/ui/Icon';
import { Select } from '../components/ui/Select';
import { Tabs } from '../components/ui/Tabs';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Link, navigate } from '../lib/router';
import { ApiQuery, useApiQuery } from '../lib/useApiQuery';
import { daysBetween, formatDayMonth, formatShortDate, watDayStart, weekStart } from '../lib/wat';

const VISIBLE_TASKS = 8;

const day = (date: string) => watDayStart(date);

function dateRange({ startDate, dueDate }: Project): string | null {
  if (startDate && dueDate) {
    return `${formatDayMonth(day(startDate), false)} to ${formatDayMonth(day(dueDate))}`;
  }
  if (dueDate) return `Target ${formatDayMonth(day(dueDate))}`;
  return startDate ? `Started ${formatDayMonth(day(startDate))}` : null;
}

function targetHint(project: Project): string {
  if (!project.dueDate) return 'Since Monday';
  const days = daysBetween(new Date(), day(project.dueDate));
  if (days < 0) return 'Target date has passed';
  if (days < 7) return `Target in ${days} ${days === 1 ? 'day' : 'days'}`;
  const weeks = Math.round(days / 7);
  return `Target in ${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
}

interface TasksCardProps {
  project: Project;
  query: ApiQuery<{ open: Task[]; done: Task[] }>;
  canCreate: boolean;
  onNewTask: () => void;
}

const TasksCard: React.FC<TasksCardProps> = ({ project, query, canCreate, onNewTask }) => {
  const { can } = useSession();
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const [assignee, setAssignee] = useState('');
  const open = query.data?.open ?? [];
  const done = query.data?.done ?? [];
  const tasks = (tab === 'open' ? open : done).filter(
    (task) => !assignee || task.assigneeId === assignee,
  );
  // Members can't open everyone's list on the Tasks page, so they see them all here.
  const canSeeAll = can('viewAllTasks');
  const visible = canSeeAll ? tasks.slice(0, VISIBLE_TASKS) : tasks;

  const people = project.members.map(({ id, name }) => ({ value: id, label: name }));

  return (
    <Card>
      <div className="px-4 sm:px-5 pt-2 flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <Tabs<'open' | 'done'>
          label="Project tasks"
          tabs={[
            { value: 'open', label: 'Open tasks', count: open.length },
            { value: 'done', label: 'Done', count: done.length },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="w-40 pb-2">
          <Select
            label="Filter by assignee"
            hideLabel
            value={assignee}
            options={[{ value: '', label: 'Everyone' }, ...people]}
            onChange={(e) => setAssignee(e.target.value)}
          />
        </div>
      </div>
      <AsyncState
        query={query}
        loadingLabel="Loading tasks…"
        errorTitle="Couldn't load tasks"
        isEmpty={() => tasks.length === 0}
        empty={
          <div className="card-pad text-center text-text-2">
            <p className="mb-3">
              {assignee || tab === 'done' ? 'Nothing here.' : 'No tasks yet'}
            </p>
            {canCreate && tab === 'open' && !assignee && (
              <Button variant="secondary" icon="add" onClick={onNewTask}>
                New task
              </Button>
            )}
          </div>
        }
      >
        {() => (
          <>
            <ul className="divide-y divide-border">
              {visible.map((task) => (
                <TaskRow key={task.id} task={task} showAssignee />
              ))}
            </ul>
            {canSeeAll && tasks.length > visible.length && (
              <div className="card-foot">
                <Link
                  to={`/tasks?view=all&project=${project.id}${tab === 'open' ? '&preset=open' : '&status=DONE'}`}
                  className="font-semibold"
                >
                  See all {tasks.length} in Tasks
                </Link>
              </div>
            )}
          </>
        )}
      </AsyncState>
    </Card>
  );
};

const MembersCard: React.FC<{
  project: Project;
  openTasks: Task[];
  canManage: boolean;
  onChanged: () => void;
}> = ({ project, openTasks, canManage, onChanged }) => {
  const toast = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [removing, setRemoving] = useState<Project['members'][number] | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const openCount = (id: string) => openTasks.filter((task) => task.assigneeId === id).length;

  const add = async (id: string) => {
    setIsBusy(true);
    try {
      await addProjectMembers(project.id, [id]);
      setIsAdding(false);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setIsBusy(true);
    try {
      await removeProjectMember(project.id, removing.id);
      toast.success(`${removing.name} has been removed.`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsBusy(false);
      setRemoving(null);
    }
  };

  return (
    // Not a Card: the people picker's list has to overflow it.
    <section className="card">
      <CardHeader>
        <h2 className="t-h3 flex items-center gap-2">
          Members <span className="count">{project.members.length}</span>
        </h2>
        {canManage && (
          <Button variant="ghost" size="sm" icon="person_add" onClick={() => setIsAdding(!isAdding)}>
            Add
          </Button>
        )}
      </CardHeader>
      {isAdding && (
        <div className="p-4 border-b border-border">
          <AssigneePicker
            label="Add a member"
            allowNone={false}
            placeholder="Search by name"
            value={null}
            excludeIds={project.members.map((member) => member.id)}
            onChange={(person) => person && !isBusy && add(person.id)}
          />
        </div>
      )}
      <ul className="divide-y divide-border">
        {project.members.map((member) => {
          const isOwner = member.id === project.owner.id;
          return (
            <li key={member.id} className="li">
              <Avatar name={member.name} id={member.id} />
              <div className="min-w-0 grow">
                <p className="title truncate">{member.name}</p>
                <p className="text-small text-text-2">
                  {isOwner ? 'Owner · ' : ''}
                  {ROLE_LABELS[member.role]}
                  {!isOwner && ` · ${openCount(member.id)} open`}
                </p>
              </div>
              {canManage && !isOwner && (
                <IconButton
                  icon="person_off"
                  size="sm"
                  label={`Remove ${member.name}`}
                  onClick={() => setRemoving(member)}
                />
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        isOpen={removing !== null}
        title={`Remove ${removing?.name}?`}
        description="Their tasks stay in the project. They'll lose access unless a task is assigned to them."
        confirmLabel="Remove"
        confirmVariant="danger"
        isLoading={isBusy}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
};

const AboutCard: React.FC<{ project: Project }> = ({ project }) => (
  <Card>
    <CardHeader>
      <h2 className="t-h3">About</h2>
    </CardHeader>
    <CardBody className="space-y-3">
      {project.description && <p className="whitespace-pre-wrap break-words">{project.description}</p>}
      <dl className="grid grid-cols-[96px_1fr] gap-y-1.5 text-small">
        {project.startDate && (
          <>
            <dt className="text-text-2">Started</dt>
            <dd>{formatShortDate(day(project.startDate))}</dd>
          </>
        )}
        {project.dueDate && (
          <>
            <dt className="text-text-2">Target</dt>
            <dd>{formatShortDate(day(project.dueDate))}</dd>
          </>
        )}
        <dt className="text-text-2">Owner</dt>
        <dd>{project.owner.name}</dd>
      </dl>
    </CardBody>
  </Card>
);

const ProjectPage: React.FC<{ project: Project; onChanged: () => void }> = ({
  project,
  onChanged,
}) => {
  const { user, can } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const canManage = canManageProject(project, user.id, can);
  const canCreateTask = can('createTask') && project.status !== 'COMPLETED';

  const tasks = useApiQuery(
    async (signal) => {
      const filters = { projectId: project.id };
      const [open, done] = await Promise.all([
        listOpenTasks('all', filters, signal),
        listEveryTask('all', { ...filters, status: 'DONE' }, signal),
      ]);
      return { open, done };
    },
    [project.id, project.updatedAt],
  );

  const open = useMemo(() => tasks.data?.open ?? [], [tasks.data]);
  const since = weekStart().toISOString();
  const doneThisWeek = tasks.data?.done.filter(
    (task) => task.completedAt && task.completedAt >= since,
  ).length;
  const working = new Set(open.map((task) => task.assigneeId).filter(Boolean)).size;
  const blocked = open.filter((task) => task.status === 'BLOCKED').length;
  const range = dateRange(project);
  const list = `/tasks?view=all&project=${project.id}`;
  const linkIfManager = (to: string) => (can('viewAllTasks') ? to : undefined);

  return (
    <>
      <Link to="/projects" className="inline-flex items-center gap-1 font-semibold mb-3">
        <Icon name="arrow_back" size="sm" />
        Projects
      </Link>

      <div className="mb-5 flex flex-wrap items-start gap-4">
        <ProjectTile project={project} large />
        <div className="min-w-0 grow basis-64">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="t-h1 break-words">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <p className="text-text-2 break-words">
            Owner <span className="font-semibold text-text">{project.owner.name}</span>
            {range && ` · ${range}`}
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <Button variant="secondary" icon="edit" onClick={() => setIsEditing(true)}>
              Edit project
            </Button>
          )}
          {canCreateTask && (
            <Button icon="add" onClick={() => setIsCreatingTask(true)}>
              New task
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5">
        <StatCard
          label="Progress"
          value={`${percentDone(project)}%`}
          hint={
            <>
              <span className="bar block mb-1.5">
                <i style={{ width: `${percentDone(project)}%` }} />
              </span>
              {project.progress.done} of {project.progress.total} tasks done
            </>
          }
        />
        <StatCard
          label="Open"
          icon="radio_button_unchecked"
          value={project.progress.total - project.progress.done}
          hint={`${working} ${working === 1 ? 'person' : 'people'} working`}
          to={linkIfManager(`${list}&preset=open`)}
        />
        <StatCard
          label="Overdue"
          icon="schedule"
          value={project.progress.overdue}
          hint={`${blocked} blocked`}
          attention={project.progress.overdue > 0}
          to={linkIfManager(`${list}&overdue=true`)}
        />
        <StatCard
          label="Done this week"
          icon="check_circle"
          value={doneThisWeek ?? '–'}
          hint={targetHint(project)}
          to={linkIfManager(`${list}&preset=doneThisWeek`)}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="min-w-0">
          <TasksCard
            project={project}
            query={tasks}
            canCreate={canCreateTask}
            onNewTask={() => setIsCreatingTask(true)}
          />
        </div>
        <div className="space-y-5 min-w-0">
          <MembersCard
            project={project}
            openTasks={open}
            canManage={canManage}
            onChanged={onChanged}
          />
          <AboutCard project={project} />
        </div>
      </div>

      {isEditing && (
        <ProjectFormPanel
          project={project}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            onChanged();
          }}
        />
      )}

      {isCreatingTask && (
        <TaskFormModal
          prefill={{ projectId: project.id }}
          onClose={() => setIsCreatingTask(false)}
          onSaved={(task) => navigate(`/tasks/${task.id}`)}
        />
      )}
    </>
  );
};

export const ProjectDetailView: React.FC<{ projectId: string }> = ({ projectId }) => {
  const query = useApiQuery((signal) => getProject(projectId, signal), [projectId]);

  if (query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 400)) {
    return (
      <NoAccess
        title="You're not on this project"
        description="Only members and managers can open it. Ask the owner to add you."
        backTo="/projects"
        backLabel="All projects"
      />
    );
  }
  if (query.error instanceof ApiError && query.error.isForbidden) return <NoAccess />;
  if (query.error) {
    return (
      <ErrorState
        title="Couldn't load this project"
        message="Something went wrong. Your projects are safe."
        onRetry={query.reload}
      />
    );
  }
  if (!query.data) return <LoadingState label="Loading the project…" />;
  return <ProjectPage project={query.data} onChanged={query.reload} />;
};
