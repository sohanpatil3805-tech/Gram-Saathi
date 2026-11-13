import React from 'react';
import { ApplicationStatus } from '../../types/api';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText 
} from 'lucide-react';

interface StatusBadgeProps {
  status: ApplicationStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'APPROVED':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: CheckCircle2,
          label: 'ಡೆಮೊ ಅನುಮೋದನೆ [Demo Approved]',
        };
      case 'REJECTED':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: XCircle,
          label: 'ಡೆಮೊ ತಿರಸ್ಕಾರ [Demo Rejected]',
        };
      case 'NEEDS_CORRECTION':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: AlertTriangle,
          label: 'ತಿದ್ದುಪಡಿ ಅಗತ್ಯ [Demo Correction]',
        };
      case 'OFFICER_REVIEW':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: Clock,
          label: 'ಡೆಮೊ ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ [Demo Review]',
        };
      case 'SUBMITTED':
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: FileText,
          label: 'ಸಿಮ್ಯುಲೇಟೆಡ್ ಸಲ್ಲಿಕೆ [Simulated]',
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center space-x-1 font-medium rounded-full border ${config.bg} ${sizeClasses}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
};
