import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { mockUsers } from '../../data/mockData';
import { ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';

export const RoleSwitcherBanner: React.FC = () => {
  const { currentUser, switchUser } = useWorkspace();

  const isIntern = currentUser.role === 'INTERN' || currentUser.role === 'TRAINEE';
  const isAdmin = currentUser.role === 'SUPER_ADMIN';

  return (
    <div className="bg-slate-900 text-slate-200 px-4 py-2 border-b border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 shadow-inner">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-brivent-400 bg-brivent-950/80 px-2 py-0.5 rounded border border-brivent-800/80">
          <ShieldCheck className="w-3.5 h-3.5" />
          ROLE DEMO SWITCHER
        </span>
        <span className="hidden sm:inline text-slate-400">
          Test role-based access control (RBAC), UI views, and confidential permissions:
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-800/90 rounded-lg p-0.5 border border-slate-700">
          {mockUsers.map((user) => {
            const isSelected = user.id === currentUser.id;
            return (
              <button
                key={user.id}
                onClick={() => switchUser(user.id)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-brivent-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
                title={`${user.name} • ${user.roleTitle} (${user.departmentName})`}
              >
                {user.name.split(' ')[0]} ({user.role.slice(0, 3)})
              </button>
            );
          })}
        </div>

        {isIntern && (
          <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-950/60 border border-amber-800/70 px-2 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" />
            Intern: Restricted Permissions
          </span>
        )}

        {isAdmin && (
          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/60 border border-emerald-800/70 px-2 py-0.5 rounded">
            <UserCheck className="w-3 h-3" />
            Super Admin: Full Governance
          </span>
        )}
      </div>
    </div>
  );
};

