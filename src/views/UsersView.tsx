import React, { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Power, UserPlus, Users } from 'lucide-react';
import { errorMessage } from '../api/client';
import { ROLE_LABELS, User } from '../api/types';
import {
  deactivateUser,
  listUsers,
  reactivateUser,
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
import { AddUserModal } from '../components/users/AddUserModal';
import { EditUserModal } from '../components/users/EditUserModal';
import { useAuth, useSession } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PERMISSIONS } from '../lib/permissions';
import { useApiQuery } from '../lib/useApiQuery';

export const UsersView: React.FC = () => {
  const { refresh } = useAuth();
  const { user: currentUser, hasPermission } = useSession();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const query = useApiQuery<UsersPage>((signal) => listUsers(page, signal), [page]);

  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [statusTarget, setStatusTarget] = useState<User | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const canCreate = hasPermission(PERMISSIONS.USERS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.USERS_UPDATE);
  const canDeactivate = hasPermission(PERMISSIONS.USERS_DEACTIVATE);
  const canAssignSuperAdmin = hasPermission(PERMISSIONS.USERS_ASSIGN_SUPER_ADMIN);

  const canManage = (user: User) => user.role !== 'SUPER_ADMIN' || canAssignSuperAdmin;

  const isDeactivating = statusTarget?.status === 'ACTIVE';

  const handleStatusChange = async () => {
    if (!statusTarget) return;
    setIsChangingStatus(true);
    try {
      if (isDeactivating) {
        await deactivateUser(statusTarget.id);
        toast.success(`${statusTarget.fullName} has been deactivated.`);
      } else {
        await reactivateUser(statusTarget.id);
        toast.success(`${statusTarget.fullName} has been reactivated.`);
      }
      query.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsChangingStatus(false);
      setStatusTarget(null);
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
                    <th scope="col" className="px-5 py-3 font-medium hidden md:table-cell">Added</th>
                    <th scope="col" className="px-5 py-3 font-medium text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((user) => {
                    const isSelf = user.id === currentUser.id;
                    const isActive = user.status === 'ACTIVE';
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
                            <Badge variant={isActive ? 'success' : 'neutral'} size="sm" dot>
                              {isActive ? 'Active' : 'Deactivated'}
                            </Badge>
                            {isActive && user.mustChangePassword && (
                              <span className="text-xs text-slate-600 whitespace-nowrap">
                                Temporary password
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-700 whitespace-nowrap hidden md:table-cell">
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
                                leftIcon={<Pencil className="w-4 h-4" aria-hidden="true" />}
                              >
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                            )}
                            {canDeactivate && canManage(user) && !isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStatusTarget(user)}
                                aria-label={`${isActive ? 'Deactivate' : 'Reactivate'} ${user.fullName}`}
                                leftIcon={<Power className="w-4 h-4" aria-hidden="true" />}
                              >
                                <span className="hidden sm:inline">
                                  {isActive ? 'Deactivate' : 'Reactivate'}
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

            {total > USERS_PAGE_SIZE && (
              <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
                <span>
                  Page {page} of {Math.ceil(total / USERS_PAGE_SIZE)}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * USERS_PAGE_SIZE >= total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
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

      <ConfirmDialog
        isOpen={statusTarget !== null}
        title={isDeactivating ? 'Deactivate user?' : 'Reactivate user?'}
        description={
          isDeactivating
            ? `${statusTarget?.fullName} will be signed out immediately and won't be able to sign in.`
            : `${statusTarget?.fullName} will be able to sign in again.`
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
