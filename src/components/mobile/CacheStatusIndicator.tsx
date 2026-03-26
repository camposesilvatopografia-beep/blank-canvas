import { Database, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CacheStatusIndicatorProps {
  cacheCount: number;
  lastSynced: Date | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function CacheStatusIndicator({
  cacheCount,
  lastSynced,
  isLoading = false,
  onRefresh,
  className
}: CacheStatusIndicatorProps) {
  const formatLastSync = () => {
    if (!lastSynced) return 'Nunca sincronizado';
    return formatDistanceToNow(lastSynced, { addSuffix: true, locale: ptBR });
  };

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-xl bg-muted border border-border',
      className
    )}>
      {/* Cache count */}
      <div className="flex items-center gap-1.5">
        <Database className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">
          {cacheCount} itens
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-border" />

      {/* Last sync time */}
      <div className="flex items-center gap-1.5 flex-1">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">
          {formatLastSync()}
        </span>
      </div>

      {/* Refresh button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 rounded-full hover:bg-accent transition-colors disabled:opacity-50"
          title="Atualizar cache"
        >
          <RefreshCw className={cn(
            'w-4 h-4 text-muted-foreground',
            isLoading && 'animate-spin'
          )} />
        </button>
      )}
    </div>
  );
}
