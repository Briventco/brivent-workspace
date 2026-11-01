import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { mockUsers } from '../data/mockData';
import { Button } from '../components/ui/Button';

interface SignInViewProps {
  onSignedIn: () => void;
  onGoToInvite: () => void;
}

export const SignInView: React.FC<SignInViewProps> = ({
  onSignedIn,
  onGoToInvite,
}) => {
  const { switchUser } = useWorkspace();
  const [email, setEmail] = useState('emeka.okonkwo@brivent.com');
  const [password, setPassword] = useState('••••••••••••');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const found = mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (found) {
        switchUser(found.id);
      } else {
        switchUser('user-eng-lead');
      }
      setIsLoading(false);
      onSignedIn();
    }, 400);
  };

  const handleQuickDemoLogin = (userId: string) => {
    switchUser(userId);
    onSignedIn();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brivent-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-brivent-600 text-white flex items-center justify-center font-black text-xl mx-auto shadow-lg shadow-brivent-600/30">
          B
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Brivent Workspace
        </h2>
        <p className="text-xs text-slate-400">
          Central platform for Brivent Global Innovations Limited
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-3xl border border-white/20 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Work Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brivent-500/20 focus:border-brivent-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] text-brivent-600 hover:text-brivent-700 cursor-pointer">
                  Forgot?
                </span>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brivent-500/20 focus:border-brivent-500"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-sm font-semibold"
              isLoading={isLoading}
            >
              Sign In to Workspace
            </Button>
          </form>

          {/* Quick Demo Switcher Presets */}
          <div className="pt-4 border-t border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
              Instant Demo Personas
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('user-admin')}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
              >
                <p className="font-bold text-slate-800">Super Admin</p>
                <p className="text-[10px] text-slate-500">Dr. Babatunde</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('user-eng-lead')}
                className="p-2 rounded-lg border border-brivent-200 bg-brivent-50 text-left transition-colors"
              >
                <p className="font-bold text-brivent-900">Engineering Lead</p>
                <p className="text-[10px] text-brivent-600">Emeka Okonkwo</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('user-intern-dev')}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
              >
                <p className="font-bold text-slate-800">Intern (Restricted)</p>
                <p className="text-[10px] text-slate-500">Samuel Kalu</p>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('user-ops-lead')}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
              >
                <p className="font-bold text-slate-800">Operations Lead</p>
                <p className="text-[10px] text-slate-500">Ibrahim Musa</p>
              </button>
            </div>
          </div>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onGoToInvite}
              className="text-xs text-brivent-600 hover:text-brivent-700 font-semibold"
            >
              Have a 48-hour invitation token? Activate Account →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

