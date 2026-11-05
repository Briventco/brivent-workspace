import React from 'react';
import { Clock } from 'lucide-react';
import { ComingSoon } from '../components/ui/ComingSoon';

export const DailyRoutineView: React.FC = () => (
  <ComingSoon
    title="Daily Check-in"
    icon={Clock}
    description="Check in each morning and share your daily work update here."
  />
);
