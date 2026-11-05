import React from 'react';
import { LucideIcon } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { PageHeader } from './PageHeader';

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

/** Holds the place of a page until the backend supports it. */
export const ComingSoon: React.FC<ComingSoonProps> = ({ title, description, icon: Icon }) => (
  <>
    <PageHeader title={title} />
    <EmptyState
      icon={<Icon className="w-6 h-6" aria-hidden="true" />}
      title="Coming soon"
      description={description}
    />
  </>
);
