import React from 'react';
import { MessageSquare } from 'lucide-react';
import { ComingSoon } from '../components/ui/ComingSoon';

export const MessagesView: React.FC = () => (
  <ComingSoon
    title="Internal Messages"
    icon={MessageSquare}
    description="Team channels and direct messages will live here."
  />
);
