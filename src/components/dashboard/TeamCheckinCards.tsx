import React, { useState } from 'react';
import { setBlockerHandled, TeamCheckins } from '../../api/checkins';
import { errorMessage } from '../../api/client';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { personTitle } from '../../lib/people';
import { Link } from '../../lib/router';
import { ApiQuery } from '../../lib/useApiQuery';
import { formatTime } from '../../lib/wat';
import { AsyncState } from '../ui/AsyncState';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';

const REVIEW = '/daily?tab=team';

const Count: React.FC<{ value: number; alert?: boolean }> = ({ value, alert }) => (
  <span className={`count ${alert ? 'alert' : ''}`}>{value}</span>
);

export const BlockersCard: React.FC<{ query: ApiQuery<TeamCheckins>; onChanged: () => void }> = ({
  query,
  onChanged,
}) => {
  const { can } = useSession();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handle = async (id: string) => {
    setBusyId(id);
    try {
      await setBlockerHandled(id, true);
      toast.success('Blocker marked handled.');
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const open = (query.data?.checkins ?? []).filter((checkin) => !checkin.blockerHandled);

  return (
    <Card>
      <CardHeader>
        <h2 className="t-h3 flex items-center gap-2">
          Blockers raised today <Count value={open.length} alert />
        </h2>
        <Link to={REVIEW} className="font-semibold">
          All check-ins
        </Link>
      </CardHeader>
      <AsyncState
        query={query}
        errorTitle="Couldn't load check-ins"
        isEmpty={() => open.length === 0}
        empty={<p className="card-pad text-text-2">No open blockers today.</p>}
      >
        {() => (
          <ul className="divide-y divide-border">
            {open.map((checkin) => (
              <li key={checkin.id} className="flex flex-col sm:flex-row gap-3 p-4 sm:px-5">
                <Avatar name={checkin.user.name} id={checkin.user.id} />
                <div className="min-w-0 grow">
                  <p>
                    <span className="font-semibold">{checkin.user.name}</span>{' '}
                    <span className="text-small text-text-2">
                      {personTitle(checkin.user)} · {formatTime(new Date(checkin.submittedAt))}
                    </span>
                  </p>
                  <p className="mt-1 break-words">"{checkin.blockers}"</p>
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  <Link to={REVIEW} className="btn btn-secondary btn-sm">
                    Reply
                  </Link>
                  {can('reviewCheckins') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      isLoading={busyId === checkin.id}
                      onClick={() => handle(checkin.id)}
                    >
                      Mark handled
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </AsyncState>
    </Card>
  );
};

export const NotCheckedInCard: React.FC<{ query: ApiQuery<TeamCheckins> }> = ({ query }) => (
  <Card>
    <CardHeader>
      <h2 className="t-h3 flex items-center gap-2">
        Not checked in yet <Count value={query.data?.notCheckedIn.length ?? 0} />
      </h2>
    </CardHeader>
    <AsyncState
      query={query}
      errorTitle="Couldn't load check-ins"
      isEmpty={(data) => data.notCheckedIn.length === 0}
      empty={<p className="card-pad text-text-2">Everyone has checked in.</p>}
    >
      {({ notCheckedIn }) => (
        <ul className="divide-y divide-border">
          {notCheckedIn.map((person) => (
            <li key={person.id} className="li">
              <Avatar name={person.name} id={person.id} />
              <span className="min-w-0 grow title truncate">{person.name}</span>
              <span className="text-small text-text-2 truncate">{personTitle(person)}</span>
            </li>
          ))}
        </ul>
      )}
    </AsyncState>
  </Card>
);
