import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileDown, TrendingUp, CalendarDays, Scale, CalendarIcon, Building2, ShoppingCart, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PedreiraFilterBar } from '@/components/reports/PedreiraFilterBar';
import { PedidoCompraPedreiraModal } from '@/components/reports/PedidoCompraPedreiraModal';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useObraConfig } from '@/hooks/useObraConfig';
import { useFreteMateriaisConfig } from '@/components/reports/FreteMateriaisConfigModal';
import { supabase } from '@/integrations/supabase/client';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface PedreiraRecord {
  data: string;
  hora: string;
  ordem: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  fornecedor: string;
  material: string;
  pesoVazio: number;
  tonelada: number;
  
}

interface MaterialStat {
  material: string;
  fornecedor: string;
  viagens: number;
  toneladas: number;
}

interface RelatorioMedicaoPedreiraProps {
  records: PedreiraRecord[];
  dateRange: { start: string; end: string };
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DIESEL_DENSITY = 0.832; // kg/L
const isDiesel = (mat: string) => /diesel/i.test(mat);
const isIpiranga = (forn: string) => /ipiranga/i.test(forn);
const isDieselRecord = (r: { material: string; fornecedor?: string }) => isDiesel(r.material) || isIpiranga(r.fornecedor || '');
const tonToLitros = (ton: number) => (ton * 1000) / DIESEL_DENSITY;

const parseDateBR = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  try {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  } catch { return null; }
};

const formatDateBR = (d: Date) => format(d, 'dd/MM/yyyy');

