import React, { useState } from 'react';
import { Task, TaskStatus } from '../../types';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { useWorkspace } from '../../context/WorkspaceContext';
import { workspaceService } from '../../services/workspaceService';
import { BlockerModal } from './BlockerModal';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Send,
  Shield,
  User,
  Users,
  AlertTriangle,
  History,
  GitPullRequest,
  CheckSquare,
} from 'lucide-react';
import { Badge } from '../ui/Badge';

interface TaskDetailDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
}) => {
  const { currentUser, showToast } = useWorkspace();
  const [commentInput, setCommentInput] = useState('');
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');

  if (!task) return null;

  const isAssignee = task.assigneeId === currentUser.id;
  const isReviewer = task.reviewerId === currentUser.id;
  const isLeadOrAdmin =
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.role === 'DEPARTMENT_LEAD' ||
    currentUser.role === 'MANAGEMENT';

  const canApprove = isReviewer || isLeadOrAdmin;

  const completedChecklistCount = task.checklist.filter((c) => c.isCompleted).length;
  const totalChecklist = task.checklist.length;
  const checklistPercentage = totalChecklist > 0 ? Math.round((completedChecklistCount / totalChecklist) * 100) : 0;

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (newStatus === 'BLOCKED') {
      setIsBlockerModalOpen(true);
      return;
    }

    try {
      workspaceService.updateTaskStatus(task.id, newStatus);
      showToast(`Task status updated to ${newStatus}`);
      onTaskUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleBlockerConfirm = (reason: string) => {
    workspaceService.updateTaskStatus(task.id, 'BLOCKED', reason);
    showToast('Task marked as BLOCKED with reason logged.');
    onTaskUpdated();
  };

  const handleToggleChecklist = (itemId: string) => {
    workspaceService.toggleChecklistItem(task.id, itemId);
    onTaskUpdated();
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    workspaceService.addTaskComment(task.id, commentInput.trim());
    setCommentInput('');
    showToast('Comment posted.');
    onTaskUpdated();
  };

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={task.title}
        subtitle={`${task.projectName} • ${task.departmentName}`}
        width="2xl"
      >
        <div className="space-y-6">
          {/* Status & Priority Header Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <TaskStatusBadge status={task.status} size="md" />
              <TaskPriorityBadge priority={task.priority} size="md" />
            </div>

            {/* Quick Status Workflow Action Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.status !== 'IN_PROGRESS' && task.status !== 'COMPLETED' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange('IN_PROGRESS')}
                >
                  Start Progress
                </Button>
              )}

              {task.status === 'IN_PROGRESS' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => handleStatusChange('IN_REVIEW')}
                >
                  Submit for Review
                </Button>
              )}

              {task.status !== 'BLOCKED' && task.status !== 'COMPLETED' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-rose-700 border-rose-300 hover:bg-rose-50"
                  onClick={() => setIsBlockerModalOpen(true)}
                >
                  Declare Blocker
                </Button>
              )}

              {task.status !== 'COMPLETED' && (
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleStatusChange('COMPLETED')}
                  disabled={task.requiresReview && !canApprove}
                  title={
                    task.requiresReview && !canApprove
                      ? 'Requires review approval by designated reviewer or lead'
                      : 'Mark completed'
                  }
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve / Complete
                </Button>
              )}
            </div>
          </div>

          {/* Blocker Alert Banner (if blocked) */}
          {task.status === 'BLOCKED' && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                    Active Blocker Reason
                  </h4>
                  <p className="text-sm text-rose-800 mt-1">
                    {task.blockerReason || 'Unspecified obstacle reported.'}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs bg-white text-rose-700 border-rose-300 hover:bg-rose-50"
                      onClick={() => handleStatusChange('IN_PROGRESS')}
                    >
                      Resolve Blocker & Resume
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tabs (Details / Comments / History) */}
          <div className="flex border-b border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 px-3 border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-brivent-600 text-brivent-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Task Overview
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'comments'
                  ? 'border-brivent-600 text-brivent-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Discussion ({task.comments?.length || task.commentsCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-brivent-600 text-brivent-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Activity Audit ({task.activityHistory?.length || 0})
            </button>
          </div>

          {/* TAB 1: Task Overview Details */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Description & Context
                </h4>
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {task.description || 'No detailed description provided.'}
                </div>
              </div>

              {/* People & Dates Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Assignee */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Assigned Owner
                  </span>
                  <div className="flex items-center gap-3">
                    <img
                      src={task.assigneeAvatar}
                      alt={task.assigneeName}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{task.assigneeName}</p>
                      <p className="text-xs text-slate-500">{task.assigneeRole}</p>
                    </div>
                  </div>
                </div>

                {/* Reviewer */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Designated Reviewer
                  </span>
                  {task.reviewerName ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={task.reviewerAvatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'}
                        alt={task.reviewerName}
                        className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{task.reviewerName}</p>
                        <p className="text-xs text-slate-500">Signoff Approver</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Self-reviewed</p>
                  )}
                </div>

                {/* Dates */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Due Date
                  </span>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Calendar className="w-4 h-4 text-brivent-600" />
                    <span>{task.dueDate}</span>
                    <span className="text-xs text-slate-500 font-normal">(5:00 PM WAT)</span>
                  </div>
                </div>

                {/* Creator */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Created By
                  </span>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{task.creatorName}</span>
                  </div>
                </div>
              </div>

              {/* Checklist / Subtasks */}
              {totalChecklist > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Subtasks Checklist ({completedChecklistCount}/{totalChecklist})
                    </h4>
                    <span className="text-xs font-semibold text-brivent-600">
                      {checklistPercentage}% complete
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-3 overflow-hidden">
                    <div
                      className="bg-brivent-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${checklistPercentage}%` }}
                    />
                  </div>

                  <div className="space-y-2">
                    {task.checklist.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleChecklist(item.id)}
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-brivent-600 focus:ring-brivent-500 h-4 w-4"
                        />
                        <span
                          className={`text-sm ${
                            item.isCompleted
                              ? 'line-through text-slate-400'
                              : 'text-slate-800 font-medium'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Engineering Resources */}
              {task.githubPrUrl && (
                <div className="p-3.5 bg-slate-900 text-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <GitPullRequest className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold text-white">Linked GitHub Pull Request</p>
                      <p className="text-[11px] text-slate-400">{task.githubPrUrl}</p>
                    </div>
                  </div>
                  <a
                    href={task.githubPrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brivent-400 hover:text-white flex items-center gap-1 font-medium"
                  >
                    View PR <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Task Discussions & Comments */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {!task.comments || task.comments.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No comments yet. Start a discussion below.
                  </div>
                ) : (
                  task.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={comment.userAvatar}
                            alt={comment.userName}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold text-slate-900">
                            {comment.userName}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            • {comment.userRole}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(comment.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed pl-8">
                        {comment.content}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Composer */}
              <form onSubmit={handleAddComment} className="pt-2 border-t border-slate-100">
                <div className="relative">
                  <textarea
                    rows={2}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Write a comment or ask for clarification..."
                    className="w-full text-xs rounded-xl border border-slate-300 p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-brivent-500/20 focus:border-brivent-500 placeholder-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!commentInput.trim()}
                    className="absolute right-2.5 bottom-3.5 p-1.5 bg-brivent-600 text-white rounded-lg hover:bg-brivent-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: Activity Audit History */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 mb-2">
                Immutable trace of all status changes, reassignments, and reviewer signoffs:
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {task.activityHistory?.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 text-xs flex items-start gap-2.5"
                  >
                    <History className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{act.action}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        By {act.actorName} • {new Date(act.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Drawer>

      {/* Blocker Modal */}
      <BlockerModal
        isOpen={isBlockerModalOpen}
        onClose={() => setIsBlockerModalOpen(false)}
        onConfirm={handleBlockerConfirm}
        taskTitle={task.title}
      />
    </>
  );
};

