import React from 'react';
import { CheckSquare } from 'lucide-react';
import { ComingSoon } from '../components/ui/ComingSoon';

export const TasksView: React.FC = () => (
  <ComingSoon
    title="My Tasks"
    icon={CheckSquare}
    description="Your assigned tasks, with board and list views, will appear here."
  />
);
