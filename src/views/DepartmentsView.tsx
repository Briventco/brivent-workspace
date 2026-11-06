import React, { useState } from 'react';
import { Department, listDepartments } from '../api/departments';
import { DepartmentPanel } from '../components/departments/DepartmentPanel';
import { AsyncState } from '../components/ui/AsyncState';
import { Avatar } from '../components/ui/Avatar';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Switch } from '../components/ui/Switch';
import { useApiQuery } from '../lib/useApiQuery';

const count = (value: number, word: string) => `${value} ${word}${value === 1 ? '' : 's'}`;

const DepartmentCard: React.FC<{ department: Department; onEdit: () => void }> = ({
  department,
  onEdit,
}) => {
  const { name, description, lead, leadIsActive, memberCount, isArchived } = department;
  const positions = department.positions.filter((position) => !position.isArchived);

  return (
    <li className="card card-pad flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 grow">
          <h2 className="t-h3 break-words">{name}</h2>
          {isArchived && <span className="text-small text-text-2">Archived</span>}
        </div>
        <Button variant="ghost" size="sm" icon="edit" onClick={onEdit} aria-label={`Edit ${name}`}>
          Edit
        </Button>
      </div>
      {description && <p className="text-text-2 break-words">{description}</p>}
      <p className="flex items-center gap-2 min-w-0">
        {lead ? (
          <>
            <Avatar name={lead.name} id={lead.id} size="sm" />
            <span className="truncate">{lead.name}</span>
            <span className="text-small text-text-2 shrink-0">Lead</span>
          </>
        ) : (
          <span className="text-text-2">No lead</span>
        )}
      </p>
      {leadIsActive === false && (
        <Banner tone="warn">{lead?.name} has been deactivated. Choose a new lead.</Banner>
      )}
      <p className="text-small text-text-2">
        {count(memberCount, 'member')} · {count(positions.length, 'position')}
      </p>
      {positions.length > 0 && (
        <p className="text-small text-text-2 break-words">
          {positions.map((position) => position.name).join(', ')}
        </p>
      )}
    </li>
  );
};

type PanelState = { mode: 'new' } | { mode: 'edit'; department: Department };

export const DepartmentsView: React.FC = () => {
  const query = useApiQuery(
    (signal) => listDepartments(signal, { includeArchived: true }),
    [],
  );
  const [showArchived, setShowArchived] = useState(false);
  const [panel, setPanel] = useState<PanelState | null>(null);

  const all = query.data ?? [];
  const archivedCount = all.filter((department) => department.isArchived).length;
  const shown = all.filter((department) => showArchived || !department.isArchived);
  // Fresh from the list where it can be, so counts update while the panel stays open.
  const editing =
    panel?.mode === 'edit'
      ? (all.find(({ id }) => id === panel.department.id) ?? panel.department)
      : null;

  return (
    <>
      <PageHeader
        title="Departments"
        description="What people do at Brivent. This never changes what they can access."
        actions={
          <Button icon="add" onClick={() => setPanel({ mode: 'new' })}>
            Add department
          </Button>
        }
      />

      {archivedCount > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Switch label="Show archived" checked={showArchived} onChange={setShowArchived} />
          <span aria-hidden="true">Show archived · {archivedCount}</span>
        </div>
      )}

      <AsyncState
        query={query}
        loadingLabel="Loading departments…"
        isEmpty={() => shown.length === 0}
        empty={
          <EmptyState
            icon="badge"
            title="No departments yet"
            description="Add a department, then give it positions."
          />
        }
      >
        {() => (
          <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 items-start">
            {shown.map((department) => (
              <DepartmentCard
                key={department.id}
                department={department}
                onEdit={() => setPanel({ mode: 'edit', department })}
              />
            ))}
          </ul>
        )}
      </AsyncState>

      {panel && (
        <DepartmentPanel
          key={editing?.id ?? 'new'}
          department={editing}
          onClose={() => setPanel(null)}
          onCreated={(department) => {
            setPanel({ mode: 'edit', department });
            query.reload();
          }}
          onChanged={query.reload}
        />
      )}
    </>
  );
};
