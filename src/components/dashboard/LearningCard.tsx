import React from 'react';
import { TaskSummary } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { dueText } from '../../lib/learning';
import { Link } from '../../lib/router';
import { Icon } from '../ui/Icon';

const ROW =
  'card card-pad flex items-center gap-3 text-text hover:no-underline min-w-0';

/** Each half is only there for people the summary says it applies to. */
export const LearningCard: React.FC<{ summary: TaskSummary }> = ({ summary }) => {
  const { can } = useSession();
  const { learning, learningReview } = summary;
  if (!learning && !learningReview) return null;

  const behindTab = can('manageAllLearning') ? 'all' : 'learners';

  return (
    <div className="grid gap-3 mb-5 md:grid-cols-2">
      {learning && (
        <Link to="/learning" className={`${ROW} md:col-span-2`} aria-label="Open my learning">
          <Icon name="fact_check" className="text-brand" />
          <span className="min-w-0 grow">
            <span className="t-over text-text-2 block">Learning · next up</span>
            <span className="block font-semibold truncate">
              {learning.nextItem?.title ?? 'Waiting for your reviewer'}
            </span>
            {learning.nextItem && (
              <span className="block text-small text-text-2">
                {dueText(learning.nextItem.dueDate)}
              </span>
            )}
          </span>
          {learning.overdueItems > 0 && (
            <span className="overdue inline-flex items-center gap-1 whitespace-nowrap">
              <Icon name="schedule" size="sm" />
              {learning.overdueItems} overdue
            </span>
          )}
        </Link>
      )}
      {learningReview && (
        <>
          <Link to="/learning?tab=reviews" className={ROW}>
            <Icon name="hourglass_top" className="text-brand" />
            <span className="grow">Awaiting review</span>
            <span className="t-h2">{learningReview.awaitingReview}</span>
          </Link>
          <Link to={`/learning?tab=${behindTab}&health=BEHIND`} className={ROW}>
            <Icon name="schedule" className="text-brand" />
            <span className="grow">Learners behind</span>
            <span className="t-h2">{learningReview.learnersBehind}</span>
          </Link>
        </>
      )}
    </div>
  );
};
