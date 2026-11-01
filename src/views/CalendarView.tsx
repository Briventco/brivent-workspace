import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  Calendar as CalendarIcon,
  Video,
  Clock,
  Users,
  ExternalLink,
  Plus,
  Sparkles,
} from 'lucide-react';

export const CalendarView: React.FC = () => {
  const { currentUser } = useWorkspace();

  const meetings = [
    {
      id: 'meet-1',
      title: 'Daily Engineering Standup & Sprint Sync',
      department: 'Engineering',
      time: '09:00 AM – 09:30 AM WAT',
      date: 'Today, Oct 27',
      meetUrl: 'https://meet.google.com/brivent-eng-sync',
      attendees: ['Emeka Okonkwo', 'Aisha Bello', 'Tariq Adeleke', 'Samuel Kalu'],
      agenda: 'Phase 1 MVP tasks check-in, blocker triage, and Safari WebKit overflow fix review.',
    },
    {
      id: 'meet-2',
      title: 'Operations Coordination & Onboarding Review',
      department: 'Operations',
      time: '02:00 PM – 02:45 PM WAT',
      date: 'Today, Oct 27',
      meetUrl: 'https://meet.google.com/brivent-ops-onboarding',
      attendees: ['Ibrahim Musa', 'Chidinma Nwosu'],
      agenda: 'Review offboarding checklist protocol and hardware tracking for upcoming cohort.',
    },
    {
      id: 'meet-3',
      title: 'Executive Financial Treasury & Audit Signoff',
      department: 'Executive / Finance',
      time: '11:00 AM – 12:00 PM WAT',
      date: 'Tomorrow, Oct 28',
      meetUrl: 'https://meet.google.com/brivent-exec-finance',
      attendees: ['Dr. Babatunde Brivent', 'Ngozi Eze', 'Chidinma Nwosu'],
      agenda: 'Confidential: Finalize Q3 expenditure vouchers and Providus treasury ledger.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Meetings & Calendar Schedule
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal syncs with Google Meet links, agendas, and attendee rosters in West Africa Time (WAT).
          </p>
        </div>

        <Button size="sm" variant="outline" leftIcon={<Plus className="w-4 h-4" />}>
          Schedule Sync
        </Button>
      </div>

      {/* Meetings List */}
      <div className="space-y-4">
        {meetings.map((meet) => (
          <div
            key={meet.id}
            className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  {meet.department}
                </Badge>
                <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {meet.date} • {meet.time}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900">{meet.title}</h3>

              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                <strong className="text-slate-700">Agenda:</strong> {meet.agenda}
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Attendees: {meet.attendees.join(', ')}</span>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <a
                href={meet.meetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brivent-600 hover:bg-brivent-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Video className="w-4 h-4" />
                Join Google Meet
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

