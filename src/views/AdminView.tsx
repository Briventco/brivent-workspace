import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import { User, UserRole, UserStatus } from '../types';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import {
  ShieldAlert,
  UserPlus,
  UserX,
  History,
  KeyRound,
  ExternalLink,
  Lock,
  Building,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const { currentUser, showToast, hasPermission } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'users' | 'invites' | 'roles' | 'audit'>('users');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isOffboardModalOpen, setIsOffboardModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('TEAM_MEMBER');
  const [inviteDept, setInviteDept] = useState('dept-eng');

  // Offboarding checklist state
  const [offboardChecklist, setOffboardChecklist] = useState({
    workspaceSuspended: false,
    sessionsRevoked: false,
    githubRevoked: false,
    googleWorkspaceRevoked: false,
    whatsappRemoved: false,
    tasksReassigned: false,
  });

  const [refreshTick, setRefreshTick] = useState(0);

  const users = workspaceService.getUsers();
  const invitations = workspaceService.getInvitations();
  const auditLogs = workspaceService.getAuditLogs();
  const departments = workspaceService.getDepartments();

  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  // Permission guard
  if (!hasPermission('INVITE_USERS') && !isSuperAdmin) {
    return (
      <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 p-8 max-w-lg mx-auto space-y-3">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          The Administration & Security Audit portal is restricted to Super Administrators and authorized Operations personnel.
        </p>
      </div>
    );
  }

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;

    workspaceService.inviteUser({
      email: inviteEmail.trim(),
      fullName: inviteName.trim(),
      role: inviteRole,
      departmentId: inviteDept,
    });

    showToast(`Invitation generated for ${inviteEmail}. Valid for 48 hours.`);
    setInviteEmail('');
    setInviteName('');
    setIsInviteModalOpen(false);
    setRefreshTick((t) => t + 1);
  };

  const handleRevokeSessions = (user: User) => {
    if (confirm(`Kill all active sessions and refresh tokens for ${user.name}?`)) {
      workspaceService.revokeUserSessions(user.id);
      showToast(`Active sessions for ${user.email} were revoked.`);
      setRefreshTick((t) => t + 1);
    }
  };

  const handleToggleSuspend = (user: User) => {
    const nextStatus: UserStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    workspaceService.updateUserStatus(user.id, nextStatus);
    showToast(`Account status for ${user.name} changed to ${nextStatus}.`);
    setRefreshTick((t) => t + 1);
  };

  const handleStartOffboarding = (user: User) => {
    setTargetUser(user);
    setOffboardChecklist({
      workspaceSuspended: false,
      sessionsRevoked: false,
      githubRevoked: false,
      googleWorkspaceRevoked: false,
      whatsappRemoved: false,
      tasksReassigned: false,
    });
    setIsOffboardModalOpen(true);
  };

  const handleCompleteOffboarding = () => {
    if (!targetUser) return;
    workspaceService.updateUserStatus(targetUser.id, 'OFFBOARDED');
    workspaceService.revokeUserSessions(targetUser.id);
    showToast(`Offboarding process for ${targetUser.name} completed and logged.`);
    setIsOffboardModalOpen(false);
    setTargetUser(null);
    setRefreshTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            Organisation Administration & Governance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Member provisioning, RBAC matrix, session revocation, offboarding checklist, and immutable audit trails.
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsInviteModalOpen(true)}
          leftIcon={<UserPlus className="w-4 h-4" />}
        >
          Invite Team Member
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'users' ? 'bg-brivent-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Members ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'invites' ? 'bg-brivent-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Pending Invitations ({invitations.filter((i) => i.status === 'PENDING').length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'roles' ? 'bg-brivent-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          RBAC Permissions Matrix
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'audit' ? 'bg-brivent-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Immutable Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: Member Management */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Member Name & Email</th>
                  <th className="py-3 px-4">Role & Privilege</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Security Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{user.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{user.roleTitle}</span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      {user.departmentName}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Badge
                        variant={
                          user.status === 'ACTIVE'
                            ? 'success'
                            : user.status === 'SUSPENDED'
                            ? 'warning'
                            : 'danger'
                        }
                        size="sm"
                      >
                        {user.status}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px] px-2 py-1"
                        onClick={() => handleRevokeSessions(user)}
                        title="Kill active session JWTs immediately"
                      >
                        <KeyRound className="w-3 h-3 mr-1" />
                        Kill Sessions
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className={`text-[11px] px-2 py-1 ${
                          user.status === 'SUSPENDED'
                            ? 'text-emerald-700 border-emerald-300'
                            : 'text-amber-700 border-amber-300'
                        }`}
                        onClick={() => handleToggleSuspend(user)}
                      >
                        {user.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                      </Button>

                      <Button
                        size="sm"
                        variant="danger"
                        className="text-[11px] px-2 py-1"
                        onClick={() => handleStartOffboarding(user)}
                      >
                        <UserX className="w-3 h-3 mr-1" />
                        Offboard
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Pending Invitations */}
      {activeTab === 'invites' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invitee Details</th>
                  <th className="py-3 px-4">Assigned Role & Dept</th>
                  <th className="py-3 px-4">Invited By</th>
                  <th className="py-3 px-4">Status & Expiration</th>
                  <th className="py-3 px-4 text-right">Invitation Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{inv.fullName}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{inv.email}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{inv.role}</p>
                      <p className="text-[11px] text-slate-500">{inv.departmentName}</p>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">{inv.inviterName}</td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={inv.status === 'PENDING' ? 'warning' : 'success'}
                        size="sm"
                      >
                        {inv.status}
                      </Badge>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(
                            `${window.location.origin}/invite?token=${inv.token}`
                          );
                          showToast('Secure activation link copied to clipboard.');
                        }}
                        className="text-xs text-brivent-600 hover:text-brivent-700 font-bold"
                      >
                        Copy Link
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RBAC Matrix */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900">
            Role-Based Access Control (RBAC) Governance Matrix
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Permissions are validated on the backend API layer. Interns and trainees receive restricted least-privilege permissions by design.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Capability / Resource</th>
                  <th className="p-3 text-center">Super Admin</th>
                  <th className="p-3 text-center">Management</th>
                  <th className="p-3 text-center">Department Lead</th>
                  <th className="p-3 text-center">Operations</th>
                  <th className="p-3 text-center">Team Member</th>
                  <th className="p-3 text-center">Intern / Trainee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Org Settings & Audit Logs</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Invite & Offboard Users</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Kill Active Sessions (JWT)</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Create & Assign Tasks</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Review & Approve Task Signoff</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-slate-900">Access Confidential Finance Docs</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">✅</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                  <td className="p-3 text-center text-slate-300">❌</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Immutable Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Immutable Security Audit Trail</h3>
              <p className="text-[11px] text-slate-500">
                Tamper-evident logs of administrative actions, invitations, session revocations, and approvals.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">Total events: {auditLogs.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp & IP</th>
                  <th className="py-3 px-4">Action Event</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Target Resource</th>
                  <th className="py-3 px-4">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                      <div className="text-[10px] text-slate-400">{log.ipAddress}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-200">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-800 font-medium">
                      {log.actorName} ({log.actorRole.slice(0, 3)})
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {log.targetResource}
                    </td>

                    <td className="py-3 px-4 text-slate-700 max-w-sm font-sans text-xs">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite New Team Member"
        description="Generates a cryptographically signed 48-hour onboarding invitation link."
        maxWidth="md"
      >
        <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Work Email Address *
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="e.g. name@brivent.com"
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-brivent-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Full Legal Name *
            </label>
            <input
              type="text"
              required
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="e.g. Victor Okafor"
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-brivent-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Role & Access Level
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white"
            >
              <option value="TEAM_MEMBER">Team Member (General)</option>
              <option value="DEPARTMENT_LEAD">Department / Team Lead</option>
              <option value="OPERATIONS">Operations</option>
              <option value="FINANCE">Finance</option>
              <option value="SALES">Sales & Business Dev</option>
              <option value="SUPPORT">Customer Support</option>
              <option value="INTERN">Intern (Restricted)</option>
              <option value="TRAINEE">Trainee (Restricted)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Department
            </label>
            <select
              value={inviteDept}
              onChange={(e) => setInviteDept(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 bg-white"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Generate Invitation Token
            </Button>
          </div>
        </form>
      </Modal>

      {/* Offboarding & Session Revocation Checklist Modal */}
      {targetUser && (
        <Modal
          isOpen={isOffboardModalOpen}
          onClose={() => setIsOffboardModalOpen(false)}
          title={`Offboard Member: ${targetUser.name}`}
          description={`Comprehensive access revocation checklist for ${targetUser.email}.`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
              <p className="font-bold">Critical Offboarding Requirement</p>
              <p>
                Disabling a Brivent Workspace account does not automatically revoke access to GitHub, Google Workspace, Providus Bank portal, or WhatsApp groups. Complete each external step below.
              </p>
            </div>

            <div className="space-y-2.5">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardChecklist.workspaceSuspended}
                  onChange={(e) =>
                    setOffboardChecklist({
                      ...offboardChecklist,
                      workspaceSuspended: e.target.checked,
                    })
                  }
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-800">
                  Suspend Workspace account & mark status as OFFBOARDED
                </span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardChecklist.sessionsRevoked}
                  onChange={(e) =>
                    setOffboardChecklist({
                      ...offboardChecklist,
                      sessionsRevoked: e.target.checked,
                    })
                  }
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-800">
                  Immediately kill all active JWT sessions and refresh tokens in Redis
                </span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardChecklist.githubRevoked}
                  onChange={(e) =>
                    setOffboardChecklist({
                      ...offboardChecklist,
                      githubRevoked: e.target.checked,
                    })
                  }
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-800">
                  Remove from GitHub Briventco organization & revoke repository write keys
                </span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardChecklist.googleWorkspaceRevoked}
                  onChange={(e) =>
                    setOffboardChecklist({
                      ...offboardChecklist,
                      googleWorkspaceRevoked: e.target.checked,
                    })
                  }
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-800">
                  Suspend Google Workspace email and transfer Google Drive documents
                </span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardChecklist.whatsappRemoved}
                  onChange={(e) =>
                    setOffboardChecklist({
                      ...offboardChecklist,
                      whatsappRemoved: e.target.checked,
                    })
                  }
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-800">
                  Remove phone number from official WhatsApp operational groups
                </span>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={offboardChecklist.tasksReassigned}
                  onChange={(e) =>
                    setOffboardChecklist({
                      ...offboardChecklist,
                      tasksReassigned: e.target.checked,
                    })
                  }
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                <span className="font-semibold text-slate-800">
                  Reassign pending tasks and project ownership to department lead
                </span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setIsOffboardModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleCompleteOffboarding}
                disabled={
                  !offboardChecklist.workspaceSuspended || !offboardChecklist.sessionsRevoked
                }
              >
                Sign Off Complete Offboarding
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

