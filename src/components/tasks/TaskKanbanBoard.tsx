import React from 'react';
import { Task, TaskStatus } from '../../types';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import {
  Calendar,
  CheckSquare,
  MessageSquare,
  AlertTriangle,
  GitPullRequest,
  CheckCircle2,
} from 'lucide-react';

interface TaskKanbanBoardProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export const TaskKanbanBoard: React.FC<TaskKanbanBoardProps> = ({
  tasks,
  onSelectTask,
}) => {
  const columns: { status: TaskStatus; label: string; color: string }[] = [
    { status: 'BACKLOG', label: 'Backlog', color: 'border-slate-300' },
    { status: 'TODO', label: 'To Do', color: 'border-indigo-400' },
    { status: 'IN_PROGRESS', label: 'In Progress', color: 'border-brivent-500' },
    { status: 'BLOCKED', label: 'Blocked', color: 'border-rose-500' },
    { status: 'IN_REVIEW', label: 'In Review', color: 'border-amber-500' },
    { status: 'COMPLETED', label: 'Completed', color: 'border-emerald-500' },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-1 items-start min-h-[600px] kanban-column">
      {columns.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.status);

        return (
          <div
            key={col.status}
            className="w-80 shrink-0 bg-slate-100/80 rounded-2xl p-3 border border-slate-200/80 flex flex-col max-h-[calc(100vh-220px)]"
          >
            {/* Column Header */}
            <div className={`flex items-center justify-between pb-3 mb-2 border-b-2 ${col.color} px-1`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {col.label}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Task Cards Column */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {columnTasks.length === 0 ? (
                <div className="h-28 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-xs font-medium">
                  No tasks
                </div>
              ) : (
                columnTasks.map((task) => {
                  const completedSubtasks = task.checklist.filter((c) => c.isCompleted).length;
                  const totalSubtasks = task.checklist.length;
                  const isBlocked = task.status === 'BLOCKED';

                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group space-y-2.5 ${
                        isBlocked ? 'border-rose-200 bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Priority & Project */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[140px]">
                          {task.projectName}
                        </span>
                        <TaskPriorityBadge priority={task.priority} size="sm" />
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-brivent-600 transition-colors">
                        {task.title}
                      </h4>

                      {/* Blocker reason snippet if blocked */}
                      {isBlocked && task.blockerReason && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{task.blockerReason}</span>
                        </div>
                      )}

                      {/* Footer: Due date, comments, assignee avatar */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center gap-1 font-medium text-slate-600">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {task.dueDate.slice(5)}
                          </span>

                          {totalSubtasks > 0 && (
                            <span className="flex items-center gap-1">
                              <CheckSquare className="w-3 h-3 text-slate-400" />
                              {completedSubtasks}/{totalSubtasks}
                            </span>
                          )}

                          {task.commentsCount > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-slate-400" />
                              {task.commentsCount}
                            </span>
                          )}
                        </div>

                        {/* Assignee Avatar with tooltip */}
                        <div className="flex items-center gap-1">
                          {task.reviewerName && (
                            <span
                              className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold flex items-center justify-center ring-1 ring-amber-300"
                              title={`Reviewer: ${task.reviewerName}`}
                            >
                              R
                            </span>
                          )}
                          <img
                            src={task.assigneeAvatar}
                            alt={task.assigneeName}
                            title={`Owner: ${task.assigneeName}`}
                            className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

