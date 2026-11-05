import React from 'react';
import { Contact } from 'lucide-react';
import { ComingSoon } from '../components/ui/ComingSoon';

export const DirectoryView: React.FC = () => (
  <ComingSoon
    title="Team Directory"
    icon={Contact}
    description="Find colleagues and their contact details here."
  />
);
