import React, { useState } from 'react';
import { format } from 'date-fns';
import { KeyRound, Pencil, Power, Send, UserPlus, Users } from 'lucide-react';
import { errorMessage } from '../api/client';
import { ROLE_LABELS, User, UserStatus } from '../api/types';
import {
  deactivateUser,
  EmailedLinkResult,
  listUsers,
  reactivateUser,
  resendInvite,
  USERS_PAGE_SIZE,
  UsersPage,
} from '../api/users';
import { AsyncState } from '../components/ui/AsyncState';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { AddUserModal } from '../components/users/AddUserModal';
import { EditUserModal } from '../components/users/EditUserModal';
import { EmailResultModal } from '../components/users/EmailResultModal';
import { ResetPasswordModal } from '../components/users/ResetPasswordModal';
import { useAuth, useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PERMISSIONS } from '../lib/permissions';
import { useApiQuery } from '../lib/useApiQuery';

const STATUS_BADGES: Record<UserStatus, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  ACTIVE: { label: 'Active', variant: 'success' },
  DEACTIVATED: { label: 'Deactivated', variant: 'neutral' },
};

export const UsersView: React.FC = () => {
  const { refresh } = useAuth();
  const { user: currentUser, hasPermission } = useSession();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const query = useApiQuery<UsersPage>((signal) => listUsers(page, signal), [page]);

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [statusTarget, setStatusTarget] = useState<User | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<EmailedLinkResult | null>(null);

  const canCreate = hasPermission(PERMISSIONS.USERS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.USERS_UPDATE);
  const canDeactivate = hasPermission(PERMISSIONS.USERS_DEACTIVATE);
  const canAssignSuperAdmin = hasPermission(PERMISSIONS.USERS_ASSIGN_SUPER_ADMIN);
  const canResetPassword = hasPermission(PERMISSIONS.USERS_RESET_PASSWORD);
  const canResendInvite = hasPermission(PERMISSIONS.USERS_RESEND_INVITE);

  const canManage = (user: User) => user.role !== 'SUPER_ADMIN' || canAssignSuperAdmin;

  const isDeactivating = statusTarget?.status !== 'DEACTIVATED';

  const handleStatusChange = async () => {
    if (!statusTarget) return;
    setIsChangingStatus(true);
    try {
      if (isDeactivating) {
        await deactivateUser(statusTarget.id);
        toast.success(`${statusTarget.fullName} has been deactivated.`);
      } else {
        const { status } = await reactivateUser(statusTarget.id);
        toast.success(
          status === 'PENDING'
            ? `${statusTarget.fullName} is pending again. Resend their invite so they can join.`
            : `${statusTarget.fullName} has been reactivated.`,
        );
      }
      query.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsChangingStatus(false);
      setStatusTarget(null);
    }
  };

  const handleResend = async (user: User) => {
    setResendingId(user.id);
    try {
      setResendResult(await resendInvite(user.id));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setResendingId(null);
      query.reload();
    }
  };

  const handleSaved = (user: User) => {
    setEditing(null);
    query.reload();
    if (user.id === currentUser.id) {
      refresh().catch((error: unknown) => toast.error(errorMessage(error)));
    }
  };

  return (
    <>
      <PageHeader
        title="User Management"
        description="Add people to the workspace and manage their roles and access."
        actions={
          canCreate && (
            <Button
              onClick={() => setIsAdding(true)}
              leftIcon={<UserPlus className="w-4 h-4" aria-hidden="true" />}
            >
              Add user
            </Button>
          )
        }
      />

      <AsyncState
        query={query}
        loadingLabel="Loading users…"
        isEmpty={(data) => data.users.length === 0}
        empty={
          <EmptyState
            icon={<Users className="w-6 h-6" aria-hidden="true" />}
            title="No users yet"
            description="People you add to the workspace will appear here."
          />
        }
      >
        {({ users, total }) => (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Users table">
              <table className="w-full text-sm">
                <caption className="sr-only">Workspace users</caption>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                    <th scope="col" className="px-5 py-3 font-medium">Name</th>
                    <th scope="col" className="px-5 py-3 font-medium">Role</th>
                    <th scope="col" className="px-5 py-3 font-medium">Status</th>
                    <th scope="col" className="px-5 py-3 font-medium hidden 2xl:table-cell">Added</th>
                    <th scope="col" className="px-5 py-3 font-medium text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => {
                    const isSelf = user.id === currentUser.id;
                    const isActive = user.status === 'ACTIVE';
                    const isDeactivated = user.status === 'DEACTIVATED';
                    const badge = STATUS_BADGES[user.status];
                    return (
                      <tr key={user.id}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-[14rem]">
                            <Avatar name={user.fullName} />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">
                                {user.fullName}
                                {isSelf && <span className="font-normal text-slate-600"> (you)</span>}
                              </p>
                              <p className="text-slate-600 truncate">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-700 whitespace-nowrap">
                          {ROLE_LABELS[user.role]}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant={badge.variant} size="sm" dot>
                              {badge.label}
                            </Badge>
                            {isActive && user.mustChangePassword && (
                              <span className="text-xs text-slate-600 whitespace-nowrap">
                                Temporary password
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-700 whitespace-nowrap hidden 2xl:table-cell">
                          {format(new Date(user.createdAt), 'd MMM yyyy')}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canUpdate && canManage(user) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditing(user)}
                                aria-label={`Edit ${user.fullName}`}
                                title={`Edit ${user.fullName}`}
                                leftIcon={<Pencil className="w-4 h-4" aria-hidden="true" />}
                              >
                                <span className="hidden xl:inline whitespace-nowrap">Edit</span>
                              </Button>
                            )}
                            {canResendInvite && user.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResend(user)}
                                isLoading={resendingId === user.id}
                                aria-label={`Resend invite to ${user.fullName}`}
                                title={`Resend invite to ${user.fullName}`}
                                leftIcon={<Send className="w-4 h-4" aria-hidden="true" />}
                              >
                                <span className="hidden xl:inline whitespace-nowrap">Resend invite</span>
                              </Button>
                            )}
                            {canResetPassword && !isSelf && isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setResetTarget(user)}
                                aria-label={`Reset password for ${user.fullName}`}
                                title={`Reset password for ${user.fullName}`}
                                leftIcon={<KeyRound className="w-4 h-4" aria-hidden="true" />}
                              >
                                <span className="hidden xl:inline whitespace-nowrap">Reset password</span>
                              </Button>
                            )}
                            {canDeactivate && canManage(user) && !isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStatusTarget(user)}
                                aria-label={`${isDeactivated ? 'Reactivate' : 'Deactivate'} ${user.fullName}`}
                                title={`${isDeactivated ? 'Reactivate' : 'Deactivate'} ${user.fullName}`}
                                leftIcon={<Power className="w-4 h-4" aria-hidden="true" />}
                              >
                                <span className="hidden xl:inline whitespace-nowrap">
                                  {isDeactivated ? 'Reactivate' : 'Deactivate'}
                                </span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination page={page} pageSize={USERS_PAGE_SIZE} total={total} onChange={setPage} />
          </div>
        )}
      </AsyncState>

      {isAdding && (
        <AddUserModal
          canAssignSuperAdmin={canAssignSuperAdmin}
          onClose={() => setIsAdding(false)}
          onCreated={query.reload}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === currentUser.id}
          canAssignSuperAdmin={canAssignSuperAdmin}
          onClose={() => setEditing(null)}
          onSaved={() => handleSaved(editing)}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={query.reload}
        />
      )}

      {resendResult && (
        <EmailResultModal
          result={resendResult}
          sentTitle="Invite sent"
          sentMessage={`Invite sent to ${resendResult.user.email}. The link lasts 48 hours.`}
          failedMessage={`The invite to ${resendResult.user.email} failed. Their previous link no longer works.`}
          onClose={() => setResendResult(null)}
        />
      )}

      <ConfirmDialog
        isOpen={statusTarget !== null}
        title={isDeactivating ? 'Deactivate user?' : 'Reactivate user?'}
        description={
          isDeactivating
            ? `${statusTarget?.fullName} will be signed out immediately, any emailed link will stop working, and they won't be able to sign in.`
            : `${statusTarget?.fullName} will be able to sign in again. If they never set a password, you'll need to resend their invite.`
        }
        confirmLabel={isDeactivating ? 'Deactivate' : 'Reactivate'}
        confirmVariant={isDeactivating ? 'danger' : 'primary'}
        isLoading={isChangingStatus}
        onConfirm={handleStatusChange}
        onClose={() => setStatusTarget(null)}
      />
    </>
  );
};
