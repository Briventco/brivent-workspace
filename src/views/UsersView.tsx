import React, { useState } from 'react';
import { format } from 'date-fns';
import { errorMessage } from '../api/client';
import { removeUserAvatar } from '../api/avatars';
import { listDepartments } from '../api/departments';
import { User } from '../api/types';
import {
  deactivateUser,
  EmailedLinkResult,
  listUsers,
  listUsersWithoutDepartment,
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
import { Menu, MenuItem } from '../components/ui/Menu';
import { Pagination } from '../components/ui/Pagination';
import { Table, TableRow } from '../components/ui/Table';
import { AddUserModal } from '../components/users/AddUserModal';
import { EditUserModal } from '../components/users/EditUserModal';
import { EmailResultModal } from '../components/users/EmailResultModal';
import { ResetPasswordModal } from '../components/users/ResetPasswordModal';
import { Select } from '../components/ui/Select';
import { useAuth, useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { navigate, useSearch } from '../lib/router';
import { useApiQuery } from '../lib/useApiQuery';

const NO_DEPARTMENT = 'none';

export const UsersView: React.FC = () => {
  const { refresh } = useAuth();
  const { user: currentUser, can } = useSession();
  const toast = useToast();

  const search = useSearch();
  const department = new URLSearchParams(search).get('department') ?? '';
  const isMissingDepartment = department === NO_DEPARTMENT;

  const [page, setPage] = useState(1);
  const query = useApiQuery<UsersPage>(
    (signal) =>
      isMissingDepartment
        ? listUsersWithoutDepartment(signal).then((users) => ({ users, total: users.length }))
        : listUsers(page, department, signal),
    [page, department],
    'users',
  );
  const departments = useApiQuery((signal) => listDepartments(signal), [], 'departments');
  const departmentFilter = [
    { value: '', label: 'All departments' },
    { value: NO_DEPARTMENT, label: 'Active, no department' },
    ...(departments.data ?? []).map(({ id, name }) => ({ value: id, label: name })),
  ];

  const chooseDepartment = (value: string) => {
    setPage(1);
    navigate(value ? `/users?department=${value}` : '/users', { replace: true });
  };

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [statusTarget, setStatusTarget] = useState<User | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendResult, setResendResult] = useState<EmailedLinkResult | null>(null);
  const [pictureTarget, setPictureTarget] = useState<User | null>(null);
  const [isRemovingPicture, setIsRemovingPicture] = useState(false);

  const canCreate = can('inviteUser');
  const canUpdate = can('updateUser');
  const canDeactivate = can('deactivateUser');
  const canAssignSuperAdmin = can('assignSuperAdmin');
  const canResetPassword = can('resetUserPassword');
  const canResendInvite = can('resendInvite');

  const canManage = (user: User) => user.role !== 'SUPER_ADMIN' || canAssignSuperAdmin;

  const isDeactivating = statusTarget?.status !== 'DEACTIVATED';

  /** What sits behind "...". Resend and Reactivate stay visible as buttons, as the design shows. */
  const menuFor = (user: User): MenuItem[] => {
    const isSelf = user.id === currentUser.id;
    const items: MenuItem[] = [];
    if (canUpdate && canManage(user)) {
      items.push({ label: 'Edit', icon: 'edit', onSelect: () => setEditing(user) });
    }
    if (can('removeAvatar') && user.avatar) {
      items.push({ label: 'Remove picture', icon: 'person', onSelect: () => setPictureTarget(user) });
    }
    if (canResetPassword && !isSelf && user.status === 'ACTIVE') {
      items.push({ label: 'Reset password', icon: 'lock_reset', onSelect: () => setResetTarget(user) });
    }
    if (canDeactivate && canManage(user) && !isSelf && user.status !== 'DEACTIVATED') {
      items.push({
        label: 'Deactivate',
        icon: 'person_off',
        tone: 'danger',
        separated: items.length > 0,
        onSelect: () => setStatusTarget(user),
      });
    }
    return items;
  };

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

  const handleRemovePicture = async () => {
    if (!pictureTarget) return;
    setIsRemovingPicture(true);
    try {
      await removeUserAvatar(pictureTarget.id);
      toast.success(`${pictureTarget.fullName}'s picture has been removed.`);
      query.reload();
      if (pictureTarget.id === currentUser.id) {
        refresh().catch((error: unknown) => toast.error(errorMessage(error)));
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsRemovingPicture(false);
      setPictureTarget(null);
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
        description="Add people to the workspace and manage where they sit and what they can access."
        actions={
          canCreate && (
            <Button icon="person_add" onClick={() => setIsAdding(true)}>
              Invite user
            </Button>
          )
        }
      />

      <div className="mb-4 sm:max-w-[16rem]">
        <Select
          label="Department"
          value={department}
          options={departmentFilter}
          onChange={(e) => chooseDepartment(e.target.value)}
        />
      </div>

      <AsyncState
        query={query}
        loadingLabel="Loading users…"
        isEmpty={(data) => data.users.length === 0}
        empty={
          department ? (
            <EmptyState
              icon="groups"
              title={isMissingDepartment ? 'Everyone has a department' : 'Nobody here yet'}
              description={
                isMissingDepartment
                  ? 'All active people have been placed.'
                  : 'People you add to this department will appear here.'
              }
            />
          ) : (
            <EmptyState
              icon="groups"
              title="No users yet"
              description="People you add to the workspace will appear here."
            />
          )
        }
      >
        {({ users, total }) => (
          <div className="card overflow-hidden">
            <Table caption="Workspace users" className="table-pin-first">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Position</th>
                  <th scope="col">Access level</th>
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
                        <div className="flex items-center gap-3 w-[15rem] max-w-[60vw]">
                          <Avatar name={user.fullName} id={user.id} avatar={user.avatar} />
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
                        {/* What someone does, with where they sit underneath, as one column. */}
                        <span className="block truncate max-w-[13rem]">
                          {user.position?.name ?? 'No position'}
                        </span>
                        <span className="block truncate max-w-[13rem] text-small text-text-2">
                          {user.department?.name ?? 'No department'}
                        </span>
                      </td>
                      <td>
                        <RoleBadge role={user.role} />
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1 whitespace-nowrap">
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
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          {canResendInvite && user.status === 'PENDING' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleResend(user)}
                              isLoading={resendingId === user.id}
                              aria-label={`Resend invite to ${user.fullName}`}
                            >
                              Resend
                            </Button>
                          )}
                          {canDeactivate && canManage(user) && !isSelf && isDeactivated && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setStatusTarget(user)}
                              aria-label={`Reactivate ${user.fullName}`}
                            >
                              Reactivate
                            </Button>
                          )}
                          {menuFor(user).length > 0 && (
                            <Menu label={`Actions for ${user.fullName}`} items={menuFor(user)} />
                          )}
                        </div>
                      </td>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>

            {!isMissingDepartment && (
              <Pagination page={page} pageSize={USERS_PAGE_SIZE} total={total} onChange={setPage} />
            )}
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
        isOpen={pictureTarget !== null}
        title="Remove their picture?"
        description={`${pictureTarget?.fullName}'s initials will show instead, everywhere they appear. They can upload a new one.`}
        confirmLabel="Remove picture"
        confirmVariant="danger"
        isLoading={isRemovingPicture}
        onConfirm={handleRemovePicture}
        onClose={() => setPictureTarget(null)}
      />

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
