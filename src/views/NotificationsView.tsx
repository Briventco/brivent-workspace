import React from 'react';
import { Bell } from 'lucide-react';
import { ComingSoon } from '../components/ui/ComingSoon';

export const NotificationsView: React.FC = () => (
  <ComingSoon
    title="Notifications"
    icon={Bell}
    description="Updates on your work will appear here."
  />
);
