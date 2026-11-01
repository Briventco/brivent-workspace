import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import { Task, TaskPriority, TaskStatus } from '../types';
import { TaskKanbanBoard } from '../components/tasks/TaskKanbanBoard';
import { TaskListView } from '../components/tasks/TaskListView';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer';
import { TaskCreateModal } from '../components/tasks/TaskCreateModal';
import { Button } from '../components/ui/Button';
import {
  Kanban,
  List,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const TasksView: React.FC = () => {
  const { currentUser, hasPermission } = useWorkspace();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterTab, setFilterTab] = useState<'all' | 'my' | 'dept' | 'review' | 'blocked'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false);

  // Invalidate trigger
  const [dataVersion, setDataVersion] = useState(0);

  const rawTasks = useMemo(() => {
    return workspaceService.getTasks();
  }, [dataVersion]);

  const departments = workspaceService.getDepartments();

  const filteredTasks = useMemo(() => {
    let list = rawTasks;

    // Filter Tab
    if (filterTab === 'my') {
      list = list.filter((t) => t.assigneeId === currentUser.id);
    } else if (filterTab === 'dept') {
      list = list.filter((t) => t.departmentId === currentUser.departmentId);
    } else if (filterTab === 'review') {
      list = list.filter((t) => t.status === 'IN_REVIEW' || t.reviewerId === currentUser.id);
    } else if (filterTab === 'blocked') {
      list = list.filter((t) => t.status === 'BLOCKED');
    }

    // Dropdown filters
    if (selectedDepartment !== 'ALL') {
      list = list.filter((t) => t.departmentId === selectedDepartment);
    }
    if (selectedPriority !== 'ALL') {
      list = list.filter((t) => t.priority === selectedPriority);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assigneeName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [rawTasks, filterTab, currentUser, selectedDepartment, selectedPriority, searchQuery]);

  const canCreateTask = hasPermission('CREATE_TASK');

  const handleRefresh = () => {
    setDataVersion((v) => v + 1);
    if (selectedTask) {
      const refreshed = workspaceService.getTaskById(selectedTask.id);
      setSelectedTask(refreshed || null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Work Management & Tasks
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track daily assignments, workflow progressions, subtasks, and reviews.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-slate-200/80 p-0.5 rounded-lg flex items-center border border-slate-300">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>

          {canCreateTask && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsTaskCreateOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs Strip */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterTab('my')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              filterTab === 'my'
                ? 'bg-brivent-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            My Assigned Tasks
          </button>
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterTab === 'all'
                ? 'bg-brivent-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Workspace Tasks
          </button>
          <button
            onClick={() => setFilterTab('dept')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterTab === 'dept'
                ? 'bg-brivent-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {currentUser.departmentName}
          </button>
          <button
            onClick={() => setFilterTab('review')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
              filterTab === 'review'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Awaiting Review
          </button>
          <button
            onClick={() => setFilterTab('blocked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
              filterTab === 'blocked'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Blocked
          </button>
        </div>

        {/* Search & dropdown filters */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brivent-500 bg-white"
            />
          </div>

          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 py-1.5 px-2 bg-white text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'kanban' ? (
        <TaskKanbanBoard tasks={filteredTasks} onSelectTask={(t) => setSelectedTask(t)} />
      ) : (
        <TaskListView tasks={filteredTasks} onSelectTask={(t) => setSelectedTask(t)} />
      )}

      {/* Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={handleRefresh}
      />

      {/* Create Modal */}
      <TaskCreateModal
        isOpen={isTaskCreateOpen}
        onClose={() => setIsTaskCreateOpen(false)}
        onTaskCreated={handleRefresh}
      />
    </div>
  );
};

