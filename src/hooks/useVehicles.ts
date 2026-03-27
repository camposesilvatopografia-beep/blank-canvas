
import { useState, useCallback, useEffect } from 'react';
import { useGoogleSheets } from './useGoogleSheets';

export interface Vehicle {
  prefixo: string;
  descricao: string;
  empresa: string;
  tipo: string;
  status: string;
  motorista?: string;
  operador?: string;
}

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const { readSheet } = useGoogleSheets();

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await readSheet('Frota Geral');
      if (data && data.length > 1) {
        const hdrs = (data[0] as string[]).map(h => String(h || '').trim().toLowerCase());
        
        // Match headers more flexibly
        const getIdx = (keywords: string[]) => {
          return hdrs.findIndex(h => keywords.some(k => h.includes(k)));
        };

        const prefixoIdx = getIdx(['codigo', 'prefixo', 'cod']);
        const descIdx = getIdx(['descricao', 'descri', 'equipamento']);
        const empresaIdx = getIdx(['empresa']);
        const tipoIdx = getIdx(['categoria', 'tipo']);
        const statusIdx = getIdx(['status']);
        const motoristaIdx = getIdx(['motorista']);
        const operadorIdx = getIdx(['operador']);

        const parsed = data.slice(1)
          .filter(row => row[prefixoIdx])
          .map(row => ({
            prefixo: String(row[prefixoIdx] || '').trim(),
            descricao: String(row[descIdx] || '').trim(),
            empresa: String(row[empresaIdx] || '').trim(),
            tipo: String(row[tipoIdx] || '').trim(),
            status: String(row[statusIdx] || '').trim(),
            motorista: motoristaIdx >= 0 ? String(row[motoristaIdx] || '').trim() : '',
            operador: operadorIdx >= 0 ? String(row[operadorIdx] || '').trim() : '',
          }));
        
        setVehicles(parsed);
      }
    } catch (err) {
      console.error('Error loading vehicles:', err);
    } finally {
      setLoading(false);
    }
  }, [readSheet]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  return { vehicles, loading, refresh: loadVehicles };
}
