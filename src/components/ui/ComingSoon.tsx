import React from 'react';
import { EmptyState } from './EmptyState';
import { IconName } from './Icon';
import { PageHeader } from './PageHeader';

interface ComingSoonProps {
  title: string;
  description: string;
  icon: IconName;
}

/** Holds the place of a page until the backend supports it. */
export const ComingSoon: React.FC<ComingSoonProps> = ({ title, description, icon }) => (
  <>
    <PageHeader title={title} />
    <EmptyState icon={icon} title="Coming soon" description={description} />
  </>
);
