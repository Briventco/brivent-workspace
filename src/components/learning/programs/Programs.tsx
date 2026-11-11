import React, { useState } from 'react';
import { listCohorts } from '../../../api/learning';
import { Track } from '../../../api/types';
import { useSession } from '../../../context/AuthContext';
import { formatDay } from '../../../lib/learning';
import { Link, navigate } from '../../../lib/router';
import { useApiQuery } from '../../../lib/useApiQuery';
import { AsyncState } from '../../ui/AsyncState';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ProgramForm, QuickSetupModal } from './ProgramForms';

/** Programs you run, mentor or are in. */
export const Programs: React.FC = () => {
  const { can } = useSession();
  const query = useApiQuery((signal) => listCohorts(signal), [], 'learning:cohorts');
  const [isCreating, setIsCreating] = useState(false);
  const [isQuickSetup, setIsQuickSetup] = useState(false);
  const [newTrack, setNewTrack] = useState<Track | undefined>();
  const canRun = can('createTrack');

  return (
    <>
      {canRun && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button icon="add" onClick={() => setIsCreating(true)}>
            New program
          </Button>
          <Button variant="secondary" onClick={() => setIsQuickSetup(true)}>
            Learn then build
          </Button>
        </div>
      )}
      <AsyncState
        query={query}
        loadingLabel="Loading programs…"
        errorTitle="Couldn't load programs"
        isEmpty={(list) => list.length === 0}
        empty={
          <EmptyState
            icon="groups"
            title="No programs yet"
            description={canRun ? 'A program runs one track for a group, alone or as a team.' : "Programs you're in show up here."}
          />
        }
      >
        {(list) => (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Programs">
            {list.map((cohort) => {
              const done = cohort.learners.filter(({ progress }) => progress.health === 'COMPLETED').length;
              const behind = cohort.learners.filter(({ progress }) => progress.health === 'BEHIND').length;
              return (
                <li key={cohort.id}>
                  <Link to={`/learning/programs/${cohort.id}`} className="card card-pad block text-text hover:no-underline">
                    <h2 className="t-h3 line-clamp-2">{cohort.name}</h2>
                    <p className="text-small text-text-2 truncate">{cohort.track.title}</p>
                    <p className="mt-3 text-small text-text-2">
                      {cohort.learners.length} {cohort.learners.length === 1 ? 'learner' : 'learners'} ·{' '}
                      {cohort.submissionMode === 'TEAM' ? 'Team build' : 'Individual builds'} · From{' '}
                      {formatDay(cohort.startDate)}
                    </p>
                    <p className="mt-1 text-small">
                      {done} done{behind > 0 && <span className="overdue"> · {behind} behind</span>}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncState>

      {isQuickSetup && (
        <QuickSetupModal
          onClose={() => setIsQuickSetup(false)}
          onCreated={(track) => {
            setIsQuickSetup(false);
            setNewTrack(track);
            setIsCreating(true);
          }}
        />
      )}
      {isCreating && (
        <ProgramForm
          track={newTrack}
          onClose={() => setIsCreating(false)}
          onCreated={(cohort) => {
            setIsCreating(false);
            navigate(`/learning/programs/${cohort.id}`);
          }}
        />
      )}
    </>
  );
};
