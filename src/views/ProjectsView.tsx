import React from 'react';
import { FolderKanban } from 'lucide-react';
import { ComingSoon } from '../components/ui/ComingSoon';

export const ProjectsView: React.FC = () => (
  <ComingSoon
    title="Projects"
    icon={FolderKanban}
    description="Track projects, milestones and the people working on them here."
  />
);
