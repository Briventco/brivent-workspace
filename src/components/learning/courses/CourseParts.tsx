import React from 'react';
import { CourseStatus } from '../../../api/types';
import { COURSE_STATUS_LABELS } from '../../../lib/courses';
import { Icon, IconName } from '../../ui/Icon';

const STATUS: Record<CourseStatus, { className: string; icon: IconName; filled?: boolean }> = {
  NOT_STARTED: { className: 'st-todo', icon: 'radio_button_unchecked' },
  IN_PROGRESS: { className: 'st-prog', icon: 'clock_loader_40' },
  PROOF_SUBMITTED: { className: 'st-prog', icon: 'hourglass_top' },
  CHANGES_REQUESTED: { className: 'st-block', icon: 'edit_note' },
  COMPLETED: { className: 'st-done', icon: 'check_circle', filled: true },
};

export const CourseStatusBadge: React.FC<{ status: CourseStatus }> = ({ status }) => {
  const { className, icon, filled } = STATUS[status];
  return (
    <span className={`badge ${className}`}>
      <Icon name={icon} size="sm" filled={filled} />
      {COURSE_STATUS_LABELS[status]}
    </span>
  );
};
