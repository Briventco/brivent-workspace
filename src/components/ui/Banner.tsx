import React from 'react';
import { Icon, IconName } from './Icon';

const TONES: Record<string, { className: string; icon: IconName; role: 'alert' | 'status' }> = {
  info: { className: 'banner-info', icon: 'info', role: 'status' },
  warn: { className: 'banner-warn', icon: 'error', role: 'status' },
  danger: { className: 'banner-danger', icon: 'error', role: 'alert' },
  success: { className: 'banner-success', icon: 'check_circle', role: 'status' },
};

interface BannerProps {
  tone?: 'info' | 'warn' | 'danger' | 'success';
  children: React.ReactNode;
}

export const Banner: React.FC<BannerProps> = ({ tone = 'danger', children }) => {
  const { className, icon, role } = TONES[tone];
  return (
    <div role={role} className={`banner ${className}`}>
      <Icon name={icon} />
      <span>{children}</span>
    </div>
  );
};
