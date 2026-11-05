import React from 'react';
import { Settings } from 'lucide-react';
import { ComingSoon } from '../components/ui/ComingSoon';

export const SettingsView: React.FC = () => (
  <ComingSoon
    title="Settings"
    icon={Settings}
    description="Workspace settings and integrations will live here."
  />
);
