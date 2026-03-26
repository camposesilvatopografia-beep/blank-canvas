import { useState, useEffect, useCallback, createContext, useContext, ReactNode, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';

export interface PendingRecord {
  id: string;
  type: 'carga' | 'lancamento' | 'pedreira' | 'pipas' | 'cal';
  sheetName: string;
  rowData: string[];
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

const STORAGE_KEY = 'apropriapp_pending_records';
const MAX_RETRIES = 3;

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const { appendSheet } = useGoogleSheets();
  const syncInProgress = useRef(false);

  // Load pending records from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPendingRecords(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading pending records:', e);
      }
    }
  }, []);

  // Save pending records to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingRecords));
  }, [pendingRecords]);

  // Auto-sync when coming back online
  const syncAllPending = useCallback(async () => {
    if (syncInProgress.current || pendingRecords.length === 0) {
      // If no pending records but isSyncing is stuck, reset it
      setIsSyncing(false);
      return;
    }
    
    syncInProgress.current = true;
    setIsSyncing(true);
    
    let successCount = 0;
    let failCount = 0;
    const recordsToRemove: string[] = [];
    const recordsToUpdate: PendingRecord[] = [];

    // Safety timeout: force reset after 30 seconds
    const safetyTimeout = setTimeout(() => {
      console.warn('Sync safety timeout reached, forcing reset');
      setIsSyncing(false);
      syncInProgress.current = false;
    }, 30000);

    try {
      for (const record of pendingRecords) {
        try {
          console.log(`Syncing record ${record.id} to ${record.sheetName}...`);
          const success = await appendSheet(record.sheetName, [record.rowData]);
          
          if (success) {
            recordsToRemove.push(record.id);
            successCount++;
            console.log(`Record ${record.id} synced successfully`);
          } else {
            if (record.retryCount < MAX_RETRIES) {
              recordsToUpdate.push({ ...record, retryCount: record.retryCount + 1 });
            } else {
              recordsToRemove.push(record.id);
              failCount++;
              console.error(`Record ${record.id} failed after max retries`);
            }
          }
        } catch (error) {
          console.error('Error syncing record:', error);
          if (record.retryCount < MAX_RETRIES) {
            recordsToUpdate.push({ ...record, retryCount: record.retryCount + 1 });
          } else {
            recordsToRemove.push(record.id);
            failCount++;
          }
        }
      }

      // Update state after all syncs
      setPendingRecords(prev => {
        const filtered = prev.filter(r => !recordsToRemove.includes(r.id));
        return filtered.map(r => {
          const updated = recordsToUpdate.find(u => u.id === r.id);
          return updated || r;
        });
      });

      if (successCount > 0) {
        toast({
          title: '✅ Sincronização concluída',
          description: `${successCount} registro(s) sincronizado(s) com sucesso.`,
        });
      }

      if (failCount > 0) {
        toast({
          variant: 'destructive',
          title: 'Erro na sincronização',
          description: `${failCount} registro(s) não puderam ser sincronizados.`,
        });
      }

      return { successCount, failCount };
    } finally {
      clearTimeout(safetyTimeout);
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, [pendingRecords, appendSheet, toast]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: '🌐 Conexão restaurada',
        description: 'Sincronizando dados pendentes...',
      });
      // Auto-sync when connection is restored
      setTimeout(() => {
        syncAllPending();
      }, 1000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        variant: 'destructive',
        title: '📴 Sem conexão',
        description: 'Dados serão salvos localmente e sincronizados depois.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, syncAllPending]);

  // Try to sync on mount if online and has pending
  useEffect(() => {
    if (isOnline && pendingRecords.length > 0 && !isSyncing) {
      syncAllPending();
    }
  }, [isOnline]); // Only run when online status changes

  // Add a record to pending queue
  const addPendingRecord = useCallback((
    type: PendingRecord['type'], 
    sheetName: string,
    rowData: string[],
    data: Record<string, unknown>
  ) => {
    const record: PendingRecord = {
      id: crypto.randomUUID(),
      type,
      sheetName,
      rowData,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    setPendingRecords(prev => [...prev, record]);
    
    toast({
      title: '💾 Salvo localmente',
      description: 'Será sincronizado quando a conexão voltar.',
    });
    
    return record.id;
  }, [toast]);

  // Remove a record from pending queue
  const removePendingRecord = useCallback((id: string) => {
    setPendingRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  // Clear all pending records
  const clearPendingRecords = useCallback(() => {
    setPendingRecords([]);
  }, []);

  // Get pending count
  const getPendingCount = useCallback(() => {
    return pendingRecords.length;
  }, [pendingRecords]);

  // Manual sync trigger
  const syncPendingRecords = useCallback(async (
    syncFn?: (record: PendingRecord) => Promise<boolean>
  ) => {
    if (!isOnline || pendingRecords.length === 0) return { successCount: 0, failCount: 0 };
    
    // Use default sync if no custom function provided
    if (!syncFn) {
      return syncAllPending();
    }
    
    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    for (const record of pendingRecords) {
      try {
        const success = await syncFn(record);
        if (success) {
          removePendingRecord(record.id);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Error syncing record:', error);
        failCount++;
      }
    }

    setIsSyncing(false);

    if (successCount > 0) {
      toast({
        title: 'Sincronização concluída',
        description: `${successCount} registro(s) sincronizado(s) com sucesso.`,
      });
    }

    if (failCount > 0) {
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: `${failCount} registro(s) não puderam ser sincronizados.`,
      });
    }

    return { successCount, failCount };
  }, [isOnline, pendingRecords, removePendingRecord, toast, syncAllPending]);

  return {
    isOnline,
    pendingRecords,
    pendingCount: pendingRecords.length,
    isSyncing,
    addPendingRecord,
    removePendingRecord,
    clearPendingRecords,
    getPendingCount,
    syncPendingRecords,
    syncAllPending,
  };
}

// Context for global offline sync state
interface OfflineSyncContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  addPendingRecord: (type: PendingRecord['type'], sheetName: string, rowData: string[], data: Record<string, unknown>) => string;
  syncPendingRecords: (syncFn?: (record: PendingRecord) => Promise<boolean>) => Promise<{ successCount: number; failCount: number } | undefined>;
  syncAllPending: () => Promise<{ successCount: number; failCount: number } | undefined>;
  pendingRecords: PendingRecord[];
}

const OfflineSyncContext = createContext<OfflineSyncContextType | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const offlineSync = useOfflineSync();

  return (
    <OfflineSyncContext.Provider value={offlineSync}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSyncContext() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error('useOfflineSyncContext must be used within OfflineSyncProvider');
  }
  return context;
}
