import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * Generic table sorting hook.
 * 
 * Usage:
 *   const { sortedData, sortConfig, requestSort, getSortIcon } = useTableSort(data);
 *   
 *   // In header:
 *   <SortableTableHead sortKey="nome" sortConfig={sortConfig} onSort={requestSort}>Nome</SortableTableHead>
 *   
 *   // Use sortedData instead of data in TableBody
 */
export function useTableSort<T>(data: T[], defaultSort?: SortConfig) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultSort || { key: '', direction: null });

  const requestSort = useCallback((key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: '', direction: null };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortConfig.key];
      const bVal = (b as any)[sortConfig.key];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Try numeric comparison
      const aNum = typeof aVal === 'number' ? aVal : parseFloat(String(aVal).replace(/[^\d.,-]/g, '').replace(',', '.'));
      const bNum = typeof bVal === 'number' ? bVal : parseFloat(String(bVal).replace(/[^\d.,-]/g, '').replace(',', '.'));

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr, 'pt-BR');
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
  }, [data, sortConfig]);

  return { sortedData, sortConfig, requestSort };
}
