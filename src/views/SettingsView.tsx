import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  Bell,
  MessageSquare,
  Shield,
  Smartphone,
  Clock,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { currentUser, showToast } = useWorkspace();

  const [whatsappOptIn, setWhatsappOptIn] = useState(currentUser.whatsappOptIn);
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phone || '+234 814 555 0192');
  const [quietHoursStart, setQuietHoursStart] = useState('21:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');

  const [prefTaskAssigned, setPrefTaskAssigned] = useState(true);
  const [prefReviewRequested, setPrefReviewRequested] = useState(true);
  const [prefDeadlineAlert, setPrefDeadlineAlert] = useState(true);
  const [prefMentions, setPrefMentions] = useState(true);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Notification channels & preferences saved.');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Settings & Notifications
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure in-app alert channels, working schedule preferences, and official WhatsApp integration.
        </p>
      </div>

      <form onSubmit={handleSavePreferences} className="space-y-6">
        {/* WhatsApp Business API Integration Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Official WhatsApp Notifications (Meta Business Platform)
                  <Badge variant="warning" size="sm">
                    Phase 3 Roadmap
                  </Badge>
                </h3>
                <p className="text-xs text-slate-500">
                  Receive automated task assignment alerts and urgent deadline warnings on your mobile device.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Explicit Pending Notice as mandated by PRD */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Architecture Boundary Note
            </div>
            <p className="leading-relaxed">
              In accordance with Brivent product architecture requirements, outbound WhatsApp messaging utilizes verified Meta Business Cloud API templates. The live webhook worker pipeline is queued for backend Phase 3 deployment. Settings saved here will bind to your phone profile upon gateway activation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Verified WhatsApp Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+234 800 000 0000"
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 font-mono bg-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">Format: International with country code (+234 for Nigeria)</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Quiet Hours (No outbound pings)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                  className="text-xs rounded-lg border border-slate-300 p-2 bg-white"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                  className="text-xs rounded-lg border border-slate-300 p-2 bg-white"
                />
                <span className="text-slate-500 font-mono text-[10px]">WAT</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Alerts queued during quiet hours deliver at 8:00 AM</p>
            </div>
          </div>

          {/* Approved Meta Template Preview */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Registered Message Template Preview
            </span>
            <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-800 font-sans shadow-2xs space-y-1">
              <p className="font-semibold text-brivent-700">Brivent Workspace Notification</p>
              <p>
                Hello {currentUser.name.split(' ')[0]}, you have a new task assigned to you in Brivent Workspace:
              </p>
              <p className="font-mono text-[11px] bg-slate-50 p-1.5 rounded border border-slate-100 text-slate-700">
                "Implement OAuth session revocation endpoint" • Due: Today 5:00 PM WAT
              </p>
              <p className="text-[11px] text-slate-500">
                Sign in to view details: https://workspace.brivent.com/tasks
              </p>
            </div>
          </div>
        </div>

        {/* In-App Notification Event Preferences */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-brivent-50 text-brivent-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                In-App Notification Trigger Preferences
              </h3>
              <p className="text-xs text-slate-500">
                Select which activity events generate in-app bell notifications.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs divide-y divide-slate-100">
            <label className="flex items-center justify-between pt-2 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-800">Task Assignments</p>
                <p className="text-[11px] text-slate-500">When someone assigns a new task to you</p>
              </div>
              <input
                type="checkbox"
                checked={prefTaskAssigned}
                onChange={(e) => setPrefTaskAssigned(e.target.checked)}
                className="rounded text-brivent-600 focus:ring-brivent-500 h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between pt-3 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-800">Task Review Requests</p>
                <p className="text-[11px] text-slate-500">When a team member submits work for your review</p>
              </div>
              <input
                type="checkbox"
                checked={prefReviewRequested}
                onChange={(e) => setPrefReviewRequested(e.target.checked)}
                className="rounded text-brivent-600 focus:ring-brivent-500 h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between pt-3 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-800">Approaching Deadlines</p>
                <p className="text-[11px] text-slate-500">Reminders on tasks due within 4 hours</p>
              </div>
              <input
                type="checkbox"
                checked={prefDeadlineAlert}
                onChange={(e) => setPrefDeadlineAlert(e.target.checked)}
                className="rounded text-brivent-600 focus:ring-brivent-500 h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between pt-3 cursor-pointer">
              <div>
                <p className="font-semibold text-slate-800">Mentions & Discussion Replies</p>
                <p className="text-[11px] text-slate-500">When a teammate comments on your assigned task</p>
              </div>
              <input
                type="checkbox"
                checked={prefMentions}
                onChange={(e) => setPrefMentions(e.target.checked)}
                className="rounded text-brivent-600 focus:ring-brivent-500 h-4 w-4"
              />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button type="submit" variant="primary">
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
};

