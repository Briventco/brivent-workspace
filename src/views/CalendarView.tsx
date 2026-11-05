import React from 'react';
import { Calendar } from 'lucide-react';
import { ComingSoon } from '../components/ui/ComingSoon';

export const CalendarView: React.FC = () => (
  <ComingSoon
    title="Meetings & Schedule"
    icon={Calendar}
    description="Your meetings and team schedule will appear here."
  />
);
