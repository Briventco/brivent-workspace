import React from 'react';
import { FileText } from 'lucide-react';
import { ComingSoon } from '../components/ui/ComingSoon';

export const DocumentsView: React.FC = () => (
  <ComingSoon
    title="Knowledge & SOPs"
    icon={FileText}
    description="Company policies, SOPs and documents will live here."
  />
);
