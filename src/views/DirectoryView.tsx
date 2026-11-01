import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import { User } from '../types';
import { Drawer } from '../components/ui/Drawer';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Mail,
  Phone,
  Clock,
  Shield,
  Briefcase,
  UserCheck,
  Search,
  CheckSquare,
  MessageSquare,
} from 'lucide-react';

export const DirectoryView: React.FC = () => {
  const { currentUser, setActiveTab } = useWorkspace();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');

  const users = workspaceService.getUsers();
  const departments = workspaceService.getDepartments();

  const filteredUsers = users.filter((u) => {
    if (selectedDept !== 'ALL' && u.departmentId !== selectedDept) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.jobTitle.toLowerCase().includes(q) ||
        u.departmentName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getRoleBadgeVariant = (role: User['role']) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'danger';
      case 'MANAGEMENT':
      case 'DEPARTMENT_LEAD':
        return 'warning';
      case 'OPERATIONS':
        return 'secondary';
      case 'INTERN':
      case 'TRAINEE':
        return 'info';
      default:
        return 'primary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Brivent Team Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal directory of team members, departmental leads, managers, and roles.
          </p>
        </div>

        {/* Filter & Search */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team member..."
              className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brivent-500 bg-white"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 py-1.5 px-3 bg-white text-slate-700"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredUsers.map((user) => {
          const isMe = user.id === currentUser.id;

          return (
            <div
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group flex flex-col items-center text-center relative"
            >
              {isMe && (
                <span className="absolute top-3 right-3 text-[9px] font-bold bg-brivent-50 text-brivent-700 border border-brivent-200 px-1.5 py-0.5 rounded-full">
                  You
                </span>
              )}

              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-100 group-hover:ring-brivent-500 transition-all mb-3 shadow-xs"
              />

              <h3 className="text-sm font-bold text-slate-900 group-hover:text-brivent-600 transition-colors">
                {user.name}
              </h3>

              <p className="text-xs text-slate-600 font-medium mt-0.5">{user.jobTitle}</p>

              <p className="text-[11px] text-slate-400 mt-0.5">{user.departmentName}</p>

              <div className="mt-3">
                <Badge variant={getRoleBadgeVariant(user.role)} size="sm">
                  {user.roleTitle}
                </Badge>
              </div>

              <div className="w-full mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <Clock className="w-3 h-3 text-slate-400" />
                  WAT (9-5)
                </span>
                <span className="text-brivent-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                  Profile →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Member Profile Drawer */}
      {selectedUser && (
        <Drawer
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={selectedUser.name}
          subtitle={`${selectedUser.jobTitle} • ${selectedUser.departmentName}`}
          width="lg"
        >
          <div className="space-y-6">
            {/* Header Card */}
            <div className="p-6 bg-slate-50/70 rounded-2xl border border-slate-200 text-center space-y-3">
              <img
                src={selectedUser.avatarUrl}
                alt={selectedUser.name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-white mx-auto shadow-md"
              />
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedUser.name}</h3>
                <p className="text-xs text-slate-600 font-semibold">{selectedUser.jobTitle}</p>
                <p className="text-xs text-slate-500">{selectedUser.departmentName}</p>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <Badge variant={getRoleBadgeVariant(selectedUser.role)} size="md">
                  {selectedUser.roleTitle}
                </Badge>
                <Badge variant="success" size="md">
                  {selectedUser.status}
                </Badge>
              </div>
            </div>

            {/* Official Contact & Work Schedule Details */}
            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-slate-400 uppercase tracking-wider">
                Work Information
              </h4>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" /> Official Work Email
                </span>
                <span className="font-semibold text-slate-800">{selectedUser.email}</span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" /> Working Hours Schedule
                </span>
                <span className="font-semibold text-slate-800 font-mono">
                  {selectedUser.workingHours}
                </span>
              </div>

              {selectedUser.managerName && (
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-slate-400" /> Reporting Manager
                  </span>
                  <span className="font-semibold text-slate-800">{selectedUser.managerName}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-slate-400" /> Joined Brivent
                </span>
                <span className="font-semibold text-slate-800">{selectedUser.joinedDate}</span>
              </div>
            </div>

            {/* Privacy Notice regarding Personal Data */}
            <div className="p-3.5 bg-slate-100 rounded-xl text-[11px] text-slate-600 leading-relaxed border border-slate-200">
              <p className="font-semibold text-slate-800 mb-0.5">Privacy Notice</p>
              In accordance with Brivent employee privacy policies, personal home addresses and private banking records are not displayed in the team directory.
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedUser(null);
                  setActiveTab('messages');
                }}
              >
                Send Message
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedUser(null)}>
                Close Profile
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};

