import React from 'react';
import { Enrollment, ItemStatus, LearningHealth, SkillTrend } from '../../api/types';
import { dueText, HEALTH_LABELS, ITEM_STATUS_LABELS } from '../../lib/learning';
import { Link } from '../../lib/router';
import { Icon, IconName } from '../ui/Icon';

const HEALTH: Record<LearningHealth, { className: string; icon: IconName; filled?: boolean }> = {
  ON_TRACK: { className: 'st-prog', icon: 'task_alt' },
  BEHIND: { className: 'st-block', icon: 'schedule' },
  COMPLETED: { className: 'st-done', icon: 'check_circle', filled: true },
  PAUSED: { className: 'st-todo', icon: 'do_not_disturb_on' },
};

export const HealthBadge: React.FC<{ health: LearningHealth }> = ({ health }) => {
  const { className, icon, filled } = HEALTH[health];
  return (
    <span className={`badge ${className}`}>
      <Icon name={icon} size="sm" filled={filled} />
      {HEALTH_LABELS[health]}
    </span>
  );
};

const ITEM_STATUS: Record<ItemStatus, { className: string; icon: IconName; filled?: boolean }> = {
  NOT_STARTED: { className: 'st-todo', icon: 'radio_button_unchecked' },
  SUBMITTED: { className: 'st-prog', icon: 'hourglass_top' },
  CHANGES_REQUESTED: { className: 'st-block', icon: 'edit_note' },
  COMPLETED: { className: 'st-done', icon: 'check_circle', filled: true },
};

export const ItemStatusBadge: React.FC<{ status: ItemStatus }> = ({ status }) => {
  const { className, icon, filled } = ITEM_STATUS[status];
  return (
    <span className={`badge ${className}`}>
      <Icon name={icon} size="sm" filled={filled} />
      {ITEM_STATUS_LABELS[status]}
    </span>
  );
};

const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export const ProgressRing: React.FC<{ percent: number; label: string }> = ({ percent, label }) => (
  <span className="relative inline-flex shrink-0 w-16 h-16" role="img" aria-label={label}>
    <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={RING_RADIUS} fill="none" strokeWidth="6" className="ring-track" />
      <circle
        cx="32"
        cy="32"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - percent / 100)}
        className="ring-value"
      />
    </svg>
    <span className="absolute inset-0 flex items-center justify-center text-small font-semibold">
      {percent}%
    </span>
  </span>
);

const TREND: Record<SkillTrend, { icon: IconName; label: string }> = {
  UP: { icon: 'keyboard_arrow_up', label: 'Improving' },
  DOWN: { icon: 'keyboard_arrow_down', label: 'Dropping' },
  FLAT: { icon: 'remove', label: 'Steady' },
  NONE: { icon: 'remove', label: 'Not enough ratings yet' },
};

export const TrendArrow: React.FC<{ trend: SkillTrend }> = ({ trend }) => {
  const { icon, label } = TREND[trend];
  return (
    <span
      title={label}
      className={`inline-flex items-center ${trend === 'NONE' ? 'text-text-3' : 'text-text'}`}
    >
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
    </span>
  );
};

interface ScorePickerProps {
  label: string;
  value: number | null;
  onChange: (score: number | null) => void;
}

/** 1 to 5. Choosing the current score clears it, since rating is optional in every form here. */
export const ScorePicker: React.FC<ScorePickerProps> = ({ label, value, onChange }) => (
  <div role="group" aria-label={label} className="inline-flex gap-1">
    {[1, 2, 3, 4, 5].map((score) => (
      <button
        key={score}
        type="button"
        aria-pressed={value === score}
        aria-label={`${score} out of 5`}
        onClick={() => onChange(value === score ? null : score)}
        className={`chip w-9 justify-center ${value === score ? 'on' : ''}`}
      >
        {score}
      </button>
    ))}
  </div>
);

export const EnrollmentCard: React.FC<{ enrollment: Enrollment }> = ({ enrollment }) => {
  const { id, track, progress, mentor } = enrollment;
  const { percentComplete, itemsCompleted, itemsTotal, health, nextItem, overdueItems } = progress;

  return (
    <Link
      to={`/learning/enrollments/${id}`}
      className="card card-pad block text-text hover:no-underline"
    >
      <div className="flex items-center gap-4">
        <ProgressRing
          percent={percentComplete}
          label={`${percentComplete}% complete, ${itemsCompleted} of ${itemsTotal} items`}
        />
        <div className="min-w-0 grow">
          <h2 className="t-h3 truncate">{track.title}</h2>
          <p className="text-small text-text-2 truncate">Mentor: {mentor.name}</p>
          <div className="mt-1.5">
            <HealthBadge health={health} />
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-border text-small">
        {nextItem ? (
          <>
            <p className="t-over text-text-2 mb-0.5">Next up</p>
            <p className="font-semibold truncate">{nextItem.title}</p>
            <p className="text-text-2">{dueText(nextItem.dueDate)}</p>
          </>
        ) : (
          <p className="text-text-2">
            {health === 'COMPLETED' ? 'Finished. Nice work.' : 'Nothing to do until your work is reviewed.'}
          </p>
        )}
        {overdueItems > 0 && (
          <p className="overdue mt-1 inline-flex items-center gap-1">
            <Icon name="schedule" size="sm" />
            {overdueItems} overdue
          </p>
        )}
      </div>
    </Link>
  );
};
