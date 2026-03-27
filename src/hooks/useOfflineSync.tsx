import { useState, useEffect, useCallback, createContext, useContext, ReactNode, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { supabase } from '@/integrations/supabase/client';
import { parseNumeric } from '@/utils/masks';

export interface PendingRecord {
  id: string;
  type: 'carga' | 'lancamento' | 'pedreira' | 'pipas' | 'cal' | 'usina_solos';
  sheetName: string;
  rowData: string[];
  data: Record<string, any>;
  createdAt: string;
  retryCount: number;
  syncedToSheets?: boolean;
  syncedToSupabase?: boolean;
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

  // Function to sync a single record to Supabase based on its type
  const syncRecordToSupabase = useCallback(async (record: PendingRecord): Promise<boolean> => {
    try {
      const data = record.data;
      const type = record.type;
      let table = '';
      let payload: any = {};

      switch (type) {
        case 'carga':
          table = 'apontamentos_carga';
          payload = {
            data: data.data,
            hora: data.hora,
            prefixo_escavadeira: data.prefixo_escavadeira,
            descricao_escavadeira: data.descricao_escavadeira,
            empresa_escavadeira: data.empresa_escavadeira,
            operador: data.operador,
            prefixo_caminhao: data.caminhao,
            descricao_caminhao: data.descricao_caminhao,
            empresa_caminhao: data.empresa_caminhao,
            motorista: data.motorista,
            local: data.local,
            estaca: data.estaca,
            material: data.material,
            quantidade: parseNumeric(data.quantidade),
            viagens: parseInt(data.viagens) || 1,
            volume_total: parseNumeric(data.volumeTotal),
            status: 'Sincronizado'
          };
          break;
        case 'lancamento':
          table = 'apontamentos_descarga';
          payload = {
            data: data.data,
            hora: data.hora,
            prefixo_caminhao: data.caminhao,
            descricao_caminhao: data.descricao_caminhao,
            empresa_caminhao: data.empresa_caminhao,
            motorista: data.motorista,
            volume_total: parseNumeric(data.volumeTotal),
            viagens: parseInt(data.viagens) || 1,
            local: data.localLancamento || data.local,
            estaca: data.estaca,
            material: data.material,
          };
          break;
        case 'pedreira':
          table = 'movimentacoes_pedreira';
          // Support for both load form and cycle form
          if (data.formData) { // FormPedreiraCiclo
            const fd = data.formData;
            payload = {
              external_id: record.id,
              data: fd.data || new Date().toISOString().split('T')[0],
              hora: fd.hora || new Date().toLocaleTimeString('pt-BR', { hour12: false }),
              prefixo_caminhao: fd.caminhao,
              material: fd.material,
              viagens: 1,
              volume: parseNumeric(fd.pesoFinal),
              volume_total: parseNumeric(fd.tonelada),
              usuario: fd.usuario,
            };
          } else { // FormPedreira
            payload = {
              data: data.data,
              hora: data.horaCarregamento,
              prefixo_caminhao: data.caminhao,
              fornecedor: data.fornecedor,
              material: data.material,
              nota_fiscal: data.numeroPedido,
              viagens: 1,
              volume: parseNumeric(data.pesoFinal),
              volume_total: parseNumeric(data.toneladaNum),
              usuario: data.usuario || data.effectiveName,
            };
          }
          break;
        case 'pipas':
          table = 'movimentacoes_pipas';
          payload = {
            data: data.data,
            hora: data.hora,
            prefixo_pipa: data.veiculo,
            motorista: data.motorista,
            empresa: data.empresa,
            local: data.localTrabalho,
            atividade: data.atividade,
            viagens: parseInt(data.viagens) || 1,
            volume_total: parseNumeric(data.volume_total),
          };
          break;
        case 'cal':
          table = 'movimentacoes_cal';
          const fd = data.formData || data;
          payload = {
            data: fd.data,
            hora: fd.hora || new Date().toLocaleTimeString('pt-BR', { hour12: false }),
            prefixo_caminhao: fd.prefixoCaminhao,
            motorista: fd.motorista,
            fornecedor: fd.fornecedor,
            nota_fiscal: fd.notaFiscal,
            quantidade: parseNumeric(fd.quantidade),
            local: fd.local || 'Cebolão',
            usuario: fd.usuario,
          };
          break;
        case 'usina_solos':
          table = 'movimentacoes_usina_solos';
          payload = {
            data: data.data,
            hora: data.hora,
            prefixo_caminhao: data.caminhao,
            motorista: data.motorista,
            material: data.material,
            volume: parseNumeric(data.volume),
            viagens: parseInt(data.viagens) || 1,
            local: data.local,
          };
          break;
      }

      if (table) {
        console.log(`[OfflineSync] Syncing to Supabase table ${table}...`);
        const { error } = await supabase.from(table as any).upsert(payload, { onConflict: 'external_id' });
        if (error) {
          console.error(`[OfflineSync] Supabase sync error for ${type}:`, error);
          return false;
        }
        console.log(`[OfflineSync] Record synced to Supabase successfully`);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[OfflineSync] Supabase sync catch error:', err);
      return false;
    }
  }, []);

  // Auto-sync when coming back online
  const syncAllPending = useCallback(async () => {
    if (syncInProgress.current || pendingRecords.length === 0) {
      setIsSyncing(false);
      return;
    }
    
    syncInProgress.current = true;
    setIsSyncing(true);
    
    let successCount = 0;
    let failCount = 0;
    const recordsToRemove: string[] = [];
    const updatedRecords = [...pendingRecords];

    const safetyTimeout = setTimeout(() => {
      console.warn('Sync safety timeout reached, forcing reset');
      setIsSyncing(false);
      syncInProgress.current = false;
    }, 30000);

    try {
      for (let i = 0; i < updatedRecords.length; i++) {
        const record = updatedRecords[i];
        try {
          // Sync to Sheets
          if (!record.syncedToSheets) {
            console.log(`Syncing record ${record.id} to ${record.sheetName}...`);
            const sheetSuccess = await appendSheet(record.sheetName, [record.rowData]);
            if (sheetSuccess) {
              record.syncedToSheets = true;
              console.log(`Record ${record.id} synced to Sheets`);
            }
          }

          // Sync to Supabase
          if (!record.syncedToSupabase) {
            const supabaseSuccess = await syncRecordToSupabase(record);
            if (supabaseSuccess) {
              record.syncedToSupabase = true;
              console.log(`Record ${record.id} synced to Supabase`);
            }
          }

          // If both synced, remove from queue
          if (record.syncedToSheets && record.syncedToSupabase) {
            recordsToRemove.push(record.id);
            successCount++;
          } else {
            // Check retries
            if (record.retryCount >= MAX_RETRIES) {
              recordsToRemove.push(record.id);
              failCount++;
              console.error(`Record ${record.id} failed after max retries`);
            } else {
              record.retryCount++;
            }
          }
        } catch (error) {
          console.error('Error syncing record:', error);
          if (record.retryCount >= MAX_RETRIES) {
            recordsToRemove.push(record.id);
            failCount++;
          } else {
            record.retryCount++;
          }
        }
      }

      setPendingRecords(updatedRecords.filter(r => !recordsToRemove.includes(r.id)));

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
  }, [pendingRecords, appendSheet, toast, syncRecordToSupabase]);

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
    data: Record<string, any>
  ) => {
    const record: PendingRecord = {
      id: crypto.randomUUID(),
      type,
      sheetName,
      rowData,
      data,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      syncedToSheets: false,
      syncedToSupabase: false,
    };
    setPendingRecords(prev => [...prev, record]);
    
    return record.id;
  }, []);

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