export function RelatorioMedicaoPedreira({ records }: RelatorioMedicaoPedreiraProps) {
  const { obraConfig } = useObraConfig();
  const { getFreteForMaterial } = useFreteMateriaisConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [includeFreteInReport, setIncludeFreteInReport] = useState<boolean>(() => {
    return localStorage.getItem('pedreira_medicao_include_frete') !== 'false';
  });

  const [filterMaterial, setFilterMaterial] = useState<string[]>([]);
  const [filterFornecedor, setFilterFornecedor] = useState<string[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterVeiculo, setFilterVeiculo] = useState<string[]>([]);
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [pedidosCompra, setPedidosCompra] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    localStorage.setItem('pedreira_medicao_include_frete', includeFreteInReport ? 'true' : 'false');
  }, [includeFreteInReport]);

  // Load purchase orders
  const loadPedidos = useCallback(async () => {
    const { data } = await supabase.from('pedidos_compra_pedreira').select('fornecedor, material, quantidade_pedido');
    if (data) {
      const map: Record<string, Record<string, number>> = {};
      (data as any[]).forEach(p => {
        if (!map[p.fornecedor]) map[p.fornecedor] = {};
        map[p.fornecedor][p.material] = p.quantidade_pedido;
      });
      setPedidosCompra(map);
    }
  }, []);

  useEffect(() => { loadPedidos(); }, [loadPedidos]);

  // Own period filter state — default to first/last record dates
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const dates = records.map(r => parseDateBR(r.data)).filter(Boolean) as Date[];
    if (dates.length === 0) return undefined;
    return new Date(Math.min(...dates.map(d => d.getTime())));
  });
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    const dates = records.map(r => parseDateBR(r.data)).filter(Boolean) as Date[];
    if (dates.length === 0) return undefined;
    return new Date(Math.max(...dates.map(d => d.getTime())));
  });

  // Filter records by selected period and chip filters
  const filteredRecords = useMemo(() => {
    let result = records;
    if (startDate || endDate) {
      const s = startDate?.getTime();
      const e = endDate?.getTime();
      result = result.filter(r => {
        const d = parseDateBR(r.data);
        if (!d) return false;
        const t = d.getTime();
        if (s && t < s) return false;
        if (e && t > e) return false;
        return true;
      });
    }
    // Apply chip filters
    result = result.filter(r => {
      if (filterMaterial.length > 0 && !filterMaterial.includes(r.material)) return false;
      if (filterFornecedor.length > 0 && !filterFornecedor.includes(r.fornecedor)) return false;
      if (filterEmpresa.length > 0 && !filterEmpresa.includes(r.empresa)) return false;
      if (filterVeiculo.length > 0 && !filterVeiculo.includes(r.prefixo)) return false;
      return true;
    });
    return result;
  }, [records, startDate, endDate, filterMaterial, filterFornecedor, filterEmpresa, filterVeiculo]);

  const periodLabel = startDate && endDate
    ? `${formatDateBR(startDate)} — ${formatDateBR(endDate)}`
    : 'Período completo';


  // Available months from filtered records
  const availableMonths = useMemo(() => {
    const set = new Map<string, string>();
    filteredRecords.forEach(r => {
      const d = parseDateBR(r.data);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!set.has(key)) {
        set.set(key, format(d, "MMMM/yyyy", { locale: ptBR }));
      }
    });
    return Array.from(set.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRecords]);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (availableMonths.length === 0) return '';
    return availableMonths[availableMonths.length - 1][0];
  });

  // Sync selectedMonth when availableMonths change
  useMemo(() => {
    if (availableMonths.length > 0 && !availableMonths.find(m => m[0] === selectedMonth)) {
      setSelectedMonth(availableMonths[availableMonths.length - 1][0]);
    }
  }, [availableMonths]);

  // Filter records for selected month
  const monthRecords = useMemo(() => {
    if (!selectedMonth) return [];
    return filteredRecords.filter(r => {
      const d = parseDateBR(r.data);
      if (!d) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [filteredRecords, selectedMonth]);

  // Period summary: accumulate only up to end of selected month
  const periodRecordsUpToMonth = useMemo(() => {
    if (!selectedMonth) return filteredRecords;
    const [year, month] = selectedMonth.split('-').map(Number);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59).getTime(); // last day of selected month
    return filteredRecords.filter(r => {
      const d = parseDateBR(r.data);
      if (!d) return false;
      return d.getTime() <= endOfMonth;
    });
  }, [filteredRecords, selectedMonth]);

  // Label for period summary (up to end of selected month)
  const periodUpToMonthLabel = useMemo(() => {
    if (!startDate || !selectedMonth) return periodLabel;
    const [year, month] = selectedMonth.split('-').map(Number);
    const endOfMonth = new Date(year, month, 0);
    return `${formatDateBR(startDate)} — ${formatDateBR(endOfMonth)}`;
  }, [startDate, selectedMonth, periodLabel]);

  const periodSummary: MaterialStat[] = useMemo(() => {
    const map = new Map<string, MaterialStat>();
    periodRecordsUpToMonth.forEach(r => {
      const mat = r.material || 'Outros';
      const forn = r.fornecedor || 'Sem Fornecedor';
      const key = `${mat}|${forn}`;
      if (!map.has(key)) map.set(key, { material: mat, fornecedor: forn, viagens: 0, toneladas: 0 });
      const s = map.get(key)!;
      s.viagens += 1;
      s.toneladas += r.tonelada;
    });
    return Array.from(map.values()).sort((a, b) => a.material.localeCompare(b.material) || a.fornecedor.localeCompare(b.fornecedor));
  }, [periodRecordsUpToMonth]);

  const totalPeriod = useMemo(() => ({
    viagens: periodRecordsUpToMonth.length,
    toneladas: periodRecordsUpToMonth.reduce((s, r) => s + r.tonelada, 0),
  }), [periodRecordsUpToMonth]);

  // Month summary
  const monthMaterialSummary: MaterialStat[] = useMemo(() => {
    const map = new Map<string, MaterialStat>();
    monthRecords.forEach(r => {
      const mat = r.material || 'Outros';
      const forn = r.fornecedor || 'Sem Fornecedor';
      const key = `${mat}|${forn}`;
      if (!map.has(key)) map.set(key, { material: mat, fornecedor: forn, viagens: 0, toneladas: 0 });
      const s = map.get(key)!;
      s.viagens += 1;
      s.toneladas += r.tonelada;
    });
    return Array.from(map.values()).sort((a, b) => a.material.localeCompare(b.material) || a.fornecedor.localeCompare(b.fornecedor));
  }, [monthRecords]);

  const totalMonth = useMemo(() => ({
    viagens: monthRecords.length,
    toneladas: monthRecords.reduce((s, r) => s + r.tonelada, 0),
  }), [monthRecords]);

  const periodSort = useTableSort(periodSummary);
  const monthSort = useTableSort(monthMaterialSummary);

  // Fornecedor-grouped data for card layout (period)
  const periodByFornecedor = useMemo(() => {
    const grouped = new Map<string, { material: string; viagens: number; toneladas: number }[]>();
    periodRecordsUpToMonth
      .filter(r => (r.material || '').trim() !== '' && (r.material || '').trim().toLowerCase() !== 'outros' && !isDieselRecord(r))
      .forEach(r => {
        const forn = r.fornecedor || 'Sem Fornecedor';
        const mat = r.material;
        if (!grouped.has(forn)) grouped.set(forn, []);
        const arr = grouped.get(forn)!;
        const existing = arr.find(m => m.material === mat);
        if (existing) {
          existing.viagens += 1;
          existing.toneladas += r.tonelada;
        } else {
          arr.push({ material: mat, viagens: 1, toneladas: r.tonelada });
        }
      });
    return Array.from(grouped.entries())
      .map(([fornecedor, materiais]) => ({
        fornecedor,
        materiais: materiais.sort((a, b) => a.material.localeCompare(b.material)),
        totalViagens: materiais.reduce((s, m) => s + m.viagens, 0),
        totalToneladas: materiais.reduce((s, m) => s + m.toneladas, 0),
      }))
      .sort((a, b) => b.totalToneladas - a.totalToneladas);
  }, [periodRecordsUpToMonth]);

  // Total by material (regardless of supplier) for period
  const periodTotalByMaterial = useMemo(() => {
    const map = new Map<string, { viagens: number; toneladas: number }>();
    periodRecordsUpToMonth
      .filter(r => (r.material || '').trim() !== '' && (r.material || '').trim().toLowerCase() !== 'outros' && !isDieselRecord(r))
      .forEach(r => {
        const mat = r.material;
        const existing = map.get(mat);
        if (existing) { existing.viagens += 1; existing.toneladas += r.tonelada; }
        else map.set(mat, { viagens: 1, toneladas: r.tonelada });
      });
    return Array.from(map.entries())
      .map(([material, data]) => ({ material, ...data }))
      .sort((a, b) => a.material.localeCompare(b.material));
  }, [periodRecordsUpToMonth]);

  // Fornecedor-grouped data for card layout (month)
  const monthByFornecedor = useMemo(() => {
    const grouped = new Map<string, { material: string; viagens: number; toneladas: number }[]>();
    monthRecords
      .filter(r => (r.material || '').trim() !== '' && (r.material || '').trim().toLowerCase() !== 'outros' && !isDieselRecord(r))
      .forEach(r => {
        const forn = r.fornecedor || 'Sem Fornecedor';
        const mat = r.material;
        if (!grouped.has(forn)) grouped.set(forn, []);
        const arr = grouped.get(forn)!;
        const existing = arr.find(m => m.material === mat);
        if (existing) {
          existing.viagens += 1;
          existing.toneladas += r.tonelada;
        } else {
          arr.push({ material: mat, viagens: 1, toneladas: r.tonelada });
        }
      });
    return Array.from(grouped.entries())
      .map(([fornecedor, materiais]) => ({
        fornecedor,
        materiais: materiais.sort((a, b) => a.material.localeCompare(b.material)),
        totalViagens: materiais.reduce((s, m) => s + m.viagens, 0),
        totalToneladas: materiais.reduce((s, m) => s + m.toneladas, 0),
      }))
      .sort((a, b) => b.totalToneladas - a.totalToneladas);
  }, [monthRecords]);

  // Total by material (regardless of supplier) for month
  const monthTotalByMaterial = useMemo(() => {
    const map = new Map<string, { viagens: number; toneladas: number }>();
    monthRecords
      .filter(r => (r.material || '').trim() !== '' && (r.material || '').trim().toLowerCase() !== 'outros' && !isDieselRecord(r))
      .forEach(r => {
        const mat = r.material;
        const existing = map.get(mat);
        if (existing) { existing.viagens += 1; existing.toneladas += r.tonelada; }
        else map.set(mat, { viagens: 1, toneladas: r.tonelada });
      });
    return Array.from(map.entries())
      .map(([material, data]) => ({ material, ...data }))
      .sort((a, b) => a.material.localeCompare(b.material));
  }, [monthRecords]);

  const periodFreteByMaterial = useMemo(() => {
    const map = new Map<string, number>();

    periodByFornecedor.forEach((forn) => {
      forn.materiais.forEach((m) => {
        const unit = getFreteForMaterial(m.material, forn.fornecedor);
        const total = unit * m.toneladas;
        map.set(m.material, (map.get(m.material) || 0) + total);
      });
    });

    return map;
  }, [periodByFornecedor, getFreteForMaterial]);

  const monthFreteByMaterial = useMemo(() => {
    const map = new Map<string, number>();

    monthByFornecedor.forEach((forn) => {
      forn.materiais.forEach((m) => {
        const unit = getFreteForMaterial(m.material, forn.fornecedor);
        const total = unit * m.toneladas;
        map.set(m.material, (map.get(m.material) || 0) + total);
      });
    });

    return map;
  }, [monthByFornecedor, getFreteForMaterial]);

  const totalFretePeriodo = useMemo(() => {
    let total = 0;
    periodByFornecedor.forEach((forn) => {
      forn.materiais.forEach((m) => {
        total += m.toneladas * getFreteForMaterial(m.material, forn.fornecedor);
      });
    });
    return total;
  }, [periodByFornecedor, getFreteForMaterial]);

  const totalFreteMes = useMemo(() => {
    let total = 0;
    monthByFornecedor.forEach((forn) => {
      forn.materiais.forEach((m) => {
        total += m.toneladas * getFreteForMaterial(m.material, forn.fornecedor);
      });
    });
    return total;
  }, [monthByFornecedor, getFreteForMaterial]);

  // Daily summary for selected month
  const allMonthMaterials = useMemo(() => {
    const mats = new Set<string>();
    monthRecords.forEach(r => mats.add(r.material || 'Outros'));
    return Array.from(mats).sort();
  }, [monthRecords]);

  const dailySummary = useMemo(() => {
    // Build production map from records
    const prodMap = new Map<string, Map<string, number>>();
    monthRecords.forEach(r => {
      const day = r.data || 'N/A';
      if (!prodMap.has(day)) prodMap.set(day, new Map());
      const matMap = prodMap.get(day)!;
      const mat = r.material || 'Outros';
      matMap.set(mat, (matMap.get(mat) || 0) + r.tonelada);
    });

    // Generate all days of the selected month
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const allDays: { data: string; diaSemana: string; matMap: Map<string, number>; total: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateBR = `${String(d).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
      const diaSemana = weekDays[date.getDay()];
      const matMap = prodMap.get(dateBR) || new Map<string, number>();
      let total = 0;
      matMap.forEach(v => total += v);
      allDays.push({ data: dateBR, diaSemana, matMap, total });
    }
    return allDays;
  }, [monthRecords, selectedMonth]);

  const selectedMonthLabel = availableMonths.find(m => m[0] === selectedMonth)?.[1] || '';

  // PDF export
  const toBase64 = (src: string): Promise<string> => {
    if (src.startsWith('data:')) return Promise.resolve(src);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  };

  const handleExportPDF = async () => {
    const logoBase64 = await toBase64(activeLogo);

    const buildFornecedorCards = (data: typeof periodByFornecedor, totalByMat: typeof periodTotalByMaterial, totalInfo: { viagens: number; toneladas: number }, title: string, accentColor: string) => {
      const cardColors = ['#ea580c', '#2563eb', '#16a34a', '#7c3aed', '#d97706'];
      return `
        <div class="section">
          <div class="section-title" style="color:${accentColor};border-bottom-color:${accentColor};">${title}</div>
          <div style="display:grid;grid-template-columns:3fr 1fr;gap:8px;">
            <div class="forn-card" style="border-color:#e5e7eb;">
              <div style="display:grid;grid-template-columns:repeat(${Math.min(data.length, 4)},1fr);">
                ${data.map((forn, fi) => {
                  const color = cardColors[fi % cardColors.length];
                  const hasDieselF = forn.materiais.some(m => isDiesel(m.material));
                  return `
                    <div style="border-right:1px solid #e5e7eb;">
                      <div class="forn-header" style="background:${color}10;border-bottom:1px solid ${color}30;">
                        <span style="font-weight:700;color:${color};font-size:9px;">🏭 ${forn.fornecedor}</span>
                        <span style="font-size:8px;color:${color};">${forn.totalViagens} viag. | ${fmt(forn.totalToneladas)} t</span>
                      </div>
                      <table>
                        <thead><tr><th style="background:${color}08;color:#374151;">Material</th><th style="background:${color}08;color:#374151;text-align:center;">Viagens</th><th style="background:${color}08;color:#374151;text-align:right;">Toneladas</th>${hasDieselF ? `<th style="background:${color}08;color:#2563eb;text-align:right;">Litros</th>` : ''}</tr></thead>
                        <tbody>${forn.materiais.map(m => {
                          const litros = isDiesel(m.material) ? tonToLitros(m.toneladas) : 0;
                          return `<tr><td>${m.material}</td><td class="center">${m.viagens}</td><td style="text-align:right;">${fmt(m.toneladas)}</td>${hasDieselF ? `<td style="text-align:right;color:#2563eb;font-weight:700;">${litros > 0 ? fmt(litros) : '—'}</td>` : ''}</tr>`;
                        }).join('')}</tbody>
                        <tfoot><tr style="background:${color}10;"><td style="font-weight:700;color:${color};font-size:8px;">SUBTOTAL</td><td class="center" style="font-weight:700;color:${color};font-size:8px;">${forn.totalViagens}</td><td style="text-align:right;font-weight:700;color:${color};font-size:8px;">${fmt(forn.totalToneladas)}</td>${hasDieselF ? `<td style="text-align:right;font-weight:700;color:#2563eb;font-size:8px;">${fmt(tonToLitros(forn.materiais.filter(m => isDiesel(m.material)).reduce((s, m) => s + m.toneladas, 0)))}</td>` : ''}</tr></tfoot>
                      </table>
                      ${hasDieselF ? `<div style="padding:2px 6px;background:#eff6ff;border-top:1px solid #dbeafe;font-size:7px;color:#2563eb;">⛽ Peso (t) × 1.000 ÷ ${DIESEL_DENSITY} kg/L = Litros</div>` : ''}
                    </div>`;
                }).join('')}
              </div>
            </div>
            ${(() => {
              const hasAnyDieselT = totalByMat.some(m => isDiesel(m.material));
              return `
            <div class="forn-card" style="border-color:#1d3557;">
              <div class="forn-header" style="background:#1d355710;border-bottom:1px solid #1d355730;">
                <span style="font-weight:700;color:#1d3557;font-size:9px;">⚖️ Total por Material</span>
              </div>
              <table>
                <thead><tr><th style="background:#1d355708;color:#374151;">Material</th><th style="background:#1d355708;color:#374151;text-align:center;">Viagens</th><th style="background:#1d355708;color:#374151;text-align:right;">Total (t)</th>${hasAnyDieselT ? '<th style="background:#1d355708;color:#2563eb;text-align:right;">Litros</th>' : ''}</tr></thead>
                <tbody>${totalByMat.map(m => {
                  const litros = isDiesel(m.material) ? tonToLitros(m.toneladas) : 0;
                  return `<tr><td>${m.material}</td><td class="center">${m.viagens}</td><td style="text-align:right;font-weight:700;">${fmt(m.toneladas)}</td>${hasAnyDieselT ? `<td style="text-align:right;color:#2563eb;font-weight:700;">${litros > 0 ? fmt(litros) : '—'}</td>` : ''}</tr>`;
                }).join('')}</tbody>
                <tfoot><tr style="background:#1d355710;"><td style="font-weight:700;color:#1d3557;font-size:8px;">TOTAL</td><td class="center" style="font-weight:700;color:#1d3557;font-size:8px;">${totalInfo.viagens}</td><td style="text-align:right;font-weight:700;color:#1d3557;font-size:8px;">${fmt(totalInfo.toneladas)}</td>${hasAnyDieselT ? `<td style="text-align:right;font-weight:700;color:#2563eb;font-size:8px;">${fmt(tonToLitros(totalByMat.filter(m => isDiesel(m.material)).reduce((s, m) => s + m.toneladas, 0)))}</td>` : ''}</tr></tfoot>
              </table>
            </div>`;
            })()}
          </div>
        </div>`;
    };

    const buildDailyTable = () => `
      <table>
        <thead><tr><th class="orange">Data</th><th class="orange">Dia</th>${allMonthMaterials.map(m => `<th class="orange center">${m}</th>`).join('')}<th class="orange center">Total (t)</th></tr></thead>
        <tbody>
          ${dailySummary.map((d, i) => `<tr class="${i % 2 ? 'alt' : ''}${d.total === 0 ? ' empty' : ''}">
            <td>${d.data}</td>
            <td>${d.diaSemana}</td>
            ${allMonthMaterials.map(m => `<td class="center">${d.matMap.get(m) ? fmt(d.matMap.get(m)!) : ''}</td>`).join('')}
            <td class="center">${d.total > 0 ? `<b>${fmt(d.total)}</b>` : ''}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <td colspan="2"><b>Total</b></td>
          ${allMonthMaterials.map(m => {
            const t = dailySummary.reduce((s, d) => s + (d.matMap.get(m) || 0), 0);
            return `<td class="center"><b>${t ? fmt(t) : ''}</b></td>`;
          }).join('')}
          <td class="center"><b>${fmt(totalMonth.toneladas)}</b></td>
        </tr></tfoot>
      </table>`;

    const buildFreteSummary = (sectionTitle: string, sourceRecords: PedreiraRecord[]) => {
      const map = new Map<string, { fornecedor: string; material: string; toneladas: number }>();

      sourceRecords
        .filter(r => (r.material || '').trim() !== '' && (r.material || '').trim().toLowerCase() !== 'outros' && !isDieselRecord(r))
        .forEach((r) => {
          const fornecedor = r.fornecedor || 'Sem Fornecedor';
          const material = r.material || 'Outros';
          const key = `${fornecedor}|${material}`;
          const current = map.get(key) || { fornecedor, material, toneladas: 0 };
          current.toneladas += r.tonelada;
          map.set(key, current);
        });

      const rows = Array.from(map.values())
        .map((entry) => {
          const freteUnit = getFreteForMaterial(entry.material, entry.fornecedor);
          const freteTotal = freteUnit * entry.toneladas;
          return { ...entry, freteUnit, freteTotal };
        })
        .filter((entry) => entry.freteUnit > 0)
        .sort((a, b) => b.freteTotal - a.freteTotal);

      if (rows.length === 0) return '';

      const totalFrete = rows.reduce((sum, row) => sum + row.freteTotal, 0);

      return `
        <div class="section">
          <div class="section-title" style="color:#047857;border-bottom-color:#10b981;">💰 ${sectionTitle}</div>
          <table>
            <thead>
              <tr>
                <th style="background:#ecfdf5;color:#065f46;">Fornecedor</th>
                <th style="background:#ecfdf5;color:#065f46;">Material</th>
                <th style="background:#ecfdf5;color:#065f46;text-align:right;">Toneladas</th>
                <th style="background:#ecfdf5;color:#065f46;text-align:right;">R$/t</th>
                <th style="background:#ecfdf5;color:#065f46;text-align:right;">Frete Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>${row.fornecedor}</td>
                  <td>${row.material}</td>
                  <td style="text-align:right;">${fmt(row.toneladas)}</td>
                  <td style="text-align:right;">${fmt(row.freteUnit)}</td>
                  <td style="text-align:right;font-weight:700;color:#047857;">R$ ${fmt(row.freteTotal)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#ecfdf5;">
                <td colspan="4" style="font-weight:700;color:#065f46;">TOTAL FRETE</td>
                <td style="text-align:right;font-weight:700;color:#065f46;">R$ ${fmt(totalFrete)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    };

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <title>Relatório para Medição — Pedreira</title>
      <style>
        @page{size:A4 portrait;margin:6mm}
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
        body{padding:6px;font-size:11px;color:#1a1a2e}
        .header{display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#1d3557,#2d5a8e);color:white;padding:10px 14px;border-radius:6px;margin-bottom:8px}
        .header img{height:42px;width:auto;object-fit:contain;background:rgba(255,255,255,.15);border-radius:4px;padding:3px}
        .header h1{font-size:15px;font-weight:800}
        .header p{font-size:9px;opacity:.85;margin-top:1px}
        .section{margin-bottom:10px}
        .section-title{font-size:12px;font-weight:700;border-bottom:2px solid;padding-bottom:2px;margin-bottom:6px}
        .cards-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}
        .forn-card{border:2px solid;border-radius:6px;overflow:hidden}
        .forn-header{padding:6px 8px;display:flex;justify-content:space-between;align-items:center}
        table{width:100%;border-collapse:collapse;margin-bottom:3px}
        th{padding:4px 6px;font-size:8px;text-align:left;border-bottom:1px solid #e5e7eb}
        th.orange{background:#ea580c;color:white}
        td{border-bottom:1px solid #f3f4f6;padding:3px 6px;font-size:9px}
        tr.alt td{background:#f8fafc}
        tfoot td{border-top:1px solid #e5e7eb}
        tr.empty td{color:#b0b0b0}
        .center{text-align:center}
        .footer{text-align:center;font-size:7px;color:#94a3b8;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:3px}
        @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style></head><body>
      <div class="header">
        <img src="${logoBase64}" alt="Logo"/>
        <div>
          ${obraConfig.nome ? `<p>${obraConfig.nome}</p>` : ''}
          ${obraConfig.local ? `<p>📍 ${obraConfig.local}</p>` : ''}
          <h1>📋 RELATÓRIO PARA MEDIÇÃO — PEDREIRA</h1>
          <p>Período: ${periodLabel}</p>
        </div>
      </div>

      ${buildFornecedorCards(periodByFornecedor, periodTotalByMaterial, totalPeriod, `📊 Resumo Acumulado Geral (${periodUpToMonthLabel})`, '#1d3557')}
      ${includeFreteInReport ? buildFreteSummary('Resumo de Frete — Acumulado', periodRecordsUpToMonth) : ''}
      ${buildFornecedorCards(monthByFornecedor, monthTotalByMaterial, totalMonth, `📅 Resumo do Mês — ${selectedMonthLabel.toUpperCase()}`, '#c2410c')}
      ${includeFreteInReport ? buildFreteSummary('Resumo de Frete — Mês Selecionado', monthRecords) : ''}

      <div class="section">
        <div class="section-title" style="color:#c2410c;border-bottom-color:#ea580c;">📆 Detalhamento Diário — ${selectedMonthLabel.toUpperCase()}</div>
        ${buildDailyTable()}
      </div>

      <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')} • ApropriAPP — Gestão Inteligente</div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  };

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum registro encontrado para gerar o relatório de medição.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Filters + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Relatório para Medição</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Start date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal gap-1", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="w-3.5 h-3.5" />
                {startDate ? formatDateBR(startDate) : 'Início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-sm">→</span>
          {/* End date picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal gap-1", !endDate && "text-muted-foreground")}>
                <CalendarIcon className="w-3.5 h-3.5" />
                {endDate ? formatDateBR(endDate) : 'Fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring capitalize"
          >
            {availableMonths.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <Button onClick={() => setPedidoModalOpen(true)} size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50 gap-1">
            <ShoppingCart className="w-4 h-4" />
            Pedidos
          </Button>
          <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
            <Switch checked={includeFreteInReport} onCheckedChange={setIncludeFreteInReport} id="medicao-include-frete" />
            <label htmlFor="medicao-include-frete" className="text-xs text-muted-foreground cursor-pointer">Incluir frete no relatório</label>
          </div>
          <Button onClick={handleExportPDF} size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/5">
            <FileDown className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Badge showing selected period */}
      <Badge variant="outline" className="text-xs">{periodLabel}</Badge>

      {/* Filter chips */}
      <PedreiraFilterBar
        records={records}
        filterMaterial={filterMaterial} setFilterMaterial={setFilterMaterial}
        filterFornecedor={filterFornecedor} setFilterFornecedor={setFilterFornecedor}
        filterEmpresa={filterEmpresa} setFilterEmpresa={setFilterEmpresa}
        filterVeiculo={filterVeiculo} setFilterVeiculo={setFilterVeiculo}
      />

      {/* Resumo Acumulado — Fornecedores separados + Total por Material */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Resumo Acumulado Geral ({periodUpToMonthLabel})</h3>
          <Badge variant="secondary" className="text-[10px]">{totalPeriod.viagens} viagens</Badge>
          <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">{fmt(totalPeriod.toneladas)} t</Badge>
          {includeFreteInReport && (
            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">Frete: R$ {fmt(totalFretePeriodo)}</Badge>
          )}
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(periodByFornecedor.length + 1, 4)}, 1fr)` }}>
          {periodByFornecedor.map((forn, fi) => {
            const colorsArr = [
              { text: 'text-orange-700 dark:text-orange-400', badge: 'bg-orange-500/10 text-orange-700 border-orange-300', subtotal: 'bg-orange-50/80 dark:bg-orange-950/50', border: 'border-orange-300' },
              { text: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-500/10 text-blue-700 border-blue-300', subtotal: 'bg-blue-50/80 dark:bg-blue-950/50', border: 'border-blue-300' },
              { text: 'text-green-700 dark:text-green-400', badge: 'bg-green-500/10 text-green-700 border-green-300', subtotal: 'bg-green-50/80 dark:bg-green-950/50', border: 'border-green-300' },
            ];
            const c = colorsArr[fi % colorsArr.length];
            return (
              <Card key={forn.fornecedor} className={`border ${c.border}`}>
                <CardHeader className="py-1.5 px-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold flex items-center gap-1 ${c.text}`}><Building2 className="w-3 h-3" />{forn.fornecedor}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-[8px] ${c.badge}`}>{forn.totalViagens} viag.</Badge>
                      <Badge variant="outline" className={`text-[8px] font-bold ${c.badge}`}>{fmt(forn.totalToneladas)} t</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table className="[&_td]:px-1.5 [&_th]:px-1.5">
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="py-1 text-[9px] font-bold">Material</TableHead>
                        <TableHead className="py-1 text-[9px] font-bold text-center">Viagens</TableHead>
                        <TableHead className="py-1 text-[9px] font-bold text-right">Recebido (t)</TableHead>
                        <TableHead className="py-1 text-[9px] font-bold text-right">Pedido (t)</TableHead>
                        <TableHead className="py-1 text-[9px] font-bold text-right">Falta (t)</TableHead>
                        {includeFreteInReport && <TableHead className="py-1 text-[9px] font-bold text-right">R$/t</TableHead>}
                        {includeFreteInReport && <TableHead className="py-1 text-[9px] font-bold text-right">Frete Total</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forn.materiais.map((m, mi) => {
                        const pedido = pedidosCompra[forn.fornecedor]?.[m.material] || 0;
                        const falta = pedido > 0 ? pedido - m.toneladas : 0;
                        const freteUnit = getFreteForMaterial(m.material, forn.fornecedor);
                        const freteTotal = freteUnit * m.toneladas;
                        return (
                          <TableRow key={mi}>
                            <TableCell className="py-1 font-medium text-[9px]">{m.material}</TableCell>
                            <TableCell className="py-1 text-center"><Badge variant="outline" className="text-[8px] px-1 py-0">{m.viagens}</Badge></TableCell>
                            <TableCell className="py-1 text-right font-medium text-[9px]">{fmt(m.toneladas)}</TableCell>
                            <TableCell className="py-1 text-right text-[9px] text-muted-foreground">{pedido > 0 ? fmt(pedido) : '—'}</TableCell>
                            <TableCell className="py-1 text-right text-[9px]">
                              {pedido > 0 ? (falta > 0 ? <span className="text-orange-600 font-medium flex items-center justify-end gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />{fmt(falta)}</span> : <span className="text-green-600 font-medium flex items-center justify-end gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />OK</span>) : '—'}
                            </TableCell>
                            {includeFreteInReport && <TableCell className="py-1 text-right text-[9px] text-muted-foreground">{freteUnit > 0 ? fmt(freteUnit) : '—'}</TableCell>}
                            {includeFreteInReport && <TableCell className="py-1 text-right text-[9px] font-medium text-emerald-700">{freteTotal > 0 ? `R$ ${fmt(freteTotal)}` : '—'}</TableCell>}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      {(() => {
                        const totalFreteFornecedor = forn.materiais.reduce(
                          (sum, m) => sum + (m.toneladas * getFreteForMaterial(m.material, forn.fornecedor)),
                          0
                        );

                        return (
                      <TableRow className={c.subtotal}>
                        <TableCell className={`py-1 font-bold text-[8px] ${c.text}`}>SUBTOTAL</TableCell>
                        <TableCell className={`py-1 text-center font-bold text-[8px] ${c.text}`}>{forn.totalViagens}</TableCell>
                        <TableCell className={`py-1 text-right font-bold text-[8px] ${c.text}`}>{fmt(forn.totalToneladas)}</TableCell>
                        <TableCell className="py-1" /><TableCell className="py-1" />
                        {includeFreteInReport && <TableCell className="py-1" />}
                        {includeFreteInReport && <TableCell className="py-1 text-right font-bold text-[8px] text-emerald-700">{totalFreteFornecedor > 0 ? `R$ ${fmt(totalFreteFornecedor)}` : '—'}</TableCell>}
                      </TableRow>
                        );
                      })()}
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
          <Card className="border border-primary/30">
            <CardHeader className="py-1.5 px-3 bg-primary/5 border-b">
              <CardTitle className="text-[10px] font-bold uppercase text-primary flex items-center gap-1"><Scale className="w-3 h-3" />Total por Material</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="[&_td]:px-1.5 [&_th]:px-1.5">
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="py-1 text-[9px] font-bold">Material</TableHead>
                    <TableHead className="py-1 text-[9px] font-bold text-center">Viagens</TableHead>
                    <TableHead className="py-1 text-[9px] font-bold text-right">Total (t)</TableHead>
                    {includeFreteInReport && <TableHead className="py-1 text-[9px] font-bold text-right">Frete Total</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodTotalByMaterial.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-1 font-medium text-[9px]">{m.material}</TableCell>
                      <TableCell className="py-1 text-center"><Badge variant="outline" className="text-[8px] px-1 py-0">{m.viagens}</Badge></TableCell>
                      <TableCell className="py-1 text-right font-bold text-[9px]">{fmt(m.toneladas)}</TableCell>
                      {includeFreteInReport && <TableCell className="py-1 text-right font-bold text-[9px] text-emerald-700">{periodFreteByMaterial.get(m.material) ? `R$ ${fmt(periodFreteByMaterial.get(m.material) || 0)}` : '—'}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/5">
                    <TableCell className="py-1 font-bold text-[9px] text-primary">TOTAL</TableCell>
                    <TableCell className="py-1 text-center font-bold text-[9px] text-primary">{totalPeriod.viagens}</TableCell>
                    <TableCell className="py-1 text-right font-bold text-[9px] text-primary">{fmt(totalPeriod.toneladas)}</TableCell>
                    {includeFreteInReport && <TableCell className="py-1 text-right font-bold text-[9px] text-emerald-700">{totalFretePeriodo > 0 ? `R$ ${fmt(totalFretePeriodo)}` : '—'}</TableCell>}
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Resumo do Mês — Fornecedores separados + Total por Material */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-semibold capitalize">Resumo do Mês — {selectedMonthLabel}</h3>
          <Badge variant="secondary" className="text-[10px]">{totalMonth.viagens} viagens</Badge>
          <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">{fmt(totalMonth.toneladas)} t</Badge>
          {includeFreteInReport && (
            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">Frete: R$ {fmt(totalFreteMes)}</Badge>
          )}
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(monthByFornecedor.length + 1, 4)}, 1fr)` }}>
          {monthByFornecedor.map((forn, fi) => {
            const colorsArr = [
              { text: 'text-orange-700 dark:text-orange-400', badge: 'bg-orange-500/10 text-orange-700 border-orange-300', subtotal: 'bg-orange-50/80 dark:bg-orange-950/50', border: 'border-orange-300' },
              { text: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-500/10 text-blue-700 border-blue-300', subtotal: 'bg-blue-50/80 dark:bg-blue-950/50', border: 'border-blue-300' },
              { text: 'text-green-700 dark:text-green-400', badge: 'bg-green-500/10 text-green-700 border-green-300', subtotal: 'bg-green-50/80 dark:bg-green-950/50', border: 'border-green-300' },
            ];
            const c = colorsArr[fi % colorsArr.length];
            return (
              <Card key={forn.fornecedor} className={`border ${c.border}`}>
                <CardHeader className="py-1.5 px-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold flex items-center gap-1 ${c.text}`}><Building2 className="w-3 h-3" />{forn.fornecedor}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-[8px] ${c.badge}`}>{forn.totalViagens} viag.</Badge>
                      <Badge variant="outline" className={`text-[8px] font-bold ${c.badge}`}>{fmt(forn.totalToneladas)} t</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table className="[&_td]:px-1.5 [&_th]:px-1.5">
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="py-1 text-[9px] font-bold">Material</TableHead>
                        <TableHead className="py-1 text-[9px] font-bold text-center">Viagens</TableHead>
                        <TableHead className="py-1 text-[9px] font-bold text-right">Toneladas</TableHead>
                        {includeFreteInReport && <TableHead className="py-1 text-[9px] font-bold text-right">R$/t</TableHead>}
                        {includeFreteInReport && <TableHead className="py-1 text-[9px] font-bold text-right">Frete Total</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forn.materiais.map((m, mi) => {
                        const freteUnit = getFreteForMaterial(m.material, forn.fornecedor);
                        const freteTotal = freteUnit * m.toneladas;

                        return (
                          <TableRow key={mi}>
                            <TableCell className="py-1 font-medium text-[9px]">{m.material}</TableCell>
                            <TableCell className="py-1 text-center"><Badge variant="outline" className="text-[8px] px-1 py-0">{m.viagens}</Badge></TableCell>
                            <TableCell className="py-1 text-right font-medium text-[9px]">{fmt(m.toneladas)}</TableCell>
                            {includeFreteInReport && <TableCell className="py-1 text-right text-[9px] text-muted-foreground">{freteUnit > 0 ? fmt(freteUnit) : '—'}</TableCell>}
                            {includeFreteInReport && <TableCell className="py-1 text-right text-[9px] font-medium text-emerald-700">{freteTotal > 0 ? `R$ ${fmt(freteTotal)}` : '—'}</TableCell>}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      {(() => {
                        const totalFreteFornecedor = forn.materiais.reduce(
                          (sum, m) => sum + (m.toneladas * getFreteForMaterial(m.material, forn.fornecedor)),
                          0
                        );

                        return (
                      <TableRow className={c.subtotal}>
                        <TableCell className={`py-1 font-bold text-[8px] ${c.text}`}>SUBTOTAL</TableCell>
                        <TableCell className={`py-1 text-center font-bold text-[8px] ${c.text}`}>{forn.totalViagens}</TableCell>
                        <TableCell className={`py-1 text-right font-bold text-[8px] ${c.text}`}>{fmt(forn.totalToneladas)}</TableCell>
                        {includeFreteInReport && <TableCell className="py-1" />}
                        {includeFreteInReport && <TableCell className="py-1 text-right font-bold text-[8px] text-emerald-700">{totalFreteFornecedor > 0 ? `R$ ${fmt(totalFreteFornecedor)}` : '—'}</TableCell>}
                      </TableRow>
                        );
                      })()}
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
          <Card className="border border-primary/30">
            <CardHeader className="py-1.5 px-3 bg-primary/5 border-b">
              <CardTitle className="text-[10px] font-bold uppercase text-primary flex items-center gap-1"><Scale className="w-3 h-3" />Total por Material</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="[&_td]:px-1.5 [&_th]:px-1.5">
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="py-1 text-[9px] font-bold">Material</TableHead>
                    <TableHead className="py-1 text-[9px] font-bold text-center">Viagens</TableHead>
                    <TableHead className="py-1 text-[9px] font-bold text-right">Total (t)</TableHead>
                    {includeFreteInReport && <TableHead className="py-1 text-[9px] font-bold text-right">Frete Total</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthTotalByMaterial.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-1 font-medium text-[9px]">{m.material}</TableCell>
                      <TableCell className="py-1 text-center"><Badge variant="outline" className="text-[8px] px-1 py-0">{m.viagens}</Badge></TableCell>
                      <TableCell className="py-1 text-right font-bold text-[9px]">{fmt(m.toneladas)}</TableCell>
                      {includeFreteInReport && <TableCell className="py-1 text-right font-bold text-[9px] text-emerald-700">{monthFreteByMaterial.get(m.material) ? `R$ ${fmt(monthFreteByMaterial.get(m.material) || 0)}` : '—'}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/5">
                    <TableCell className="py-1 font-bold text-[9px] text-primary">TOTAL</TableCell>
                    <TableCell className="py-1 text-center font-bold text-[9px] text-primary">{totalMonth.viagens}</TableCell>
                    <TableCell className="py-1 text-right font-bold text-[9px] text-primary">{fmt(totalMonth.toneladas)}</TableCell>
                    {includeFreteInReport && <TableCell className="py-1 text-right font-bold text-[9px] text-emerald-700">{totalFreteMes > 0 ? `R$ ${fmt(totalFreteMes)}` : '—'}</TableCell>}
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Daily detail */}
      <Card>
        <CardHeader className="pb-3 bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-800">
          <CardTitle className="text-base flex items-center gap-2 capitalize text-orange-700 dark:text-orange-300">
            <CalendarDays className="w-4 h-4" />
            Detalhamento Diário — {selectedMonthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Data</TableHead>
                  <TableHead>Dia</TableHead>
                  {allMonthMaterials.map(m => (
                    <TableHead key={m} className="text-center whitespace-nowrap">{m}</TableHead>
                  ))}
                  <TableHead className="text-center">Total (t)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailySummary.map((d, i) => (
                  <TableRow key={i} className={d.total === 0 ? 'text-muted-foreground' : ''}>
                    <TableCell className="sticky left-0 bg-background z-10 whitespace-nowrap">{d.data}</TableCell>
                    <TableCell className="whitespace-nowrap">{d.diaSemana}</TableCell>
                    {allMonthMaterials.map(m => (
                      <TableCell key={m} className="text-center">
                        {d.matMap.get(m) ? fmt(d.matMap.get(m)!) : ''}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-bold">{d.total > 0 ? fmt(d.total) : ''}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell className="sticky left-0 bg-muted/50 z-10 font-bold" colSpan={2}>Total</TableCell>
                  {allMonthMaterials.map(m => {
                    const t = dailySummary.reduce((s, d) => s + (d.matMap.get(m) || 0), 0);
                    return <TableCell key={m} className="text-center font-bold">{t ? fmt(t) : ''}</TableCell>;
                  })}
                  <TableCell className="text-center font-bold">{fmt(totalMonth.toneladas)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Order Modal */}
      <PedidoCompraPedreiraModal
        open={pedidoModalOpen}
        onOpenChange={setPedidoModalOpen}
        fornecedores={Array.from(new Set(records.map(r => r.fornecedor).filter(Boolean))).sort()}
        materiais={Array.from(new Set(records.map(r => r.material).filter(Boolean))).sort()}
        onSaved={loadPedidos}
      />
    </div>
  );
}
