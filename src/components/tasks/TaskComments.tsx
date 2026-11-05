import React, { useState } from 'react';
import { errorMessage } from '../../api/client';
import { addComment, COMMENTS_PAGE_SIZE, listComments } from '../../api/tasks';
import { TaskComment } from '../../api/types';
import { useSession } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PERMISSIONS } from '../../lib/permissions';
import { formatDateTime } from '../../lib/tasks';
import { useApiQuery } from '../../lib/useApiQuery';
import { AsyncState } from '../ui/AsyncState';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';

export const TaskComments: React.FC<{ taskId: string }> = ({ taskId }) => {
  const { hasPermission } = useSession();
  const toast = useToast();

  const [pages, setPages] = useState(1);
  const query = useApiQuery<{ comments: TaskComment[]; total: number }>(
    (signal) => listComments(taskId, pages, signal),
    [taskId, pages],
  );

  const [body, setBody] = useState('');
  const [bodyError, setBodyError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setBodyError('Write a comment first.');
      return;
    }
    setBodyError(undefined);
    setIsSubmitting(true);
    try {
      await addComment(taskId, body.trim());
      setBody('');
      toast.success('Comment added.');
      query.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="comments-heading" className="mt-8">
      <h2 id="comments-heading" className="text-base font-semibold text-slate-900 mb-4">
        Comments
      </h2>

      <AsyncState
        query={query}
        loadingLabel="Loading comments…"
        isEmpty={(data) => data.comments.length === 0}
        empty={<p className="text-sm text-slate-600">No comments yet.</p>}
      >
        {({ comments, total }) => (
          <>
            <ul className="space-y-4">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-3">
                  <Avatar name={comment.author.name} className="w-8 h-8 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium text-slate-900">{comment.author.name}</span>{' '}
                      <time dateTime={comment.createdAt} className="text-slate-600">
                        {formatDateTime(comment.createdAt)}
                      </time>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-800 whitespace-pre-wrap break-words">
                      {comment.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {comments.length < total && pages * COMMENTS_PAGE_SIZE < total && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setPages(pages + 1)}
              >
                Show more comments
              </Button>
            )}
          </>
        )}
      </AsyncState>

      {hasPermission(PERMISSIONS.TASKS_COMMENT) && (
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-3">
          <Textarea
            label="Add a comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            error={bodyError}
            maxLength={5000}
            rows={3}
          />
          <Button type="submit" isLoading={isSubmitting}>
            Post comment
          </Button>
        </form>
      )}
    </section>
  );
};
