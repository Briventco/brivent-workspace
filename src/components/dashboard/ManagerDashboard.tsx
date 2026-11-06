import React, { useMemo } from 'react';
import { getTeamCheckins } from '../../api/checkins';
import { listOpenTasks } from '../../api/tasks';
import { PersonRef, Task, TaskSummary, User } from '../../api/types';
import { listUsersWithoutDepartment } from '../../api/users';
import { useSession } from '../../context/AuthContext';
import { nameAndTitle, personTitle } from '../../lib/people';
import { Link } from '../../lib/router';
import { ApiQuery, useApiQuery } from '../../lib/useApiQuery';
import { isWeekend } from '../../lib/wat';
import { AsyncState } from '../ui/AsyncState';
import { AssigneeStack } from '../tasks/AssigneeStack';
import { Banner } from '../ui/Banner';
import { PriorityBadge, StatusBadge } from '../ui/badges';
import { Card, CardHeader, StatCard } from '../ui/Card';
import { Table } from '../ui/Table';
import { DashboardGreeting } from './DashboardGreeting';
import { MeetingsCard } from './MeetingsCard';
import { BlockersCard, NotCheckedInCard } from './TeamCheckinCards';
import { daysLate, TaskRow } from './TaskRow';
import { LearningCard } from './LearningCard';
import { UnreadMessagesLink } from './UnreadMessagesLink';

const TASKS = '/tasks?view=all';
const KPI_COLUMNS: Record<number, string> = { 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5' };

const sortByDeadline = (tasks: Task[]) =>
  [...tasks].sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''));

