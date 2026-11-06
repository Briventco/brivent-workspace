import React from 'react';
import { Icon } from './Icon';

export const Spinner: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
  <Icon name="progress_activity" size={size} className="spin" />
);
