import React, { useMemo, useState } from 'react';
import { DirectoryUser, Role, ROLE_LABELS, ROLES } from '../api/types';
import { listDirectory } from '../api/users';
import { AsyncState } from '../components/ui/AsyncState';
import { Avatar } from '../components/ui/Avatar';
import { RoleBadge } from '../components/ui/badges';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Input';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { useApiQuery } from '../lib/useApiQuery';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const ROLE_FILTER = [
  { value: '', label: 'All roles' },
  ...ROLES.map((value) => ({ value, label: ROLE_LABELS[value] })),
];

export const DirectoryView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const debouncedSearch = useDebouncedValue(search.trim());

  const query = useApiQuery<DirectoryUser[]>(
    (signal) => listDirectory(debouncedSearch, signal),
    [debouncedSearch],
  );

  const people = useMemo(
    () => (query.data ?? []).filter((person) => !role || person.role === role),
    [query.data, role],
  );

  return (
    <>
      <PageHeader title="Team Directory" description="Everyone currently working at Brivent." />

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,20rem)_12rem]">
        <Input
          label="Search by name"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        <Select
          label="Role"
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
              debouncedSearch || role
                ? 'Try a different name or role.'
                : 'People will appear here once they join the workspace.'
            }
          />
        }
      >
        {() => (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {people.map((person) => (
              <li key={person.id} className="card card-pad flex items-center gap-3">
                <Avatar name={person.name} id={person.id} size="lg" />
                <div className="min-w-0 grow">
                  <p className="font-semibold truncate">{person.name}</p>
                  <div className="mt-1">
                    <RoleBadge role={person.role} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncState>
    </>
  );
};
