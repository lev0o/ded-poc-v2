import React from 'react';
import { 
  Power, 
  Pause, 
  PowerOff, 
  XCircle, 
  Zap, 
  Play, 
  Clock 
} from 'lucide-react';

interface StatusIconProps {
  status: string;
  size?: number;
  className?: string;
}

export function StatusIcon({ status, size = 14, className = '' }: StatusIconProps) {
  const statusLower = (status || 'unknown').toLowerCase();
  
  switch (statusLower) {
    case 'active':
      return <Power size={size} className={`text-[var(--color-icon-status-active)] ${className}`} />;
    case 'inactive':
    case 'paused':
      return <Pause size={size} className={`text-[var(--color-icon-status-paused)] ${className}`} />;
    case 'suspended':
      return <PowerOff size={size} className={`text-[var(--color-icon-status-suspended)] ${className}`} />;
    case 'deleted':
      return <XCircle size={size} className={`text-[var(--color-icon-status-deleted)] ${className}`} />;
    case 'provisioning':
      return <Zap size={size} className={`text-[var(--color-icon-status-provisioning)] ${className}`} />;
    case 'starting':
      return <Play size={size} className={`text-[var(--color-icon-status-starting)] ${className}`} />;
    case 'stopping':
      return <PowerOff size={size} className={`text-[var(--color-icon-status-stopping)] ${className}`} />;
    default:
      return <Clock size={size} className={`text-[var(--color-icon-status-unknown)] ${className}`} />;
  }
}
