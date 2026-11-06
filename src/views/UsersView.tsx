import React, { useState } from 'react';
import { format } from 'date-fns';
import { errorMessage } from '../api/client';
import { User } from '../api/types';
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
import { RoleBadge, UserStatusBadge } from '../components/ui/badges';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { Table, TableRow } from '../components/ui/Table';
import { AddUserModal } from '../components/users/AddUserModal';
import { EditUserModal } from '../components/users/EditUserModal';
import { EmailResultModal } from '../components/users/EmailResultModal';
import { ResetPasswordModal } from '../components/users/ResetPasswordModal';
import { useAuth, useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useApiQuery } from '../lib/useApiQuery';

export const UsersView: React.FC = () => {
  const { refresh } = useAuth();
  const { user: currentUser, can } = useSession();
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

  const canCreate = can('inviteUser');
  const canUpdate = can('updateUser');
  const canDeactivate = can('deactivateUser');
  const canAssignSuperAdmin = can('assignSuperAdmin');
  const canResetPassword = can('resetUserPassword');
  const canResendInvite = can('resendInvite');

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
            <Button icon="person_add" onClick={() => setIsAdding(true)}>
              Invite user
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
            icon="groups"
            title="No users yet"
            description="People you add to the workspace will appear here."
          />
        }
      >
        {({ users, total }) => (
          <div className="card overflow-hidden">
            <Table caption="Workspace users">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="hidden 2xl:table-cell">Added</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUser.id;
                  const isActive = user.status === 'ACTIVE';
                  const isDeactivated = user.status === 'DEACTIVATED';
                  return (
                    <TableRow key={user.id}>
                      <td>
                        <div className="flex items-center gap-3 min-w-[14rem]">
                          <Avatar name={user.fullName} id={user.id} />
                          <div className="min-w-0">
                            <p className="font-semibold truncate">
                              {user.fullName}
                              {isSelf && <span className="font-normal text-text-2"> (you)</span>}
                            </p>
                            <p className="text-small text-text-2 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <RoleBadge role={user.role} />
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <UserStatusBadge status={user.status} />
                          {isActive && user.mustChangePassword && (
                            <span className="text-caption text-text-3 whitespace-nowrap">
                              Temporary password
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-text-2 hidden 2xl:table-cell">
                        {format(new Date(user.createdAt), 'd MMM yyyy')}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && canManage(user) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="edit"
                              onClick={() => setEditing(user)}
                              aria-label={`Edit ${user.fullName}`}
                              title={`Edit ${user.fullName}`}
                            >
                              <span className="hidden xl:inline">Edit</span>
                            </Button>
                          )}
                          {canResendInvite && user.status === 'PENDING' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="forward_to_inbox"
                              onClick={() => handleResend(user)}
                              isLoading={resendingId === user.id}
                              aria-label={`Resend invite to ${user.fullName}`}
                              title={`Resend invite to ${user.fullName}`}
                            >
                              <span className="hidden xl:inline">Resend invite</span>
                            </Button>
                          )}
                          {canResetPassword && !isSelf && isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="lock_reset"
                              onClick={() => setResetTarget(user)}
                              aria-label={`Reset password for ${user.fullName}`}
                              title={`Reset password for ${user.fullName}`}
                            >
                              <span className="hidden xl:inline">Reset password</span>
                            </Button>
                          )}
                          {canDeactivate && canManage(user) && !isSelf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={isDeactivated ? 'person_check' : 'person_off'}
                              onClick={() => setStatusTarget(user)}
                              aria-label={`${isDeactivated ? 'Reactivate' : 'Deactivate'} ${user.fullName}`}
                              title={`${isDeactivated ? 'Reactivate' : 'Deactivate'} ${user.fullName}`}
                            >
                              <span className="hidden xl:inline">
                                {isDeactivated ? 'Reactivate' : 'Deactivate'}
                              </span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>

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
