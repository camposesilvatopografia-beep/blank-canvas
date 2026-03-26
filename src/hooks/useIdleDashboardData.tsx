import { useState, useEffect } from 'react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format } from 'date-fns';

export interface IdleDashboardSummary {
  date: string;
  carga: { viagens: number; volume: number };
  pedreira: { viagens: number; toneladas: number };
  pipas: { viagens: number; veiculos: number };
  cal: { entradas: number; saidas: number };
  abastecimento: { litros: number; veiculos: number };
  loading: boolean;
}

export function useIdleDashboardData(): IdleDashboardSummary {
  const { readSheet } = useGoogleSheets();
  const [data, setData] = useState<IdleDashboardSummary>({
    date: '',
    carga: { viagens: 0, volume: 0 },
    pedreira: { viagens: 0, toneladas: 0 },
    pipas: { viagens: 0, veiculos: 0 },
    cal: { entradas: 0, saidas: 0 },
    abastecimento: { litros: 0, veiculos: 0 },
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [cargaData, pedreiraData, pipaData, calMovData, abastData] = await Promise.all([
          readSheet('Carga'),
          readSheet('Apontamento_Pedreira'),
          readSheet('Apontamento_Pipa'),
          readSheet('Mov_Cal'),
          readSheet('Abastecimento'),
        ]);

        if (cancelled) return;

        // Find latest date across all sheets
        const allDates = new Set<string>();
        const extractDates = (rows: any[][], colName: string) => {
          if (rows.length < 2) return;
          const idx = rows[0].indexOf(colName);
          if (idx < 0) return;
          rows.slice(1).forEach(r => {
            const d = r[idx];
            if (d && typeof d === 'string' && d.includes('/')) allDates.add(d);
          });
        };

        extractDates(cargaData, 'Data');
        extractDates(pedreiraData, 'Data');
        extractDates(pipaData, 'Data');
        extractDates(calMovData, 'Data');
        extractDates(abastData, 'Data');

        const sorted = Array.from(allDates).sort((a, b) => {
          const [da, ma, ya] = a.split('/').map(Number);
          const [db, mb, yb] = b.split('/').map(Number);
          return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });

        const latestDate = sorted[0] || '';
        if (!latestDate) { setData(prev => ({ ...prev, loading: false })); return; }

        const getTrips = (headers: string[], row: any[]) => {
          const idxNv = headers.indexOf('N_Viagens');
          const idxIv = headers.indexOf('I_Viagens');
          const raw = idxNv !== -1 ? row[idxNv] : idxIv !== -1 ? row[idxIv] : undefined;
          const parsed = parseInt(String(raw ?? '1'), 10);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
        };

        // Carga
        let cViagens = 0, cVolume = 0;
        if (cargaData.length > 1) {
          const h = cargaData[0];
          const di = h.indexOf('Data'), vi = h.indexOf('Volume_Total');
          cargaData.slice(1).filter(r => r[di] === latestDate).forEach(r => {
            cViagens += getTrips(h, r);
            cVolume += parseFloat(String(r[vi] || 0).replace(',', '.')) || 0;
          });
        }

        // Pedreira
        let pViagens = 0, pTon = 0;
        if (pedreiraData.length > 1) {
          const h = pedreiraData[0];
          const di = h.indexOf('Data'), ti = h.indexOf('Tonelada'), si = h.indexOf('Status');
          pedreiraData.slice(1)
            .filter(r => r[di] === latestDate && (si === -1 || String(r[si] || '').trim().toLowerCase() === 'finalizado'))
            .forEach(r => {
              pViagens += getTrips(h, r);
              pTon += parseFloat(String(r[ti] || 0).replace('.', '').replace(',', '.')) || 0;
            });
        }

        // Pipas
        let ppViagens = 0;
        const ppVeiculos = new Set<string>();
        if (pipaData.length > 1) {
          const h = pipaData[0];
          const di = h.indexOf('Data'), pi = h.indexOf('Prefixo');
          pipaData.slice(1).filter(r => r[di] === latestDate).forEach(r => {
            ppViagens += getTrips(h, r);
            if (r[pi]) ppVeiculos.add(r[pi]);
          });
        }

        // Cal
        let calE = 0, calS = 0;
        if (calMovData.length > 1) {
          const h = calMovData[0];
          const di = h.indexOf('Data'), ti = h.indexOf('Tipo'), qi = h.indexOf('Qtd');
          calMovData.slice(1).filter(r => r[di] === latestDate).forEach(r => {
            const tipo = String(r[ti] || '').toLowerCase();
            const qtd = parseFloat(String(r[qi] || 0).replace('.', '').replace(',', '.')) || 0;
            if (tipo === 'entrada') calE += qtd;
            else if (tipo === 'saida' || tipo === 'saída') calS += qtd;
          });
        }

        // Abastecimento
        let aLitros = 0;
        const aVeiculos = new Set<string>();
        if (abastData.length > 1) {
          const h = abastData[0];
          const di = h.indexOf('Data'), li = h.indexOf('Litros'), pi = h.indexOf('Prefixo');
          abastData.slice(1).filter(r => r[di] === latestDate).forEach(r => {
            aLitros += parseFloat(String(r[li] || 0).replace('.', '').replace(',', '.')) || 0;
            if (r[pi]) aVeiculos.add(r[pi]);
          });
        }

        setData({
          date: latestDate,
          carga: { viagens: cViagens, volume: Math.round(cVolume) },
          pedreira: { viagens: pViagens, toneladas: Math.round(pTon) },
          pipas: { viagens: ppViagens, veiculos: ppVeiculos.size },
          cal: { entradas: calE, saidas: calS },
          abastecimento: { litros: Math.round(aLitros), veiculos: aVeiculos.size },
          loading: false,
        });
      } catch (err) {
        console.error('Idle dashboard data error:', err);
        if (!cancelled) setData(prev => ({ ...prev, loading: false }));
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return data;
}
