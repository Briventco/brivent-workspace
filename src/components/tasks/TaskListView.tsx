import React from 'react';
import { Task } from '../../types';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { Calendar, ChevronRight, MessageSquare, AlertTriangle } from 'lucide-react';

interface TaskListViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  onSelectTask,
}) => {
  if (tasks.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
        <p className="text-sm font-semibold text-slate-700">No tasks found</p>
        <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search terms.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
            <tr>
              <th className="py-3 px-4">Task & Project</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Assignee</th>
              <th className="py-3 px-4">Reviewer</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <tr
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
              >
                {/* Title & Project */}
                <td className="py-3.5 px-4 max-w-sm">
                  <div className="flex items-start gap-2">
                    {task.status === 'BLOCKED' && (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-900 group-hover:text-brivent-600 transition-colors">
                        {task.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {task.projectName} • {task.departmentName}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <TaskStatusBadge status={task.status} size="sm" />
                </td>

                {/* Priority */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <TaskPriorityBadge priority={task.priority} size="sm" />
                </td>

                {/* Assignee */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <img
                      src={task.assigneeAvatar}
                      alt={task.assigneeName}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200"
                    />
                    <span className="font-medium text-slate-800">{task.assigneeName}</span>
                  </div>
                </td>

                {/* Reviewer */}
                <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                  {task.reviewerName || <span className="italic text-slate-400">Self</span>}
                </td>

                {/* Due Date */}
                <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {task.dueDate}
                  </span>
                </td>

                {/* Action arrow */}
                <td className="py-3.5 px-4 text-right">
                  <ChevronRight className="w-4 h-4 text-slate-400 inline-block group-hover:text-brivent-600 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

