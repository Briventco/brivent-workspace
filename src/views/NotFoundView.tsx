import React from 'react';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { Link } from '../lib/router';

export const NotFoundView: React.FC = () => (
  <EmptyState
    icon={<Compass className="w-6 h-6" aria-hidden="true" />}
    title="Page not found"
    description="That page doesn't exist or may have moved."
  >
    <Link to="/" className="text-sm font-medium text-brivent-700 hover:underline rounded">
      Back to dashboard
    </Link>
  </EmptyState>
);
