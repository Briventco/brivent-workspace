import React, { useMemo, useState } from 'react';
import { listDepartments } from '../api/departments';
import { errorMessage } from '../api/client';
import { startDm } from '../api/messages';
import { DirectoryUser, Role, ROLE_LABELS, ROLES } from '../api/types';
import { listDirectory } from '../api/users';
import { AsyncState } from '../components/ui/AsyncState';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { personTitle } from '../lib/people';
import { navigate } from '../lib/router';
import { useApiQuery } from '../lib/useApiQuery';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const ROLE_FILTER = [
  { value: '', label: 'All access levels' },
  ...ROLES.map((value) => ({ value, label: ROLE_LABELS[value] })),
];

interface Group {
  name: string;
  people: DirectoryUser[];
}

/** Departments by name, with anyone not yet placed at the end. */
function groupByDepartment(people: DirectoryUser[]): Group[] {
  const groups = new Map<string, Group>();
  for (const person of people) {
    const name = person.department?.name ?? '';
    const group = groups.get(name) ?? { name, people: [] };
    group.people.push(person);
    groups.set(name, group);
  }
  return [...groups.values()].sort((a, b) =>
    !a.name || !b.name ? Number(!a.name) - Number(!b.name) : a.name.localeCompare(b.name),
  );
}

export const DirectoryView: React.FC = () => {
  const { user, can } = useSession();
  const toast = useToast();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useApiQuery<DirectoryUser[]>(
    (signal) => listDirectory(debouncedSearch, department, signal),
    [debouncedSearch, department],
    'directory',
  );
  const departments = useApiQuery((signal) => listDepartments(signal), [], 'departments');
  const departmentFilter = [
    { value: '', label: 'All departments' },
    ...(departments.data ?? []).map(({ id, name }) => ({ value: id, label: name })),
  ];

  const people = useMemo(
    () => (query.data ?? []).filter((person) => !role || person.role === role),
    [query.data, role],
  );

  const groups = useMemo(() => groupByDepartment(people), [people]);

  const message = async (person: DirectoryUser) => {
    setOpeningId(person.id);
    try {
      const { id } = await startDm(person.id);
      navigate(`/messages/${id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setOpeningId(null);
    }
  };

  return (
    <>
      <PageHeader title="Team Directory" description="Everyone currently working at Brivent." />

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,20rem)_12rem_12rem]">
        <Input
          label="Search by name"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        <Select
          label="Department"
          value={department}
          options={departmentFilter}
          onChange={(e) => setDepartment(e.target.value)}
        />
        <Select
          label="Access level"
          value={role}
          options={ROLE_FILTER}
          onChange={(e) => setRole(e.target.value as Role | '')}
        />
      </div>

      <AsyncState
        query={query}
        loadingLabel="Loading the directory…"
        isEmpty={() => people.length === 0}
        empty={
          <EmptyState
            icon="groups"
            title="Nobody found"
            description={
              debouncedSearch || department || role
                ? 'Try a different name or filter.'
                : 'People will appear here once they join the workspace.'
            }
          />
        }
      >
        {() => (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.name} aria-label={group.name || 'No department'}>
                <h2 className="t-over text-text-2 mb-2">
                  {group.name || 'No department'} · {group.people.length}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.people.map((person) => (
                    <li key={person.id} className="card card-pad flex items-center gap-3">
                      <Avatar name={person.name} id={person.id} avatar={person.avatar} size="lg" />
                      <div className="min-w-0 grow">
                        <p className="font-semibold truncate">{person.name}</p>
                        <p className="text-small text-text-2 truncate">{personTitle(person)}</p>
                      </div>
                      {can('useMessages') && person.id !== user.id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => message(person)}
                          isLoading={openingId === person.id}
                          aria-label={`Message ${person.name}`}
                        >
                          Message
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </AsyncState>
    </>
  );
};
