import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

interface InviteAcceptanceViewProps {
  onAccountActivated: () => void;
  onGoToSignIn: () => void;
}

export const InviteAcceptanceView: React.FC<InviteAcceptanceViewProps> = ({
  onAccountActivated,
  onGoToSignIn,
}) => {
  const { showToast } = useWorkspace();
  const invitations = workspaceService.getInvitations();

  // Find pending invitation (or use first pending)
  const pendingInvite = invitations.find((i) => i.status === 'PENDING') || invitations[0];

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeGuidelines, setAgreeGuidelines] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreeGuidelines) {
      setError('You must acknowledge the Brivent Code of Conduct & 9 AM–5 PM work guidelines.');
      return;
    }

    setIsSubmitting(true);
    try {
      workspaceService.acceptInvitation(pendingInvite.token, password);
      showToast(`Welcome to Brivent Workspace, ${pendingInvite.fullName}!`);
      setIsSubmitting(false);
      onAccountActivated();
    } catch (err: any) {
      setError(err.message || 'Failed to activate invitation.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brivent-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl mx-auto shadow-lg">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          Activate Your Brivent Workspace Account
        </h2>
        <p className="text-xs text-slate-400">
          Official invitation verification & onboarding credentials setup
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-white/20 space-y-5">
          {/* Invitation Details Banner */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Invitee:</span>
              <span className="font-bold text-slate-900">{pendingInvite.fullName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Official Email:</span>
              <span className="font-mono text-slate-800">{pendingInvite.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Role Assigned:</span>
              <Badge variant="primary" size="sm">
                {pendingInvite.role}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Department:</span>
              <span className="font-semibold text-slate-800">{pendingInvite.departmentName}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px] text-slate-400">
              <span>Token: {pendingInvite.token.slice(0, 14)}...</span>
              <span>Expires in 48 hours</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleActivate} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Create Secure Password *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters..."
                className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brivent-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm Password *
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password..."
                className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brivent-500"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeGuidelines}
                  onChange={(e) => setAgreeGuidelines(e.target.checked)}
                  className="rounded text-brivent-600 focus:ring-brivent-500 mt-0.5"
                />
                <span className="text-[11px] text-slate-600 leading-snug">
                  I agree to adhere to the Brivent Code of Conduct, respect confidential company information, and participate in the daily 9 AM–5 PM WAT work routine.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-sm font-semibold mt-2"
              isLoading={isSubmitting}
            >
              Activate Account & Enter Workspace
            </Button>
          </form>

          <div className="text-center pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onGoToSignIn}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Already activated your account? Sign in →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

