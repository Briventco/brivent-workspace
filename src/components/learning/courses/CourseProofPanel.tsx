import React, { useState } from 'react';
import { errorMessage } from '../../../api/client';
import { reviewCourseProof } from '../../../api/learning';
import { CourseProofRequest } from '../../../api/types';
import { useToast } from '../../../context/ToastContext';
import { PROOF_LABELS } from '../../../lib/courses';
import { formatDateTime } from '../../../lib/wat';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { SidePanel } from '../../ui/SidePanel';
import { Textarea } from '../../ui/Textarea';

/** A learner's proof that they finished an external course. Approving completes it on every track. */
export const CourseProofPanel: React.FC<{ request: CourseProofRequest; onClose: () => void; onDone: () => void }> = ({
  request,
  onClose,
  onDone,
}) => {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState<'APPROVED' | 'CHANGES_REQUESTED' | null>(null);
  const { course, learner } = request;

  const decide = async (decision: 'APPROVED' | 'CHANGES_REQUESTED') => {
    if (decision === 'CHANGES_REQUESTED' && !note.trim()) {
      setError('Say what needs to change.');
      return;
    }
    setError(undefined);
    setSaving(decision);
    try {
      await reviewCourseProof(learner.id, course.id, { decision, ...(note.trim() && { note: note.trim() }) });
      toast.success(decision === 'APPROVED' ? 'Course approved.' : 'Changes requested.');
      onDone();
    } catch (failure) {
      setSaving(null);
      toast.error(errorMessage(failure));
    }
  };

  return (
    <SidePanel isOpen onClose={onClose} title={course.title}>
      <div className="space-y-5">
        <p className="text-text-2">
          {learner.name} · {course.provider} · Sent {formatDateTime(new Date(request.submittedAt))}
        </p>
        <p className="text-small text-text-2">Asked for: {PROOF_LABELS[course.proofType].toLowerCase()}.</p>
        <a href={course.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
          <Icon name="open_in_new" size="sm" />
          The course
        </a>
        {request.proofLink && (
          <section>
            <h3 className="t-over text-text-2 mb-1">Their link</h3>
            <a href={request.proofLink} target="_blank" rel="noopener noreferrer" className="break-all">
              {request.proofLink}
            </a>
          </section>
        )}
        {request.proofImageUrl && (
          <section>
            <h3 className="t-over text-text-2 mb-1">Their screenshot</h3>
            <a href={request.proofImageUrl} target="_blank" rel="noopener noreferrer">
              <img src={request.proofImageUrl} alt={`Screenshot from ${learner.name}`} className="rounded-md border border-border max-h-80" />
            </a>
          </section>
        )}
        {request.proofNote && (
          <section>
            <h3 className="t-over text-text-2 mb-1">Their note</h3>
            <p className="whitespace-pre-wrap break-words">{request.proofNote}</p>
          </section>
        )}
        <Textarea
          label="Note"
          rows={3}
          value={note}
          error={error}
          helperText="Needed when you ask for changes."
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button icon="check" onClick={() => decide('APPROVED')} isLoading={saving === 'APPROVED'} disabled={saving !== null}>
            Approve
          </Button>
          <Button
            variant="secondary"
            onClick={() => decide('CHANGES_REQUESTED')}
            isLoading={saving === 'CHANGES_REQUESTED'}
            disabled={saving !== null}
          >
            Request changes
          </Button>
        </div>
      </div>
    </SidePanel>
  );
};
