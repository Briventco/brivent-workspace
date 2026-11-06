import React from 'react';
import { EmptyState } from '../components/ui/EmptyState';
import { Link } from '../lib/router';

export const NotFoundView: React.FC = () => (
  <EmptyState
    icon="search"
    title="Page not found"
    description="That page doesn't exist or may have moved."
  >
    <Link to="/" className="btn btn-secondary">
      Back to dashboard
    </Link>
  </EmptyState>
);
