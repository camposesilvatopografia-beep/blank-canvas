import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { SortConfig } from '@/hooks/useTableSort';
import { cn } from '@/lib/utils';
import React from 'react';

interface SortableTableHeadProps {
  sortKey: string;
  sortConfig: SortConfig;
  onSort: (key: string) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** If false, renders a normal non-sortable TableHead */
  sortable?: boolean;
}

export function SortableTableHead({ sortKey, sortConfig, onSort, children, className, style, sortable = true }: SortableTableHeadProps) {
  if (!sortable) {
    return <TableHead className={className} style={style}>{children}</TableHead>;
  }

  const isActive = sortConfig.key === sortKey && sortConfig.direction !== null;

  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:bg-muted/30 transition-colors', className)}
      style={style}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span className="flex-1">{children}</span>
        {isActive ? (
          sortConfig.direction === 'asc' ? (
            <ArrowUp className="w-3 h-3 shrink-0 text-primary" />
          ) : (
            <ArrowDown className="w-3 h-3 shrink-0 text-primary" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 shrink-0 opacity-30" />
        )}
      </div>
    </TableHead>
  );
}
