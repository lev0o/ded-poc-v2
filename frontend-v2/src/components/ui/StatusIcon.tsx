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
      return <Power size={size} className={`text-green-500 ${className}`} />;
    case 'inactive':
    case 'paused':
      return <Pause size={size} className={`text-orange-500 ${className}`} />;
    case 'suspended':
      return <PowerOff size={size} className={`text-red-500 ${className}`} />;
    case 'deleted':
      return <XCircle size={size} className={`text-red-500 ${className}`} />;
    case 'provisioning':
      return <Zap size={size} className={`text-blue-500 ${className}`} />;
    case 'starting':
      return <Play size={size} className={`text-blue-500 ${className}`} />;
    case 'stopping':
      return <PowerOff size={size} className={`text-orange-500 ${className}`} />;
    default:
      return <Clock size={size} className={`text-gray-500 ${className}`} />;
  }
}
