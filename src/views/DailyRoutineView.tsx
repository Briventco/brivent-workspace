import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { workspaceService } from '../services/workspaceService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Plus,
  Trash2,
  Sparkles,
  Calendar,
  Users,
} from 'lucide-react';

export const DailyRoutineView: React.FC = () => {
  const { currentUser, showToast } = useWorkspace();
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);

  // Form states
  const [todayPlanItems, setTodayPlanItems] = useState<string[]>(['']);
  const [yesterdayCompletedItems, setYesterdayCompletedItems] = useState<string[]>(['']);
  const [blockers, setBlockers] = useState('');
  const [assistanceNeeded, setAssistanceNeeded] = useState('');

  const [refreshTick, setRefreshTick] = useState(0);

  const checkIns = workspaceService.getDailyCheckIns();
  const todayStr = new Date().toISOString().split('T')[0];

  const myTodayCheckIn = checkIns.find(
    (c) => c.userId === currentUser.id && c.date === todayStr
  );

  const handleAddTodayItem = () => setTodayPlanItems([...todayPlanItems, '']);
  const handleRemoveTodayItem = (i: number) =>
    setTodayPlanItems(todayPlanItems.filter((_, idx) => idx !== i));
  const handleChangeTodayItem = (i: number, val: string) => {
    const next = [...todayPlanItems];
    next[i] = val;
    setTodayPlanItems(next);
  };

  const handleAddYesterdayItem = () => setYesterdayCompletedItems([...yesterdayCompletedItems, '']);
  const handleRemoveYesterdayItem = (i: number) =>
    setYesterdayCompletedItems(yesterdayCompletedItems.filter((_, idx) => idx !== i));
  const handleChangeYesterdayItem = (i: number, val: string) => {
    const next = [...yesterdayCompletedItems];
    next[i] = val;
    setYesterdayCompletedItems(next);
  };

  const handleSubmitCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    const validPlan = todayPlanItems.filter((p) => p.trim().length > 0);
    const validYesterday = yesterdayCompletedItems.filter((p) => p.trim().length > 0);

    if (validPlan.length === 0) {
      alert('Please state at least one priority you plan to work on today.');
      return;
    }

    workspaceService.submitDailyCheckIn({
      todayPlan: validPlan,
      yesterdayCompleted: validYesterday,
      blockers: blockers.trim(),
      assistanceNeeded: assistanceNeeded.trim(),
    });

    showToast('Daily Standup check-in submitted successfully!');
    setIsCheckInModalOpen(false);
    setRefreshTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Daily Work & 9 AM–5 PM Standup Routine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Default schedule: 9:00 AM – 5:00 PM West Africa Time (WAT).
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsCheckInModalOpen(true)}
          leftIcon={<Sparkles className="w-4 h-4" />}
        >
          {myTodayCheckIn ? 'Update Today\'s Standup' : 'Submit Daily Check-in'}
        </Button>
      </div>

      {/* Routine Guide Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-2 text-brivent-600 font-bold text-xs uppercase tracking-wider">
            <span className="w-5 h-5 rounded-full bg-brivent-50 text-brivent-600 flex items-center justify-center text-[10px]">
              1
            </span>
            Start of Day (9:00 AM)
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Review assigned tasks, submit your daily standup, confirm today's priorities, and declare immediate blockers.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
            <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px]">
              2
            </span>
            During Workday
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Execute focused work, keep task statuses accurate, communicate obstacles early, and attend scheduled syncs.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
            <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px]">
              3
            </span>
            End of Day (5:00 PM)
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Submit completed work for review, record progress on in-flight tasks, and carry forward unresolved items.
          </p>
        </div>
      </div>

      {/* Today's Team Standup Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-brivent-600" />
            Today's Team Check-ins ({todayStr})
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {checkIns.length} submitted today
          </span>
        </div>

        <div className="space-y-4">
          {checkIns.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4"
            >
              {/* Check-in user header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <img
                    src={item.userAvatar}
                    alt={item.userName}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{item.userName}</h4>
                    <p className="text-[11px] text-slate-500">{item.departmentName}</p>
                  </div>
                </div>

                <div className="text-right">
                  <Badge variant="success" size="sm">
                    {item.status}
                  </Badge>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    {item.timeSubmitted}
                  </p>
                </div>
              </div>

              {/* Today's plan & yesterday's completed */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Plan */}
                <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-2">
                  <span className="text-[10px] font-bold text-brivent-700 uppercase tracking-wider block">
                    🎯 What I plan to work on today:
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-800">
                    {item.todayPlan.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>

                {/* Yesterday */}
                <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    ✅ What I completed yesterday:
                  </span>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-800">
                    {item.yesterdayCompleted.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Blockers & Assistance */}
              {(item.blockers !== 'None' || item.assistanceNeeded !== 'None') && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1">
                  {item.blockers !== 'None' && (
                    <p className="text-amber-900">
                      <strong className="text-amber-950 font-bold">⚠️ Blocker:</strong>{' '}
                      {item.blockers}
                    </p>
                  )}
                  {item.assistanceNeeded !== 'None' && (
                    <p className="text-amber-900">
                      <strong className="text-amber-950 font-bold">🤝 Assistance needed:</strong>{' '}
                      {item.assistanceNeeded}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Daily Check-in Form Modal */}
      <Modal
        isOpen={isCheckInModalOpen}
        onClose={() => setIsCheckInModalOpen(false)}
        title="Daily Standup Check-in"
        description="Share what you plan to accomplish today and highlight blockers requiring attention."
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitCheckIn} className="space-y-5 text-xs">
          {/* Today Plan */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700 uppercase tracking-wider">
                What do you plan to work on today? *
              </label>
              <button
                type="button"
                onClick={handleAddTodayItem}
                className="text-brivent-600 hover:text-brivent-700 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {todayPlanItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    required={idx === 0}
                    value={item}
                    onChange={(e) => handleChangeTodayItem(idx, e.target.value)}
                    placeholder={`Priority task ${idx + 1}`}
                    className="flex-1 text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-brivent-500"
                  />
                  {todayPlanItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTodayItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Yesterday Completed */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-bold text-slate-700 uppercase tracking-wider">
                What did you complete yesterday?
              </label>
              <button
                type="button"
                onClick={handleAddYesterdayItem}
                className="text-brivent-600 hover:text-brivent-700 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {yesterdayCompletedItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleChangeYesterdayItem(idx, e.target.value)}
                    placeholder={`Completed deliverable ${idx + 1}`}
                    className="flex-1 text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-brivent-500"
                  />
                  {yesterdayCompletedItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveYesterdayItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Blockers */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Is anything currently blocking your progress?
            </label>
            <textarea
              rows={2}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="e.g. Waiting on API credentials, awaiting design review, server downtime (Leave blank if none)..."
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-brivent-500"
            />
          </div>

          {/* Assistance Needed */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              What assistance do you need from teammates or leads?
            </label>
            <textarea
              rows={2}
              value={assistanceNeeded}
              onChange={(e) => setAssistanceNeeded(e.target.value)}
              placeholder="e.g. Need code review from Tariq, or clarification from Operations..."
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-brivent-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsCheckInModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Submit Standup
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

