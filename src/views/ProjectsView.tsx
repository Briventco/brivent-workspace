import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import { Project, ProjectStatus, TaskPriority } from '../types';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import {
  FolderKanban,
  Plus,
  Calendar,
  CheckCircle2,
  Lock,
  Globe,
  Building,
  ExternalLink,
  Users,
  CheckSquare,
  GitBranch,
} from 'lucide-react';

export const ProjectsView: React.FC = () => {
  const { currentUser, setActiveTab, showToast, hasPermission } = useWorkspace();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'DEPARTMENT' | 'ORGANIZATION'>('ORGANIZATION');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [targetDate, setTargetDate] = useState(
    new Date(Date.now() + 30 * 86400 * 1000).toISOString().split('T')[0]
  );

  const projects = workspaceService.getProjects();
  const departments = workspaceService.getDepartments();

  const filteredProjects = projects.filter((p) => {
    if (filterStatus === 'ALL') return true;
    return p.status === filterStatus;
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    workspaceService.createProject({
      name: name.trim(),
      description: description.trim(),
      departmentId: currentUser.departmentId,
      departmentName: currentUser.departmentName,
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      ownerAvatar: currentUser.avatarUrl,
      visibility,
      status: 'ACTIVE',
      priority,
      startDate: new Date().toISOString().split('T')[0],
      targetDate,
    });

    showToast(`Project "${name}" created.`);
    setName('');
    setDescription('');
    setIsCreateOpen(false);
  };

  const getVisibilityBadge = (vis: Project['visibility']) => {
    switch (vis) {
      case 'ORGANIZATION':
        return (
          <Badge variant="primary" size="sm">
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" /> Org-Wide
            </span>
          </Badge>
        );
      case 'DEPARTMENT':
        return (
          <Badge variant="secondary" size="sm">
            <span className="flex items-center gap-1">
              <Building className="w-3 h-3" /> Department
            </span>
          </Badge>
        );
      case 'PRIVATE':
        return (
          <Badge variant="danger" size="sm">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3" /> Confidential
            </span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Projects & Initiatives
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinate initiatives, deliverables, milestones, and cross-departmental teams.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 py-1.5 px-3 bg-white text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PLANNING">Planning</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Project
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            onClick={() => setSelectedProject(project)}
            className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              {/* Header: Visibility & Department */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {project.departmentName}
                </span>
                {getVisibilityBadge(project.visibility)}
              </div>

              {/* Title & Description */}
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-brivent-600 transition-colors mb-2">
                {project.name}
              </h3>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                {project.description}
              </p>
            </div>

            <div className="space-y-4 pt-3 border-t border-slate-100">
              {/* Progress */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">Task Progress</span>
                  <span className="font-bold text-slate-900">
                    {project.progressPercentage}% ({project.tasksCompleted}/{project.tasksTotal})
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brivent-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${project.progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Milestones count and Members */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium">
                  <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                  {project.milestones.length} milestones
                </span>

                <div className="flex items-center -space-x-1.5">
                  {project.members.slice(0, 4).map((member) => (
                    <img
                      key={member.userId}
                      src={member.avatar}
                      alt={member.name}
                      title={member.name}
                      className="w-6 h-6 rounded-full object-cover ring-2 ring-white"
                    />
                  ))}
                  {project.members.length > 4 && (
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                      +{project.members.length - 4}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <Modal
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          title={selectedProject.name}
          description={`${selectedProject.departmentName} • Target: ${selectedProject.targetDate}`}
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            <div>
              <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Overview & Scope
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                {selectedProject.description}
              </p>
            </div>

            {/* Milestones */}
            <div>
              <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-2">
                Project Milestones
              </h4>
              <div className="space-y-2">
                {selectedProject.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
                    <span
                      className={`font-semibold ${
                        m.isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
                      }`}
                    >
                      {m.title}
                    </span>
                    <span className="text-slate-500 font-medium text-[11px]">
                      Due {m.dueDate}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* GitHub Repo link */}
            {selectedProject.githubRepo && (
              <div className="p-3 bg-slate-900 text-slate-200 rounded-xl flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-[11px]">
                  <GitBranch className="w-4 h-4 text-emerald-400" />
                  {selectedProject.githubRepo}
                </span>
                <a
                  href={selectedProject.githubRepo}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brivent-400 hover:text-white flex items-center gap-1 font-semibold"
                >
                  GitHub <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Members List */}
            <div>
              <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-2">
                Team Contributors ({selectedProject.members.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {selectedProject.members.map((member) => (
                  <div
                    key={member.userId}
                    className="p-2 rounded-lg border border-slate-100 bg-slate-50 flex items-center gap-2"
                  >
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{member.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{member.roleInProject}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedProject(null);
                  setActiveTab('tasks');
                }}
              >
                View Linked Tasks in Task Board
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedProject(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Project Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Project"
        description="Initiatives bring together tasks, milestones, discussions, and deliverables."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brivent Mobile Banking SDK"
              className="w-full text-sm rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-brivent-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description & Objectives
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State purpose, deliverable scope, and department coordination needs..."
              className="w-full text-sm rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-brivent-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Visibility Access
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white"
              >
                <option value="ORGANIZATION">Organization-Wide</option>
                <option value="DEPARTMENT">Department-Only</option>
                <option value="PRIVATE">Private / Restricted</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Completion Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Initialize Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

