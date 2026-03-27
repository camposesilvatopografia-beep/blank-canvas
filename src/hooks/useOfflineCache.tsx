import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';

interface CachedData {
  locaisOrigem: { id: string; nome: string }[];
  locaisDestino: { id: string; nome: string }[];
  materiais: { id: string; nome: string }[];
  materiaisPedreira: { id: string; nome: string }[];
  fornecedoresCal: { id: string; nome: string }[];
  equipamentos: Record<string, unknown>[];
  caminhoes: Record<string, unknown>[];
  camReboque: Record<string, unknown>[];
  camihaoPipa: Record<string, unknown>[];
  lastUpdated: string;
}

const CACHE_KEY = 'apropriapp_offline_cache';
const CACHE_EXPIRY_HOURS = 24;

export function useOfflineCache() {
  const [cache, setCache] = useState<CachedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const { readSheet } = useGoogleSheets();

  // Load cache from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CachedData;
        setCache(parsed);
        setLastSynced(new Date(parsed.lastUpdated));
      } catch (e) {
        console.error('Error loading offline cache:', e);
      }
    }
  }, []);

  // Check if cache is stale
  const isCacheStale = useCallback(() => {
    if (!cache?.lastUpdated) return true;
    const lastUpdate = new Date(cache.lastUpdated);
    const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > CACHE_EXPIRY_HOURS;
  }, [cache]);

  // Refresh cache from remote sources
  const refreshCache = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('Offline - cannot refresh cache');
      return false;
    }

    setIsLoading(true);
    
    try {
      // Fetch all data in parallel
      const [
        locaisOrigemResult,
        locaisDestinoResult,
        materiaisResult,
        materiaisPedreiraResult,
        fornecedoresCalResult,
        equipamentosData,
        caminhoesData,
        camReboqueData,
        camihaoPipaData,
      ] = await Promise.all([
        supabase.from('locais').select('id, nome').eq('status', 'Ativo').eq('tipo', 'Origem').order('nome'),
        supabase.from('locais').select('id, nome').eq('status', 'Ativo').eq('tipo', 'Destino').order('nome'),
        supabase.from('material').select('id, nome').eq('status', 'Ativo').order('nome'),
        supabase.from('materiais_pedreira').select('id, nome').eq('status', 'Ativo').order('nome'),
        supabase.from('fornecedores_cal').select('id, nome').eq('status', 'Ativo').order('nome'),
        readSheet('Equipamentos').catch(() => []),
        readSheet('Caminhao').catch(() => []),
        readSheet('Cam_reboque').catch(() => []),
        readSheet('Caminhao_Pipa').catch(() => []),
      ]);

      // Parse Google Sheets data
      const parseSheetData = (data: unknown[][]): Record<string, unknown>[] => {
        if (!data || data.length < 2) return [];
        const headers = data[0] as string[];
        return data.slice(1).map(row => {
          const obj: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
      };

      const newCache: CachedData = {
        locaisOrigem: locaisOrigemResult.data || [],
        locaisDestino: locaisDestinoResult.data || [],
        materiais: materiaisResult.data || [],
        materiaisPedreira: materiaisPedreiraResult.data || [],
        fornecedoresCal: fornecedoresCalResult.data || [],
        equipamentos: parseSheetData(equipamentosData as unknown[][]),
        caminhoes: parseSheetData(caminhoesData as unknown[][]),
        camReboque: parseSheetData(camReboqueData as unknown[][]),
        camihaoPipa: parseSheetData(camihaoPipaData as unknown[][]),
        lastUpdated: new Date().toISOString(),
      };

      // Save to state and localStorage
      setCache(newCache);
      setLastSynced(new Date());
      localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
      
      console.log('Offline cache refreshed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing offline cache:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [readSheet]);

  // Auto-refresh cache when online and stale
  useEffect(() => {
    if (navigator.onLine && isCacheStale()) {
      refreshCache();
    }

    const handleOnline = () => {
      if (isCacheStale()) {
        refreshCache();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isCacheStale, refreshCache]);

  // Get cached data for forms
  const getCachedLocaisOrigem = useCallback(() => {
    return cache?.locaisOrigem || [];
  }, [cache]);

  const getCachedLocaisDestino = useCallback(() => {
    return cache?.locaisDestino || [];
  }, [cache]);

  const getCachedMateriais = useCallback(() => {
    return cache?.materiais || [];
  }, [cache]);

  const getCachedMateriaisPedreira = useCallback(() => {
    return cache?.materiaisPedreira || [];
  }, [cache]);

  const getCachedFornecedoresCal = useCallback(() => {
    return cache?.fornecedoresCal || [];
  }, [cache]);

  const getCachedEquipamentos = useCallback(() => {
    return cache?.equipamentos || [];
  }, [cache]);

  const getCachedCaminhoes = useCallback(() => {
    return cache?.caminhoes || [];
  }, [cache]);

  const getCachedCamReboque = useCallback(() => {
    return cache?.camReboque || [];
  }, [cache]);

  const getCachedCamihaoPipa = useCallback(() => {
    return cache?.camihaoPipa || [];
  }, [cache]);

  // Get total count of cached items
  const getCacheItemCount = useCallback(() => {
    if (!cache) return 0;
    return (
      (cache.locaisOrigem?.length || 0) +
      (cache.locaisDestino?.length || 0) +
      (cache.materiais?.length || 0) +
      (cache.materiaisPedreira?.length || 0) +
      (cache.fornecedoresCal?.length || 0) +
      (cache.equipamentos?.length || 0) +
      (cache.caminhoes?.length || 0) +
      (cache.camReboque?.length || 0) +
      (cache.camihaoPipa?.length || 0)
    );
  }, [cache]);

  return {
    cache,
    isLoading,
    lastSynced,
    isCacheStale: isCacheStale(),
    refreshCache,
    getCachedLocaisOrigem,
    getCachedLocaisDestino,
    getCachedMateriais,
    getCachedMateriaisPedreira,
    getCachedFornecedoresCal,
    getCachedEquipamentos,
    getCachedCaminhoes,
    getCachedCamReboque,
    getCachedCamihaoPipa,
    getCacheItemCount,
  };
}