const OverdueCard: React.FC<{ query: ApiQuery<Task[]> }> = ({ query }) => {
  const overdue = sortByDeadline((query.data ?? []).filter((task) => task.isOverdue));

  return (
    <Card>
      <CardHeader>
        <h2 className="t-h3 flex items-center gap-2">
          Overdue across the team <span className="count alert">{overdue.length}</span>
        </h2>
        <Link to={`${TASKS}&overdue=true`} className="font-semibold">
          View in Tasks
        </Link>
      </CardHeader>
      <AsyncState
        query={query}
        errorTitle="Couldn't load tasks"
        isEmpty={() => overdue.length === 0}
        empty={<p className="card-pad text-text-2">Nothing overdue. Good work, team.</p>}
      >
        {() => (
          <>
            <ul className="md:hidden divide-y divide-border">
              {overdue.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
            <div className="hidden md:block">
              <Table caption="Overdue tasks">
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">Assignee</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Late by
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((task) => {
                    const days = daysLate(task);
                    return (
                      <tr key={task.id}>
                        <td>
                          <Link to={`/tasks/${task.id}`} className="font-semibold text-text">
                            {task.title}
                          </Link>
                          {task.project && (
                            <span className="block text-small text-text-2">{task.project.name}</span>
                          )}
                        </td>
                        <td>
                          <AssigneeStack people={task.assignees} showDetail />
                        </td>
                        <td>
                          <PriorityBadge priority={task.priority} />
                        </td>
                        <td>
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="text-right text-danger font-semibold whitespace-nowrap">
                          {days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : 'Today'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </AsyncState>
    </Card>
  );
};

interface Workload extends PersonRef {
  open: number;
  overdue: number;
}

function toWorkload(tasks: Task[]): Workload[] {
  const people = new Map<string, Workload>();
  for (const task of tasks) {
    // A shared task is open work for everyone on it.
    for (const assignee of task.assignees) {
      const person = people.get(assignee.id) ?? { ...assignee, open: 0, overdue: 0 };
      person.open += 1;
      if (task.isOverdue) person.overdue += 1;
      people.set(assignee.id, person);
    }
  }
  return [...people.values()].sort((a, b) => b.open - a.open);
}

const WorkloadCard: React.FC<{ query: ApiQuery<Task[]> }> = ({ query }) => {
  const workload = useMemo(() => toWorkload(query.data ?? []), [query.data]);
  const busiest = workload[0]?.open ?? 1;

  return (
    <Card>
      <CardHeader>
        <h2 className="t-h3">Open work by person</h2>
        <span className="text-small text-text-2">Overdue in red</span>
      </CardHeader>
      <AsyncState
        query={query}
        errorTitle="Couldn't load tasks"
        isEmpty={() => workload.length === 0}
        empty={<p className="card-pad text-text-2">No open work assigned to anyone.</p>}
      >
        {() => (
          <ul className="card-pad space-y-3">
            {workload.map((person) => (
              <li key={person.id}>
                <Link
                  to={`${TASKS}&preset=open&assignee=${person.id}&name=${encodeURIComponent(person.name)}`}
                  className="grid grid-cols-[minmax(0,1fr)_72px_24px] items-center gap-3 text-text hover:no-underline"
                >
                  <span className="truncate" title={nameAndTitle(person)}>
                    {person.name}
                    <span className="block text-small text-text-2 truncate">
                      {personTitle(person)}
                    </span>
                  </span>
                  <span className="workload" aria-hidden="true">
                    <i className="w-over" style={{ width: `${(person.overdue / busiest) * 100}%` }} />
                    <i
                      className="w-open"
                      style={{ width: `${((person.open - person.overdue) / busiest) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums font-semibold">{person.open}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AsyncState>
    </Card>
  );
};

const OwnTasksCard: React.FC = () => {
  const query = useApiQuery((signal) => listOpenTasks('mine', {}, signal), []);
  const tasks = sortByDeadline(query.data ?? []).slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <h2 className="t-h3">Your own tasks</h2>
        <Link to="/tasks" className="font-semibold">
          My tasks
        </Link>
      </CardHeader>
      <AsyncState
        query={query}
        errorTitle="Couldn't load tasks"
        isEmpty={() => tasks.length === 0}
        empty={<p className="card-pad text-text-2">Nothing assigned to you.</p>}
      >
        {() => (
          <ul className="divide-y divide-border compact-rows">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </AsyncState>
    </Card>
  );
};

/** Everyone starts without a department, so this shows until they've all been placed. */
const MissingDepartmentsPrompt: React.FC = () => {
  const { can } = useSession();
  const canPlace = can('manageDepartments') && can('viewUsers');
  const query = useApiQuery<User[]>(
    (signal) => (canPlace ? listUsersWithoutDepartment(signal) : Promise.resolve([])),
    [canPlace],
  );

  const count = query.data?.length ?? 0;
  if (count === 0) return null;

  return (
    <div className="mb-5">
      <Banner tone="info">
        {count === 1 ? '1 active person has' : `${count} active people have`} no department.{' '}
        <Link to="/users?department=none" className="font-semibold">
          Assign them
        </Link>
      </Banner>
    </div>
  );
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

interface ManagerDashboardProps {
  summary: TaskSummary;
  onChanged: () => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ summary, onChanged }) => {
  const openTasks = useApiQuery((signal) => listOpenTasks('all', {}, signal), []);
  const { teamCheckins, upcomingMeetings } = summary;
  const hasCheckins = teamCheckins !== undefined;

  const checkins = useApiQuery(
    (signal) =>
      hasCheckins
        ? getTeamCheckins({ blockersOnly: true }, signal)
        : Promise.resolve({ checkins: [], notCheckedIn: [] }),
    [hasCheckins],
  );

  const blocked = openTasks.data?.filter((task) => task.status === 'BLOCKED').length;
  const projectCount = new Set(openTasks.data?.map((task) => task.projectId).filter(Boolean)).size;
  const checkinTotal = teamCheckins ? teamCheckins.submitted + teamCheckins.notSubmitted : 0;
  const showMissing = hasCheckins && !isWeekend();

  const facts = [
    <Link key="overdue" to={`${TASKS}&overdue=true`} className="font-semibold text-danger">
      {plural(summary.overdue, 'overdue task')}
    </Link>,
    <Link key="blocked" to={`${TASKS}&status=BLOCKED`} className="font-semibold text-text">
      {plural(blocked ?? 0, 'blocker')}
    </Link>,
  ];
  if (showMissing) {
    facts.push(
      <Link key="missing" to="/daily?tab=team" className="font-semibold text-text">
        {teamCheckins.notSubmitted === 1 ? '1 person' : `${teamCheckins.notSubmitted} people`}
      </Link>,
    );
  }

  const stats = (
    <div
      className={`grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-5 ${KPI_COLUMNS[hasCheckins ? 5 : 4]}`}
    >
      <StatCard
        label="Open"
        icon="radio_button_unchecked"
        value={summary.open}
        hint={projectCount ? `Across ${plural(projectCount, 'project')}` : 'Across the team'}
        to={`${TASKS}&preset=open`}
        className="hidden md:flex"
      />
      <StatCard
        label="Overdue"
        icon="schedule"
        value={summary.overdue}
        hint="Past its deadline"
        attention={summary.overdue > 0}
        to={`${TASKS}&overdue=true`}
      />
      <StatCard
        label="Blocked"
        icon="block"
        value={blocked ?? '–'}
        hint={teamCheckins ? `${teamCheckins.openBlockers} in check-ins` : 'Waiting on someone'}
        to={`${TASKS}&status=BLOCKED`}
      />
      <StatCard
        label="Done this week"
        icon="check_circle"
        value={summary.doneThisWeek}
        hint="Since Monday"
        to={`${TASKS}&preset=doneThisWeek`}
      />
      {teamCheckins && (
        <StatCard
          label="Checked in today"
          icon="edit_note"
          value={
            <>
              {teamCheckins.submitted}
              <span className="text-h2 text-text-2"> / {checkinTotal}</span>
            </>
          }
          hint={
            <span className="bar block">
              <i
                style={{
                  width: `${checkinTotal ? (teamCheckins.submitted / checkinTotal) * 100 : 0}%`,
                }}
              />
            </span>
          }
          to="/daily?tab=team"
        />
      )}
    </div>
  );

  return (
    <>
      <DashboardGreeting>
        Your team has {facts[0]}
        {showMissing ? ', ' : ' and '}
        {facts[1]}
        {showMissing && <> and {facts[2]} still to check in</>}.
      </DashboardGreeting>

      <MissingDepartmentsPrompt />

      <UnreadMessagesLink summary={summary} />
      <LearningCard summary={summary} />

      {stats}

      {/* On phones the two columns flatten into one list, ordered as the design stacks them. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="contents xl:block xl:space-y-5 min-w-0">
          {hasCheckins && (
            <div className="order-1 min-w-0">
              <BlockersCard
                query={checkins}
                onChanged={() => {
                  checkins.reload();
                  onChanged();
                }}
              />
            </div>
          )}
          <div className="order-3 min-w-0">
            <OverdueCard query={openTasks} />
          </div>
        </div>
        <div className="contents xl:block xl:space-y-5 min-w-0">
          {showMissing && (
            <div className="order-2 min-w-0">
              <NotCheckedInCard query={checkins} />
            </div>
          )}
          {upcomingMeetings !== undefined && (
            <div className="order-4 min-w-0">
              <MeetingsCard />
            </div>
          )}
          <div className="order-5 min-w-0">
            <WorkloadCard query={openTasks} />
          </div>
          <div className="order-6 min-w-0">
            <OwnTasksCard />
          </div>
        </div>
      </div>
    </>
  );
};
