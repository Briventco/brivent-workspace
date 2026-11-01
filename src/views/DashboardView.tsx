import React, { useMemo } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import { TaskStatusBadge } from '../components/tasks/TaskStatusBadge';
import { TaskPriorityBadge } from '../components/tasks/TaskPriorityBadge';
import { Button } from '../components/ui/Button';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderKanban,
  FileText,
  Users,
  ArrowRight,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Flame,
  CheckSquare,
  ShieldCheck,
  Megaphone,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenTask: (taskId: string) => void;
  onOpenCheckIn: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenTask,
  onOpenCheckIn,
}) => {
  const { currentUser, setActiveTab, announcements, acknowledgeAnnouncement } = useWorkspace();

  const allTasks = workspaceService.getTasks();
  const allProjects = workspaceService.getProjects();
  const checkIns = workspaceService.getDailyCheckIns();

  const myTasks = useMemo(() => {
    return allTasks.filter((t) => t.assigneeId === currentUser.id);
  }, [allTasks, currentUser]);

  const tasksDueToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return myTasks.filter((t) => t.dueDate === today && t.status !== 'COMPLETED');
  }, [myTasks]);

  const highPriorityTasks = useMemo(() => {
    return myTasks.filter(
      (t) => (t.priority === 'HIGH' || t.priority === 'URGENT') && t.status !== 'COMPLETED'
    );
  }, [myTasks]);

  const blockedTasks = useMemo(() => {
    return allTasks.filter((t) => t.status === 'BLOCKED');
  }, [allTasks]);

  const awaitingReviewTasks = useMemo(() => {
    return allTasks.filter((t) => t.status === 'IN_REVIEW');
  }, [allTasks]);

  const todayUserCheckIn = checkIns.find(
    (c) => c.userId === currentUser.id && c.date === new Date().toISOString().split('T')[0]
  );

  // Time formatting
  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-brivent-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-brivent-600/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brivent-400 bg-brivent-900/60 px-2.5 py-1 rounded-full border border-brivent-700/60">
                {currentUser.departmentName}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {todayFormatted} • WAT (UTC+1)
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Good day, {currentUser.name.split(' ')[0]} 👋
            </h1>

            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Every person should know what to do, every task should have an owner, and every important decision should be traceable.
            </p>
          </div>

          {/* Quick Check-in CTA */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0 sm:w-72">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brivent-400" />
                9 AM–5 PM Daily Routine
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  todayUserCheckIn
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {todayUserCheckIn ? 'Standup Submitted' : 'Pending 9:30 AM'}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 mb-3 leading-snug">
              {todayUserCheckIn
                ? `Submitted at ${todayUserCheckIn.timeSubmitted}. Plan locked for today.`
                : 'Confirm today’s priorities and declare any blockers.'}
            </p>

            <Button
              size="sm"
              variant="primary"
              className="w-full text-xs"
              onClick={onOpenCheckIn}
            >
              {todayUserCheckIn ? 'Review Daily Standup' : 'Submit Daily Check-in'}
            </Button>
          </div>
        </div>
      </div>

      {/* Priority Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Due Today */}
        <div
          onClick={() => setActiveTab('tasks')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Tasks Due Today
            </span>
            <div className="p-2 rounded-xl bg-brivent-50 text-brivent-600 group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {tasksDueToday.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Due before 5:00 PM WAT</p>
        </div>

        {/* High / Urgent Priority */}
        <div
          onClick={() => setActiveTab('tasks')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              High Priority
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {highPriorityTasks.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Requires immediate attention</p>
        </div>

        {/* Blocked Items */}
        <div
          onClick={() => setActiveTab('tasks')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Active Blockers
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 tracking-tight">
            {blockedTasks.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all departments</p>
        </div>

        {/* Awaiting Review */}
        <div
          onClick={() => setActiveTab('tasks')}
          className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Awaiting Review
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {awaitingReviewTasks.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Pending lead signoff</p>
        </div>
      </div>

      {/* Main Grid: My Tasks & Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Today's Priorities & Assigned Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  My Assigned Work Today
                </h3>
                <p className="text-xs text-slate-500">
                  {myTasks.length} total tasks assigned to you
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab('tasks')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Open Full Board
              </Button>
            </div>

            {myTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                You have no active tasks assigned. Check department backlog or ask your lead.
              </div>
            ) : (
              <div className="space-y-2.5">
                {myTasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onOpenTask(task.id)}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <TaskPriorityBadge priority={task.priority} size="sm" />
                        <span className="text-[11px] font-semibold text-slate-500 truncate">
                          {task.projectName}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-brivent-600 transition-colors truncate">
                        {task.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <TaskStatusBadge status={task.status} size="sm" />
                      <span className="text-[11px] text-slate-500 hidden sm:inline font-medium">
                        Due {task.dueDate.slice(5)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Projects Quick Strip */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Active Projects
                </h3>
                <p className="text-xs text-slate-500">Projects you participate in</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveTab('projects')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                All Projects
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allProjects.slice(0, 2).map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => setActiveTab('projects')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {proj.name}
                    </span>
                    <span className="text-[10px] font-bold text-brivent-600 bg-brivent-50 px-2 py-0.5 rounded-full">
                      {proj.progressPercentage}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                    {proj.description}
                  </p>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-brivent-600 h-1.5 rounded-full"
                      style={{ width: `${proj.progressPercentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Company Announcements & SOPs */}
        <div className="space-y-6">
          {/* Announcements */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-brivent-600" />
                Official Announcements
              </h3>
            </div>

            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        ann.priority === 'URGENT'
                          ? 'bg-rose-100 text-rose-700'
                          : ann.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {ann.priority}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(ann.publishedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {ann.title}
                  </h4>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {ann.content}
                  </p>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">
                      By {ann.authorName} ({ann.authorRole})
                    </span>
                    {!ann.isAcknowledged ? (
                      <button
                        onClick={() => acknowledgeAnnouncement(ann.id)}
                        className="text-xs text-brivent-600 hover:text-brivent-700 font-bold"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Knowledge Base Card */}
          <div className="bg-gradient-to-br from-brivent-50 to-indigo-50/40 rounded-2xl border border-brivent-100 p-5 space-y-3">
            <div className="flex items-center gap-2 text-brivent-900">
              <FileText className="w-5 h-5 text-brivent-600" />
              <h4 className="text-sm font-bold">Standard Operating Procedures</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Access the Brivent Code of Conduct, engineering review standards, and team guidelines.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs bg-white text-brivent-700 border-brivent-200 hover:bg-brivent-50"
              onClick={() => setActiveTab('docs')}
            >
              Browse Knowledge Base →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

