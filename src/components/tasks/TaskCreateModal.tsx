import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useWorkspace } from '../../context/WorkspaceContext';
import { workspaceService } from '../../services/workspaceService';
import { TaskPriority, TaskStatus } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const { currentUser, showToast } = useWorkspace();
  const users = workspaceService.getUsers();
  const projects = workspaceService.getProjects();
  const departments = workspaceService.getDepartments();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [departmentId, setDepartmentId] = useState(currentUser.departmentId || departments[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState(currentUser.id);
  const [reviewerId, setReviewerId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 3 * 86400 * 1000).toISOString().split('T')[0]
  );
  const [requiresReview, setRequiresReview] = useState(true);
  const [checklistItems, setChecklistItems] = useState<string[]>(['']);

  const [error, setError] = useState('');

  const handleAddChecklistItem = () => {
    setChecklistItems([...checklistItems, '']);
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const handleChecklistChange = (index: number, val: string) => {
    const next = [...checklistItems];
    next[index] = val;
    setChecklistItems(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    const assignee = users.find((u) => u.id === assigneeId);
    if (!assignee) {
      setError('Please assign this task to a team member.');
      return;
    }

    const project = projects.find((p) => p.id === projectId);
    const department = departments.find((d) => d.id === departmentId);
    const reviewer = users.find((u) => u.id === reviewerId);

    const validChecklist = checklistItems
      .filter((c) => c.trim().length > 0)
      .map((c, i) => ({
        id: `chk-${Date.now()}-${i}`,
        title: c.trim(),
        isCompleted: false,
      }));

    workspaceService.createTask({
      title: title.trim(),
      description: description.trim(),
      creatorId: currentUser.id,
      creatorName: currentUser.name,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      assigneeAvatar: assignee.avatarUrl,
      assigneeRole: assignee.jobTitle,
      reviewerId: reviewer?.id,
      reviewerName: reviewer?.name,
      reviewerAvatar: reviewer?.avatarUrl,
      projectId: project?.id || 'proj-workspace',
      projectName: project?.name || 'Brivent Workspace MVP',
      departmentId: department?.id || 'dept-eng',
      departmentName: department?.name || 'Engineering',
      departmentCode: department?.code || 'ENG',
      priority,
      status,
      startDate,
      dueDate,
      checklist: validChecklist,
      requiresReview,
    });

    showToast(`Task "${title}" created and assigned to ${assignee.name}`);
    onTaskCreated();
    onClose();

    // Reset form
    setTitle('');
    setDescription('');
    setChecklistItems(['']);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Workspace Task"
      description="Every task must have an explicit owner and measurable deliverable."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Task Title *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Implement OAuth session revocation endpoint"
            className="w-full text-sm rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brivent-500/20 focus:border-brivent-500 placeholder-slate-400"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Detailed Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Outline context, requirements, acceptance criteria, and relevant links..."
            className="w-full text-sm rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-brivent-500/20 focus:border-brivent-500 placeholder-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />

          <Select
            label="Department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Assignee (Task Owner) *"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            options={users.map((u) => ({
              value: u.id,
              label: `${u.name} (${u.jobTitle})`,
            }))}
          />

          <Select
            label="Designated Reviewer / Approver"
            value={reviewerId}
            onChange={(e) => setReviewerId(e.target.value)}
            options={[
              { value: '', label: 'None (Self-managed)' },
              ...users.map((u) => ({
                value: u.id,
                label: `${u.name} (${u.jobTitle})`,
              })),
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            options={[
              { value: 'LOW', label: 'Low' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HIGH', label: 'High' },
              { value: 'URGENT', label: 'Urgent 🔥' },
            ]}
          />

          <Input
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            type="date"
            label="Target Due Date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Checklist / Subtasks
            </label>
            <button
              type="button"
              onClick={handleAddChecklistItem}
              className="text-xs text-brivent-600 hover:text-brivent-700 font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add item
            </button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
            {checklistItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleChecklistChange(idx, e.target.value)}
                  placeholder={`Step ${idx + 1}`}
                  className="flex-1 text-xs rounded-lg border border-slate-300 p-2 focus:outline-none focus:ring-1 focus:ring-brivent-500"
                />
                {checklistItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveChecklistItem(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="req-review"
            checked={requiresReview}
            onChange={(e) => setRequiresReview(e.target.checked)}
            className="rounded border-slate-300 text-brivent-600 focus:ring-brivent-500"
          />
          <label htmlFor="req-review" className="text-xs text-slate-700 cursor-pointer">
            Requires Lead or Reviewer verification before marking complete.
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Create & Assign Task
          </Button>
        </div>
      </form>
    </Modal>
  );
};
