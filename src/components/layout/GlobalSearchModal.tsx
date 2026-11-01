import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { workspaceService } from '../../services/workspaceService';
import {
  Search,
  CheckSquare,
  FolderKanban,
  FileText,
  Users,
  ArrowRight,
  X,
  Lock,
} from 'lucide-react';
import { TaskStatusBadge } from '../tasks/TaskStatusBadge';
import { Badge } from '../ui/Badge';

export const GlobalSearchModal: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, setActiveTab } = useWorkspace();
  const [query, setQuery] = useState('');

  const tasks = workspaceService.getTasks();
  const projects = workspaceService.getProjects();
  const docs = workspaceService.getDocuments();
  const users = workspaceService.getUsers();

  const filteredResults = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();

    return {
      tasks: tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.assigneeName.toLowerCase().includes(q)
      ),
      projects: projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.departmentName.toLowerCase().includes(q)
      ),
      docs: docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.summary.toLowerCase().includes(q)
      ),
      users: users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.jobTitle.toLowerCase().includes(q) ||
          u.departmentName.toLowerCase().includes(q)
      ),
    };
  }, [query, tasks, projects, docs, users]);

  if (!isSearchOpen) return null;

  const handleSelect = (tab: string) => {
    setActiveTab(tab);
    setIsSearchOpen(false);
    setQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 sm:px-6">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={() => setIsSearchOpen(false)}
      />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 z-10 overflow-hidden transform transition-all">
        {/* Search Input Bar */}
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, policies, documents, colleagues..."
            className="w-full text-base bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {!query.trim() ? (
            <div className="py-8 text-center text-slate-400">
              <p className="text-sm font-medium">Quick Workspace Search</p>
              <p className="text-xs text-slate-500 mt-1">
                Type a task title, project name, SOP title, or teammate's name.
              </p>
            </div>
          ) : filteredResults ? (
            <>
              {/* Tasks */}
              {filteredResults.tasks.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-brivent-500" />
                    Tasks ({filteredResults.tasks.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredResults.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleSelect('tasks')}
                        className="p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-between border border-transparent hover:border-slate-200 transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {task.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            Assigned to {task.assigneeName} • {task.projectName}
                          </p>
                        </div>
                        <TaskStatusBadge status={task.status} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {filteredResults.projects.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-indigo-500" />
                    Projects ({filteredResults.projects.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredResults.projects.map((proj) => (
                      <div
                        key={proj.id}
                        onClick={() => handleSelect('projects')}
                        className="p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-between border border-transparent hover:border-slate-200 transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {proj.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {proj.departmentName} • {proj.progressPercentage}% completed
                          </p>
                        </div>
                        <Badge variant="primary" size="sm">
                          {proj.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Documents & SOPs */}
              {filteredResults.docs.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    Knowledge Base & Documents ({filteredResults.docs.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredResults.docs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => handleSelect('docs')}
                        className="p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-between border border-transparent hover:border-slate-200 transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                            {doc.title}
                            {doc.visibility === 'CONFIDENTIAL' && (
                              <Lock className="w-3 h-3 text-rose-500" />
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {doc.category} • {doc.version}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teammates */}
              {filteredResults.users.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-500" />
                    Team Directory ({filteredResults.users.length})
                  </h4>
                  <div className="space-y-1">
                    {filteredResults.users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleSelect('directory')}
                        className="p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer flex items-center justify-between border border-transparent hover:border-slate-200 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {user.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {user.jobTitle} • {user.departmentName}
                            </p>
                          </div>
                        </div>
                        <Badge variant="neutral" size="sm">
                          {user.roleTitle}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredResults.tasks.length === 0 &&
                filteredResults.projects.length === 0 &&
                filteredResults.docs.length === 0 &&
                filteredResults.users.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-sm">
                    No results found for "{query}".
                  </div>
                )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

