import { WifiOff, Wifi, Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing?: boolean;
  className?: string;
  variant?: 'compact' | 'full';
}

export function OfflineIndicator({ 
  isOnline, 
  pendingCount, 
  isSyncing = false,
  className,
  variant = 'compact'
}: OfflineIndicatorProps) {
  if (isSyncing) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold',
        'bg-blue-500 text-white shadow-lg',
        className
      )}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Sincronizando...</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold',
        'bg-red-500 text-white shadow-lg animate-pulse',
        className
      )}>
        <WifiOff className="w-4 h-4" />
        <span>Offline</span>
        {pendingCount > 0 && (
          <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold',
        'bg-amber-500 text-white shadow-lg',
        className
      )}>
        <CloudOff className="w-4 h-4" />
        <span>{pendingCount} pendente(s)</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold',
      'bg-green-500 text-white shadow-md',
      className
    )}>
      <Cloud className="w-4 h-4" />
      <span>Online</span>
    </div>
  );
}
