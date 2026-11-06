import React from 'react';
import { getTodayCheckin } from '../../api/checkins';
import { Link } from '../../lib/router';
import { useApiQuery } from '../../lib/useApiQuery';
import { formatTime, isWeekend } from '../../lib/wat';
import { Icon } from '../ui/Icon';

const CheckedIn: React.FC = () => {
  const { data } = useApiQuery((signal) => getTodayCheckin(signal), []);
  return (
    <Link to="/daily" className="card flex items-center gap-3 p-4 mb-5 text-text hover:no-underline">
      <Icon name="check_circle" filled className="text-success" />
      <span className="font-semibold">
        {data ? `Checked in at ${formatTime(new Date(data.submittedAt))}` : 'Checked in today'}
      </span>
    </Link>
  );
};

/** Disappears at weekends, and once submitted it says when. */
export const CheckInCard: React.FC<{ checkedIn: boolean | undefined }> = ({ checkedIn }) => {
  if (checkedIn === undefined || isWeekend()) return null;
  if (checkedIn) return <CheckedIn />;

  return (
    <div className="checkin-card mb-5">
      <span className="checkin-card-icon">
        <Icon name="edit_note" />
      </span>
      <div className="min-w-0 grow">
        <p className="t-h3">You haven't checked in today</p>
        <p className="hidden md:block text-small opacity-80">
          Share what you finished yesterday, what you're on today, and anything blocking you. It
          takes about 2 minutes.
        </p>
        <p className="md:hidden text-small opacity-80">About 2 minutes</p>
      </div>
      <Link to="/daily" className="btn btn-secondary hidden md:inline-flex shrink-0">
        Start check-in
        <Icon name="arrow_forward" />
      </Link>
      <Link to="/daily" aria-label="Start check-in" className="md:hidden text-white">
        <Icon name="chevron_right" />
      </Link>
    </div>
  );
};
