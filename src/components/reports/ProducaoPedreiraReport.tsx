import { useState, useRef, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileDown, FileSpreadsheet, ChevronDown, Mountain, Building2, CalendarIcon, X, Search, CalendarDays, MessageCircle, Send, Truck, Pencil, Trash2 } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PedreiraFilterBar } from '@/components/reports/PedreiraFilterBar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useObraConfig } from '@/hooks/useObraConfig';
import { useReportHeaderConfig } from '@/hooks/useReportHeaderConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { useFreteMateriaisConfig } from '@/components/reports/FreteMateriaisConfigModal';

interface PedreiraRecord {
  rowIndex?: number;
  data: string;
  hora: string;
  ordem: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  fornecedor: string;
  motorista?: string;
  placa?: string;
  material: string;
  pesoVazio: number;
  tonelada: number;
  toneladaTicket?: number;
  toneladaCalcObra?: number;
  pesoFinal?: number;
  pesoLiquido?: number;
  pesoChegada?: number;
  fotoChegada?: string;
  originalRow?: any[];
}

interface MaterialSummary {
  material: string;
  fornecedor: string;
  viagens: number;
  toneladas: number;
}

interface EmpresaSummary {
  empresa: string;
  viagens: number;
  veiculos: number;
}

interface DaySummary {
  data: string;
  viagens: number;
  toneladas: number;
  materiais: { material: string; viagens: number; toneladas: number }[];
}

interface ProducaoPedreiraReportProps {
  records: PedreiraRecord[];
  dateRange: { start: string; end: string };
  title?: string;
  onEdit?: (record: PedreiraRecord) => void;
  onDelete?: (record: PedreiraRecord) => void;
}

export function ProducaoPedreiraReport({ records, dateRange, title = 'RELATÓRIO DE CARREGAMENTO', onEdit, onDelete }: ProducaoPedreiraReportProps) {
  const [isOpen, setIsOpen] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  const { obraConfig } = useObraConfig();
  const { config: hCfg, getHeaderCss } = useReportHeaderConfig('divergencia_pedreira');
  const { getFreteForMaterial } = useFreteMateriaisConfig();
  // Logo: usa a cadastrada em Dados da Obra (base64); fallback para logo padrão
  const activeLogo = obraConfig.logo || logoApropriapp;

  // Helper: converts any img src to base64 data URL (for reliable PDF embedding)
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
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsAppObservacao, setWhatsAppObservacao] = useState('');
  
  // Date filter states
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  
  // Search filter
  const [searchTerm, setSearchTerm] = useState('');
  
  // Empresa filter
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('todos');
  
  // Material filter
  const [selectedMaterial, setSelectedMaterial] = useState<string>('todos');

  // Chip filters
  const [chipFilterMaterial, setChipFilterMaterial] = useState<string[]>([]);
  const [chipFilterFornecedor, setChipFilterFornecedor] = useState<string[]>([]);
  const [chipFilterEmpresa, setChipFilterEmpresa] = useState<string[]>([]);
  const [chipFilterVeiculo, setChipFilterVeiculo] = useState<string[]>([]);

  // Get unique empresas for filter dropdown
  const availableEmpresas = useMemo(() => {
    const empresas = new Set<string>();
    records.forEach(r => {
      if (r.empresa) empresas.add(r.empresa);
    });
    return Array.from(empresas).sort();
  }, [records]);

  // Get unique materials for filter dropdown
  const availableMaterials = useMemo(() => {
    const materials = new Set<string>();
    records.forEach(r => {
      if (r.material) materials.add(r.material);
    });
    return Array.from(materials).sort();
  }, [records]);

  // Parse DD/MM/YYYY to Date
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    try {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    } catch {
      return null;
    }
  };

  // Filter records by date range, search term, empresa, material, and chip filters
  const filteredRecords = useMemo(() => {
    let result = records;
    
    // Empresa filter
    if (selectedEmpresa !== 'todos') {
      result = result.filter(r => r.empresa === selectedEmpresa);
    }
    
    // Material filter
    if (selectedMaterial !== 'todos') {
      result = result.filter(r => r.material === selectedMaterial);
    }
    
    // Date filter
    if (filterStartDate || filterEndDate) {
      result = result.filter(r => {
        const recordDate = parseDate(r.data);
        if (!recordDate) return false;
        
        if (filterStartDate && recordDate < filterStartDate) return false;
        if (filterEndDate && recordDate > filterEndDate) return false;
        
        return true;
      });
    }
    
    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(r => 
        r.prefixo?.toLowerCase().includes(term) ||
        r.descricao?.toLowerCase().includes(term) ||
        r.empresa?.toLowerCase().includes(term) ||
        r.material?.toLowerCase().includes(term) ||
        r.ordem?.toLowerCase().includes(term) ||
        r.data?.includes(term)
      );
    }

    // Chip filters
    result = result.filter(r => {
      if (chipFilterMaterial.length > 0 && !chipFilterMaterial.includes(r.material)) return false;
      if (chipFilterFornecedor.length > 0 && !chipFilterFornecedor.includes(r.fornecedor)) return false;
      if (chipFilterEmpresa.length > 0 && !chipFilterEmpresa.includes(r.empresa)) return false;
      if (chipFilterVeiculo.length > 0 && !chipFilterVeiculo.includes(r.prefixo)) return false;
      return true;
    });
    
    return result;
  }, [records, filterStartDate, filterEndDate, searchTerm, selectedEmpresa, selectedMaterial, chipFilterMaterial, chipFilterFornecedor, chipFilterEmpresa, chipFilterVeiculo]);

  // Active date range for display
  const activeDateRange = useMemo(() => {
    if (filterStartDate || filterEndDate) {
      return {
        start: filterStartDate ? format(filterStartDate, 'dd/MM/yyyy') : dateRange.start,
        end: filterEndDate ? format(filterEndDate, 'dd/MM/yyyy') : dateRange.end,
      };
    }
    return dateRange;
  }, [filterStartDate, filterEndDate, dateRange]);

  const hasFilter = filterStartDate || filterEndDate || searchTerm.trim() || selectedEmpresa !== 'todos' || selectedMaterial !== 'todos' || chipFilterMaterial.length > 0 || chipFilterFornecedor.length > 0 || chipFilterEmpresa.length > 0 || chipFilterVeiculo.length > 0;

  const clearFilters = () => {
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    setSearchTerm('');
    setSelectedEmpresa('todos');
    setSelectedMaterial('todos');
    setChipFilterMaterial([]);
    setChipFilterFornecedor([]);
    setChipFilterEmpresa([]);
    setChipFilterVeiculo([]);
  };

  // Summarize by material
  const materialSummary: MaterialSummary[] = useMemo(() => {
    const map = new Map<string, MaterialSummary>();
    records.forEach(r => {
      const mat = (r.material || '').trim() || 'Outros';
      const forn = r.fornecedor || 'Sem Fornecedor';
      const key = `${mat}|${forn}`;
      if (!map.has(key)) {
        map.set(key, { material: mat, fornecedor: forn, viagens: 0, toneladas: 0 });
      }
      const item = map.get(key)!;
      item.viagens += 1;
      item.toneladas += (r.toneladaTicket || r.tonelada || 0);
    });
    return Array.from(map.values()).sort((a, b) => a.fornecedor.localeCompare(b.fornecedor) || a.material.localeCompare(b.material));
  }, [records]);

  // Summarize by empresa
  const empresaSummary: EmpresaSummary[] = useMemo(() => {
    const map = new Map<string, { empresa: string; viagens: number; veiculos: Set<string> }>();
    records.forEach(r => {
      const key = r.empresa || 'Outros';
      if (!map.has(key)) {
        map.set(key, { empresa: key, viagens: 0, veiculos: new Set() });
      }
      const item = map.get(key)!;
      item.viagens += 1;
      if (r.prefixo) item.veiculos.add(r.prefixo);
    });
    return Array.from(map.values())
      .map(e => ({ empresa: e.empresa, viagens: e.viagens, veiculos: e.veiculos.size }))
      .sort((a, b) => b.viagens - a.viagens);
  }, [records]);

  // Records filtrados para exibição na tela: dia atual (sem filtro de data) ou período selecionado
  const displayRecords = useMemo(() => {
    const hasDateFilter = filterStartDate || filterEndDate;
    if (hasDateFilter) return filteredRecords;
    const todayStr = format(new Date(), 'dd/MM/yyyy');
    return filteredRecords.filter(r => r.data === todayStr);
  }, [filteredRecords, filterStartDate, filterEndDate]);

  const displayDateLabel = useMemo(() => {
    const hasDateFilter = filterStartDate || filterEndDate;
    if (hasDateFilter) {
      return activeDateRange.start === activeDateRange.end
        ? activeDateRange.start
        : `${activeDateRange.start} a ${activeDateRange.end}`;
    }
    return format(new Date(), 'dd/MM/yyyy');
  }, [filterStartDate, filterEndDate, activeDateRange]);

  // Materials grouped by Fornecedor — ALL records (Acumulado Geral)
  const materialsByFornecedorTotal = useMemo(() => {
    const grouped = new Map<string, { material: string; viagens: number; toneladas: number }[]>();
    records.forEach(r => {
      const forn = r.fornecedor || 'Sem Fornecedor';
      const mat = (r.material || '').trim() || 'Outros';
      if (!grouped.has(forn)) grouped.set(forn, []);
      const arr = grouped.get(forn)!;
      const existing = arr.find(m => m.material === mat);
      if (existing) { existing.viagens += 1; existing.toneladas += (r.toneladaTicket || r.tonelada); }
      else arr.push({ material: mat, viagens: 1, toneladas: (r.toneladaTicket || r.tonelada) });
    });
    return Array.from(grouped.entries())
      .map(([fornecedor, materiais]) => ({
        fornecedor,
        materiais: materiais.sort((a, b) => a.material.localeCompare(b.material)),
        totalViagens: materiais.reduce((s, m) => s + m.viagens, 0),
        totalToneladas: materiais.reduce((s, m) => s + m.toneladas, 0),
      }))
      .sort((a, b) => b.totalToneladas - a.totalToneladas);
  }, [records]);

  // Materials grouped by Fornecedor — FILTERED/DISPLAY records (Período Selecionado)
  const materialsByFornecedor = useMemo(() => {
    const grouped = new Map<string, { material: string; viagens: number; toneladas: number }[]>();
    const veiculosByForn = new Map<string, Set<string>>();
    displayRecords.forEach(r => {
        const forn = r.fornecedor || 'Sem Fornecedor';
        const mat = (r.material || '').trim() || 'Outros';
        if (!grouped.has(forn)) grouped.set(forn, []);
        if (!veiculosByForn.has(forn)) veiculosByForn.set(forn, new Set());
        if (r.prefixo) veiculosByForn.get(forn)!.add(r.prefixo);
        const arr = grouped.get(forn)!;
        const existing = arr.find(m => m.material === mat);
        if (existing) {
          existing.viagens += 1;
          existing.toneladas += (r.toneladaTicket || r.tonelada);
        } else {
          arr.push({ material: mat, viagens: 1, toneladas: (r.toneladaTicket || r.tonelada) });
        }
      });
    return Array.from(grouped.entries())
      .map(([fornecedor, materiais]) => ({
        fornecedor,
        materiais: materiais.sort((a, b) => a.material.localeCompare(b.material)),
        totalViagens: materiais.reduce((s, m) => s + m.viagens, 0),
        totalToneladas: materiais.reduce((s, m) => s + m.toneladas, 0),
        totalVeiculos: veiculosByForn.get(fornecedor)?.size || 0,
      }))
      .sort((a, b) => b.totalToneladas - a.totalToneladas);
  }, [displayRecords]);

  // Diesel detection
  const DIESEL_DENSITY = 0.832;
  const isDieselRecord = (r: PedreiraRecord) => {
    const combined = `${r.material} ${r.fornecedor}`.toLowerCase();
    return combined.includes('diesel') || combined.includes('óleo diesel') || combined.includes('oleo diesel');
  };

  // Totals — always from ALL records (full period)
  const totalViagens = records.length;
  const totalToneladas = records.reduce((sum, r) => sum + (r.toneladaTicket || r.tonelada || 0), 0);
  const totalToneladasCalcObra = records.reduce((sum, r) => sum + (r.toneladaCalcObra || 0), 0);
  const totalVeiculos = new Set(records.map(r => r.prefixo).filter(Boolean)).size;

  // Diesel totals
  const hasDieselRecords = displayRecords.some(isDieselRecord);
  const totalLitrosDiesel = displayRecords
    .filter(isDieselRecord)
    .reduce((sum, r) => {
      const pesoLiq = (r.pesoLiquido || 0);
      return sum + (pesoLiq > 0 ? pesoLiq / DIESEL_DENSITY : 0);
    }, 0);

  // Vehicle KPI (excluindo Areia Express) — always full period
  const vehicleKpi = useMemo(() => {
    const nonAE = records.filter(r => !(r.fornecedor || '').toLowerCase().includes('areia express'));
    const veiculos = new Map<string, string>();
    nonAE.forEach(r => {
      if (r.prefixo && !veiculos.has(r.prefixo)) veiculos.set(r.prefixo, r.descricao || '');
    });
    let basculante = 0;
    let reboque = 0;
    let outros = 0;
    veiculos.forEach((desc) => {
      const d = desc.toLowerCase();
      if (d.includes('basculante')) basculante++;
      else if (d.includes('reboque')) reboque++;
      else outros++;
    });
    return { total: veiculos.size, basculante, reboque, outros };
  }, [records]);

  // Today stats
  const todayStats = useMemo(() => {
    const todayStr = format(new Date(), 'dd/MM/yyyy');
    const todayRecs = filteredRecords.filter(r => r.data === todayStr);
    return {
      viagens: todayRecs.length,
      toneladas: todayRecs.reduce((s, r) => s + (r.toneladaTicket || r.tonelada || 0), 0),
    };
  }, [filteredRecords]);

  // Current month stats
  const monthStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthRecs = filteredRecords.filter(r => {
      const d = parseDate(r.data);
      return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    return {
      viagens: monthRecs.length,
      toneladas: monthRecs.reduce((s, r) => s + (r.toneladaTicket || r.tonelada || 0), 0),
    };
  }, [filteredRecords]);

  const formatNumber = (num: number, decimals = 2) =>
    num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const prodMatSort = useTableSort(materialSummary);
  const prodEmpSort = useTableSort(empresaSummary);

  // ─── Supplier summaries: Herval vs Others ───────────────────────────────────
  const HERVAL_KEY = 'Herval';

  interface FornecedorMaterialStat {
    material: string;
    viagens: number;
    toneladas: number;
    veiculos: Set<string>;
  }

  const hervalRecords = useMemo(() => displayRecords.filter(r =>
    (r.fornecedor || '').toLowerCase().includes('herval')
  ), [displayRecords]);

  const outrosRecords = useMemo(() => displayRecords.filter(r =>
    !(r.fornecedor || '').toLowerCase().includes('herval')
  ), [displayRecords]);

  const buildFornecedorMaterialMap = (recs: PedreiraRecord[]): FornecedorMaterialStat[] => {
    const map = new Map<string, FornecedorMaterialStat>();
    recs.forEach(r => {
      const key = r.material || 'Outros';
      if (!map.has(key)) map.set(key, { material: key, viagens: 0, toneladas: 0, veiculos: new Set() });
      const item = map.get(key)!;
      item.viagens += 1;
      item.toneladas += (r.toneladaTicket || r.tonelada);
      if (r.prefixo) item.veiculos.add(r.prefixo);
    });
    return Array.from(map.values()).sort((a, b) => b.viagens - a.viagens);
  };

  const hervalMateriais = useMemo(() => buildFornecedorMaterialMap(hervalRecords), [hervalRecords]);
  const outrosMateriais = useMemo(() => buildFornecedorMaterialMap(outrosRecords), [outrosRecords]);

  const hervalTotal = { viagens: hervalRecords.length, toneladas: hervalRecords.reduce((s, r) => s + (r.toneladaTicket || r.tonelada), 0) };
  const outrosTotal = { viagens: outrosRecords.length, toneladas: outrosRecords.reduce((s, r) => s + (r.toneladaTicket || r.tonelada), 0) };

  // Build WhatsApp summary
  const generateWhatsAppMessage = () => {
    const dateLabel = activeDateRange.start === activeDateRange.end
      ? activeDateRange.start
      : `${activeDateRange.start} a ${activeDateRange.end}`;

    let msg = `⛰️ *RELATÓRIO DE CARREGAMENTO - PEDREIRA*\n📅 ${dateLabel}\n\n`;
    msg += `📊 *TOTAIS GERAIS*\n`;
    msg += `• Total de Viagens: ${totalViagens}\n`;
    msg += `• Total de Toneladas: ${formatNumber(totalToneladas)} t\n`;
    msg += `• Veículos: ${totalVeiculos}\n`;

    if (hervalRecords.length > 0) {
      msg += `\n🟢 *HERVAL* — ${hervalTotal.viagens} viagens | ${formatNumber(hervalTotal.toneladas)} t\n`;
      hervalMateriais.forEach(m => {
        msg += `  • ${m.material}: ${m.viagens} viagens (${formatNumber(m.toneladas)} t)\n`;
      });
    }

    if (outrosRecords.length > 0) {
      const outrosFornecedores = [...new Set(outrosRecords.map(r => r.fornecedor).filter(Boolean))];
      outrosFornecedores.forEach(forn => {
        const fornRecs = outrosRecords.filter(r => r.fornecedor === forn);
        const fornTon = fornRecs.reduce((s, r) => s + (r.toneladaTicket || r.tonelada), 0);
        msg += `\n🔵 *${forn}* — ${fornRecs.length} viagens | ${formatNumber(fornTon)} t\n`;
        const matMap = new Map<string, { viagens: number; ton: number }>();
        fornRecs.forEach(r => {
          const k = r.material || 'Outros';
          if (!matMap.has(k)) matMap.set(k, { viagens: 0, ton: 0 });
          matMap.get(k)!.viagens += 1;
          matMap.get(k)!.ton += (r.toneladaTicket || r.tonelada);
        });
        matMap.forEach((v, mat) => {
          msg += `  • ${mat}: ${v.viagens} viagens (${formatNumber(v.ton)} t)\n`;
        });
      });
    }

    if (whatsAppObservacao) {
      msg += `\n📝 *Observação:*\n${whatsAppObservacao}\n`;
    }

    msg += `\n---\n_Enviado via ApropriAPP_`;
    return msg;
  };

  const sendWhatsApp = () => {
    const message = encodeURIComponent(generateWhatsAppMessage());
    window.open(`https://wa.me/?text=${message}`, '_blank');
    setShowWhatsApp(false);
    setWhatsAppObservacao('');
  };

  const handleExportPDFFornecedor = () => {
    const dateLabel = activeDateRange.start === activeDateRange.end
      ? activeDateRange.start
      : `${activeDateRange.start} a ${activeDateRange.end}`;

    const buildFornecedorSection = (label: string, recs: PedreiraRecord[], mats: FornecedorMaterialStat[], total: { viagens: number; toneladas: number }, color: string) => {
      if (recs.length === 0) return '';
      return `
        <div class="section" style="border-left: 4px solid ${color}; margin-bottom: 20px;">
          <div class="section-header" style="background: ${color};">🏭 ${label} — ${total.viagens} viagens — ${formatNumber(total.toneladas)} t</div>
          <table>
            <thead><tr><th>Material</th><th>Viagens</th><th>Toneladas</th><th>Veículos</th></tr></thead>
            <tbody>
              ${mats.map(m => `<tr><td>${m.material}</td><td>${m.viagens}</td><td>${formatNumber(m.toneladas)}</td><td>${m.veiculos.size}</td></tr>`).join('')}
              <tr class="subtotal"><td>TOTAL</td><td>${total.viagens}</td><td>${formatNumber(total.toneladas)}</td><td></td></tr>
            </tbody>
          </table>
          <div style="margin-top: 10px;">
            <table>
              <thead><tr><th>#</th><th>Data</th><th>Hora</th><th>Veículo</th><th>Fornecedor</th><th>Material</th><th>Toneladas</th></tr></thead>
              <tbody>
                ${recs.map((r, i) => `<tr><td>${i+1}</td><td>${r.data}</td><td>${r.hora}</td><td><b>${r.prefixo}</b></td><td>${r.fornecedor||'—'}</td><td>${r.material}</td><td><b>${formatNumber(r.tonelada)}</b></td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    const printContent = `<!DOCTYPE html><html><head>
      <title>Relatório por Fornecedor — ${dateLabel}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { margin:0; padding:0; box-sizing:border-box; font-family:Arial,sans-serif; }
        body { padding:10px; font-size:9px; }
        .header { background: linear-gradient(135deg,#ea580c,#f97316); color:white; padding:14px; text-align:center; border-radius:8px; margin-bottom:14px; }
        .header h1 { font-size:16px; }
        .section { border-radius:6px; overflow:hidden; margin-bottom:16px; border:1px solid #e5e7eb; }
        .section-header { color:white; padding:8px 12px; font-weight:bold; font-size:11px; }
        table { width:100%; border-collapse:collapse; }
        th { background:#ea580c; color:white; padding:5px 4px; font-size:8px; text-align:center; }
        td { border:1px solid #e5e7eb; padding:3px 4px; text-align:center; }
        tr:nth-child(even) { background:#f9fafb; }
        .subtotal { background:#fed7aa !important; font-weight:bold; }
        .footer { text-align:center; margin-top:12px; font-size:8px; color:#6b7280; border-top:1px solid #e5e7eb; padding-top:8px; }
        @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
      </style></head><body>
      <div class="header">
        <h1>RELATÓRIO POR FORNECEDOR — PEDREIRA</h1>
        <p>${dateLabel}</p>
        <p style="margin-top:4px;opacity:.85;">Total Geral: ${totalViagens} viagens — ${formatNumber(totalToneladas)} t</p>
      </div>
      ${buildFornecedorSection('HERVAL', hervalRecords, hervalMateriais, hervalTotal, '#16a34a')}
      ${buildFornecedorSection('OUTROS FORNECEDORES', outrosRecords, outrosMateriais, outrosTotal, '#2563eb')}
      <div class="footer">Gerado em ${new Date().toLocaleString('pt-BR')} • ApropriAPP</div>
      </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(printContent); w.document.close(); setTimeout(() => w.print(), 300); }
  };

  // Group records by material for exports
  const recordsByMaterial = useMemo(() => {
    const grouped = new Map<string, PedreiraRecord[]>();
    filteredRecords.forEach(r => {
      const mat = r.material || 'Outros';
      if (!grouped.has(mat)) grouped.set(mat, []);
      grouped.get(mat)!.push(r);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredRecords]);

  // Group records by day with material breakdown
  const dailySummary: DaySummary[] = useMemo(() => {
    const dayMap = new Map<string, { viagens: number; toneladas: number; matMap: Map<string, { viagens: number; toneladas: number }> }>();
    filteredRecords.forEach(r => {
      const day = r.data || 'N/A';
      if (!dayMap.has(day)) {
        dayMap.set(day, { viagens: 0, toneladas: 0, matMap: new Map() });
      }
      const d = dayMap.get(day)!;
      d.viagens += 1;
      d.toneladas += r.tonelada;
      const mat = r.material || 'Outros';
      if (!d.matMap.has(mat)) d.matMap.set(mat, { viagens: 0, toneladas: 0 });
      const m = d.matMap.get(mat)!;
      m.viagens += 1;
      m.toneladas += r.tonelada;
    });
    // Sort by date (DD/MM/YYYY)
    return Array.from(dayMap.entries())
      .sort((a, b) => {
        const [da, ma, ya] = a[0].split('/').map(Number);
        const [db, mb, yb] = b[0].split('/').map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      })
      .map(([data, val]) => ({
        data,
        viagens: val.viagens,
        toneladas: val.toneladas,
        materiais: Array.from(val.matMap.entries())
          .map(([material, v]) => ({ material, viagens: v.viagens, toneladas: v.toneladas }))
          .sort((a, b) => b.viagens - a.viagens),
      }));
  }, [filteredRecords]);

  const isMultipleDays = dailySummary.length > 1;

  const handleExportPDF = async () => {
    // Convert logo to base64 for reliable rendering inside the print window
    const logoBase64 = await toBase64(activeLogo);
    const filterBadges: string[] = [];
    if (selectedEmpresa !== 'todos') filterBadges.push(`🏢 Empresa: ${selectedEmpresa}`);
    if (selectedMaterial !== 'todos') filterBadges.push(`📦 Material: ${selectedMaterial}`);

    // ── Determinar registros para detalhamento:
    // Se há filtro de data → usa registros filtrados (período selecionado)
    // Se não há filtro de data → usa apenas registros do dia atual
    const hasDateFilter = filterStartDate || filterEndDate;
    const todayStr = format(new Date(), 'dd/MM/yyyy');

    let selectedDayRecords: PedreiraRecord[];
    let selectedDayStr: string;

    if (hasDateFilter) {
      selectedDayRecords = filteredRecords;
      selectedDayStr = activeDateRange.start === activeDateRange.end
        ? activeDateRange.start
        : `${activeDateRange.start} a ${activeDateRange.end}`;
    } else {
      selectedDayRecords = filteredRecords.filter(r => r.data === todayStr);
      selectedDayStr = todayStr;
    }

    const selectedDayViagens = selectedDayRecords.length;
    const selectedDayToneladas = selectedDayRecords.reduce((s, r) => s + (r.toneladaTicket || r.tonelada), 0);

    // Resumo por material do período
    const selectedDayMatMap = new Map<string, { material: string; fornecedor: string; viagens: number; toneladas: number }>();
    selectedDayRecords.forEach(r => {
      const mat = r.material || 'Outros';
      const forn = r.fornecedor || 'Sem Fornecedor';
      const k = `${mat}|${forn}`;
      if (!selectedDayMatMap.has(k)) selectedDayMatMap.set(k, { material: mat, fornecedor: forn, viagens: 0, toneladas: 0 });
      selectedDayMatMap.get(k)!.viagens += 1;
      selectedDayMatMap.get(k)!.toneladas += (r.toneladaTicket || r.tonelada);
    });
    const selectedDayMateriais = Array.from(selectedDayMatMap.values())
      .sort((a, b) => a.material.localeCompare(b.material) || a.fornecedor.localeCompare(b.fornecedor));

    // Agrupamento por material para os detalhamentos
    const selectedDayByMaterial = new Map<string, typeof selectedDayRecords>();
    selectedDayRecords.forEach(r => {
      const mat = r.material || 'Outros';
      if (!selectedDayByMaterial.has(mat)) selectedDayByMaterial.set(mat, []);
      selectedDayByMaterial.get(mat)!.push(r);
    });
    const selectedDayByMaterialArr = Array.from(selectedDayByMaterial.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    // Generate detail table as a PIVOT — all vehicles as rows, materials as columns
    // Group all day records by vehicle, then by material
    const allMaterialsDay = Array.from(new Set(selectedDayRecords.map(r => r.material || 'Outros'))).sort();
    const pivotVehicleMap = new Map<string, { empresa: string; fornecedor: string; byMat: Map<string, number>; total: number; totalTon: number; totalTonTicket: number; totalTonCalcObra: number }>();
    selectedDayRecords.forEach(r => {
      const key = r.prefixo || '—';
      if (!pivotVehicleMap.has(key)) {
        pivotVehicleMap.set(key, { empresa: r.empresa || '', fornecedor: r.fornecedor || '', byMat: new Map(), total: 0, totalTon: 0, totalTonTicket: 0, totalTonCalcObra: 0 });
      }
      const v = pivotVehicleMap.get(key)!;
      const mat = r.material || 'Outros';
      v.byMat.set(mat, (v.byMat.get(mat) || 0) + 1);
      v.total += 1;
      v.totalTon += r.tonelada;
      v.totalTonTicket += (r.toneladaTicket || r.tonelada || 0);
      v.totalTonCalcObra += (r.toneladaCalcObra || 0);
    });
    const pivotRows = Array.from(pivotVehicleMap.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }));

    // Column totals
    const colTotals = new Map<string, number>();
    allMaterialsDay.forEach(mat => {
      colTotals.set(mat, selectedDayRecords.filter(r => (r.material || 'Outros') === mat).length);
    });

    const selectedDayTonTicket = selectedDayRecords.reduce((s, r) => s + (r.toneladaTicket || r.tonelada || 0), 0);
    const selectedDayTonCalcObra = selectedDayRecords.reduce((s, r) => s + (r.toneladaCalcObra || 0), 0);

    const materialTablesHtml = selectedDayViagens === 0 ? '' : `
      <div class="material-section">
        <div class="material-header">📋 Detalhamento por Veículo e Material — ${selectedDayStr}</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Veículo</th>
              <th>Empresa</th>
              ${allMaterialsDay.map(mat => `<th style="text-align:center;">${mat}</th>`).join('')}
              <th style="text-align:center;background:#1d3557;">Total Viagens</th>
              
              <th style="text-align:right;background:#2563eb;">Ton. Ticket</th>
              <th style="text-align:right;background:#059669;">Ton. Calc Obra</th>
              <th style="text-align:right;background:#d97706;">Diferença</th>
            </tr>
          </thead>
          <tbody>
            ${pivotRows.map(([prefixo, v], idx) => `
              <tr>
                <td>${idx + 1}.</td>
                <td style="font-weight:bold;text-align:left;padding-left:4px;">${prefixo}</td>
                <td style="font-size:8px;text-align:left;padding-left:4px;">${v.empresa}</td>
                ${allMaterialsDay.map(mat => `<td style="text-align:center;">${v.byMat.get(mat) || '—'}</td>`).join('')}
                <td style="text-align:center;font-weight:bold;background:#e0e7ff;">${v.total}</td>
                
                <td style="text-align:right;font-weight:bold;background:#dbeafe;color:#2563eb;">${v.totalTonTicket > 0 ? formatNumber(v.totalTonTicket) : '—'}</td>
                <td style="text-align:right;font-weight:bold;background:#d1fae5;color:#059669;">${v.totalTonCalcObra > 0 ? formatNumber(v.totalTonCalcObra) : '—'}</td>
                <td style="text-align:right;font-weight:bold;background:#fef3c7;color:${(v.totalTonTicket > 0 && v.totalTonCalcObra > 0) ? ((v.totalTonCalcObra - v.totalTonTicket) >= 0 ? '#2563eb' : '#dc2626') : '#d97706'};">${(v.totalTonTicket > 0 && v.totalTonCalcObra > 0) ? formatNumber(v.totalTonCalcObra - v.totalTonTicket) : '—'}</td>
              </tr>
            `).join('')}
            <tr class="subtotal-row">
              <td colspan="3" style="text-align:right;padding-right:8px;font-weight:bold;">TOTAL</td>
              ${allMaterialsDay.map(mat => `<td style="text-align:center;font-weight:bold;">${colTotals.get(mat) || 0}</td>`).join('')}
              <td style="text-align:center;font-weight:bold;">${selectedDayViagens}</td>
              
              <td style="text-align:right;font-weight:bold;color:#2563eb;">${selectedDayTonTicket > 0 ? formatNumber(selectedDayTonTicket) : '—'}</td>
              <td style="text-align:right;font-weight:bold;color:#059669;">${selectedDayTonCalcObra > 0 ? formatNumber(selectedDayTonCalcObra) : '—'}</td>
              <td style="text-align:right;font-weight:bold;color:#d97706;">${(selectedDayTonTicket > 0 && selectedDayTonCalcObra > 0) ? formatNumber(selectedDayTonTicket - selectedDayTonCalcObra) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    // Detalhamento por viagem (individual trips)
    const sortedDayRecords = [...selectedDayRecords].sort((a, b) => {
      const dateA = a.data ? a.data.split('/').reverse().join('') : '';
      const dateB = b.data ? b.data.split('/').reverse().join('') : '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.hora || '').localeCompare(a.hora || '');
    });

    const totalTonTicketDay = sortedDayRecords.reduce((s, r) => s + (r.toneladaTicket || r.tonelada || 0), 0);
    const totalTonCalcObraDay = sortedDayRecords.reduce((s, r) => s + (r.toneladaCalcObra || 0), 0);
    // Diferença: somar apenas registros com ambos os valores preenchidos (mesmo cálculo da tela)
    const recsWithBothDay = sortedDayRecords.filter(r => (r.toneladaTicket || r.tonelada || 0) > 0 && (r.toneladaCalcObra || 0) > 0);
    const totalDifDay = recsWithBothDay.reduce((s, r) => s + ((r.toneladaCalcObra || 0) - (r.toneladaTicket || r.tonelada || 0)), 0);

    const detalhamentoViagemHtml = selectedDayViagens === 0 ? '' : `
      <div class="material-section" style="margin-top:20px;">
        <div class="material-header">🚛 Detalhamento por Viagem — ${selectedDayStr} (${selectedDayViagens} viagens)</div>
        <table>
          <thead>
            <tr>
              <th style="width:3%;">#</th>
              <th style="width:7%;">Data</th>
              <th style="width:5%;">Hora</th>
              <th style="width:5%;">Nº OS</th>
              <th style="width:7%;">Veículo</th>
              <th style="width:12%;text-align:left;">Descrição</th>
              <th style="width:10%;text-align:left;">Empresa</th>
              <th style="width:10%;text-align:left;">Fornecedor</th>
              <th style="width:10%;text-align:left;">Material</th>
              <th style="width:9%;text-align:right;">Ton. Ticket</th>
              <th style="width:9%;text-align:right;">Ton. Calc Obra</th>
              <th style="width:8%;text-align:right;">Diferença</th>
            </tr>
          </thead>
          <tbody>
            ${sortedDayRecords.map((r, i) => {
              const dif = (r.toneladaTicket && r.toneladaCalcObra && r.toneladaTicket > 0 && r.toneladaCalcObra > 0)
                ? r.toneladaCalcObra - r.toneladaTicket : null;
              const difColor = dif !== null ? (dif >= 0 ? '#2563eb' : '#dc2626') : '#6b7280';
              return `<tr style="background:${i % 2 === 0 ? '#1d355708' : '#1d355718'};">
                <td>${i + 1}</td>
                <td>${r.data}</td>
                <td>${r.hora || ''}</td>
                <td style="font-weight:600;">${r.ordem || '—'}</td>
                <td style="font-weight:bold;">${r.prefixo || '—'}</td>
                <td style="text-align:left;padding-left:4px;font-size:8px;">${r.descricao || 'Cam. Basculante'}</td>
                <td style="text-align:left;padding-left:4px;font-size:8px;">${r.empresa || '—'}</td>
                <td style="text-align:left;padding-left:4px;font-size:8px;">${r.fornecedor || '—'}</td>
                <td style="text-align:left;padding-left:4px;font-size:8px;">${r.material || '—'}</td>
                <td style="text-align:right;font-weight:bold;">${((r.toneladaTicket && r.toneladaTicket > 0) || r.tonelada > 0) ? formatNumber(r.toneladaTicket || r.tonelada || 0) : '—'}</td>
                <td style="text-align:right;font-weight:600;color:#059669;">${(r.toneladaCalcObra && r.toneladaCalcObra > 0) ? formatNumber(r.toneladaCalcObra) : '—'}</td>
                <td style="text-align:right;font-weight:600;color:${difColor};">${dif !== null ? formatNumber(dif) : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr class="subtotal-row">
              <td colspan="9" style="text-align:right;padding-right:8px;font-weight:bold;">TOTAL</td>
              <td style="text-align:right;font-weight:bold;color:#2563eb;">${totalTonTicketDay > 0 ? formatNumber(totalTonTicketDay) : '—'}</td>
              <td style="text-align:right;font-weight:bold;color:#059669;">${totalTonCalcObraDay > 0 ? formatNumber(totalTonCalcObraDay) : '—'}</td>
              <td style="text-align:right;font-weight:bold;color:${recsWithBothDay.length > 0 ? (totalDifDay >= 0 ? '#2563eb' : '#dc2626') : '#6b7280'};">${recsWithBothDay.length > 0 ? formatNumber(totalDifDay) : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
    const dayFornGroups = new Map<string, { materiais: typeof selectedDayMateriais; totalV: number; totalT: number }>();
    selectedDayMateriais.forEach(m => {
      if (!dayFornGroups.has(m.fornecedor)) dayFornGroups.set(m.fornecedor, { materiais: [], totalV: 0, totalT: 0 });
      const g = dayFornGroups.get(m.fornecedor)!;
      g.materiais.push(m);
      g.totalV += m.viagens;
      g.totalT += m.toneladas;
    });

    let dayRows = '';
    dayFornGroups.forEach((g, forn) => {
      dayRows += `<tr style="background:#f97316;color:white;font-weight:bold;"><td colspan="3" style="text-align:left;padding:5px 8px;font-size:9px;">🏭 ${forn}</td></tr>`;
      g.materiais.forEach(m => {
        dayRows += `<tr><td style="text-align:left;padding-left:16px;">${m.material}</td><td>${m.viagens}</td><td>${formatNumber(m.toneladas)}</td></tr>`;
      });
      dayRows += `<tr style="background:#fed7aa;font-weight:bold;"><td style="text-align:right;padding-right:8px;">Subtotal</td><td>${g.totalV}</td><td>${formatNumber(g.totalT)}</td></tr>`;
    });

    const resumoDiaHtml = `
      <div class="summary-card day-card">
        <div class="summary-title day-title">📅 Resumo do Período (${selectedDayStr})</div>
        ${selectedDayViagens === 0
          ? `<p style="padding:12px;font-size:9px;color:#6b7280;text-align:center;">Sem registros para ${selectedDayStr}</p>`
          : `<table>
              <thead>
                <tr class="day-th">
                  <th>Material</th>
                  <th>Viagens</th>
                  <th>Toneladas</th>
                </tr>
              </thead>
              <tbody>
                ${dayRows}
                <tr class="total-row">
                  <td style="text-align:left;padding-left:8px;"><b>Total do período</b></td>
                  <td><b>${selectedDayViagens}</b></td>
                  <td><b>${formatNumber(selectedDayToneladas)}</b></td>
                </tr>
              </tbody>
            </table>`
        }
      </div>
    `;

    // Quadro "Resumo Acumulado Geral" — agrupado por fornecedor com subtotais
    const fornecedorGroups = new Map<string, { materiais: typeof materialSummary; totalViagens: number; totalToneladas: number }>();
    materialSummary.forEach(m => {
      if (!fornecedorGroups.has(m.fornecedor)) fornecedorGroups.set(m.fornecedor, { materiais: [], totalViagens: 0, totalToneladas: 0 });
      const g = fornecedorGroups.get(m.fornecedor)!;
      g.materiais.push(m);
      g.totalViagens += m.viagens;
      g.totalToneladas += m.toneladas;
    });

    let acumuladoRows = '';
    let rowIdx = 0;
    fornecedorGroups.forEach((g, forn) => {
      acumuladoRows += `<tr style="background:#2d5a8e;color:white;font-weight:bold;"><td colspan="4" style="text-align:left;padding:6px 8px;font-size:10px;">🏭 ${forn}</td></tr>`;
      g.materiais.forEach(m => {
        acumuladoRows += `<tr style="background:${rowIdx % 2 === 0 ? '#e8edf8' : '#d0d9f0'};"><td style="text-align:left;padding-left:16px;">${m.material}</td><td style="text-align:center;">${m.viagens}</td><td style="text-align:center;">${formatNumber(m.toneladas)}</td><td></td></tr>`;
        rowIdx++;
      });
      acumuladoRows += `<tr style="background:#c7d2e8;font-weight:bold;"><td style="text-align:right;padding-right:8px;">Subtotal ${forn}</td><td style="text-align:center;">${g.totalViagens}</td><td style="text-align:center;">${formatNumber(g.totalToneladas)}</td><td></td></tr>`;
    });

    const resumoAcumuladoHtml = `
      <div class="summary-card navy-card">
        <div class="summary-title navy-title">📊 Resumo Acumulado Geral (${dateRange.start} — ${dateRange.end})</div>
        <table>
          <thead>
            <tr>
              <th class="navy-th">Material</th>
              <th class="navy-th">Viagens</th>
              <th class="navy-th">Toneladas</th>
              <th class="navy-th" style="width:1px;"></th>
            </tr>
          </thead>
          <tbody>
            ${acumuladoRows}
            <tr style="background:#1d3557;color:white;font-weight:bold;">
              <td style="text-align:left;padding-left:8px;">Total geral</td>
              <td style="text-align:center;">${totalViagens}</td>
              <td style="text-align:center;">${formatNumber(totalToneladas)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Carregamento - ${activeDateRange.start} a ${activeDateRange.end}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
          body { padding: 15px; font-size: 10px; }
          .header { background: linear-gradient(135deg, #1d3557, #2d5a8e); color: white; padding: 0; border-radius: 10px; margin-bottom: 15px; overflow: hidden; }
          .header-top { display: flex; align-items: center; gap: 16px; padding: 14px 18px 10px 18px; }
          .header-logo { height: 72px; width: auto; object-fit: contain; background: rgba(255,255,255,0.15); border-radius: 8px; padding: 6px; flex-shrink: 0; }
          .header-info { flex: 1; }
          .header-obra-nome { font-size: 13px; font-weight: 700; opacity: 0.85; margin-bottom: 2px; letter-spacing: 0.3px; }
          .header-obra-local { font-size: 10px; opacity: 0.65; margin-bottom: 6px; }
          .header-title { font-size: 20px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.1; }
          .header-bottom { background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between; padding: 7px 18px; border-top: 1px solid rgba(255,255,255,0.15); }
          .header-period { font-size: 11px; opacity: 0.9; }
          .header-preenchimento { font-size: 10px; background: #f97316; color: white; padding: 3px 10px; border-radius: 20px; font-weight: 600; letter-spacing: 0.3px; }
          .header .filter-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 12px; margin-top: 8px; margin-right: 5px; font-size: 11px; }
          .summary-grid { display: flex; gap: 15px; margin-bottom: 15px; }
          .summary-card { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
          .navy-card { border: 2px solid #1d3557; }
          .navy-title { background: #1d3557 !important; color: white !important; padding: 8px 12px; font-weight: bold; font-size: 11px; }
          .navy-th { background: #1d3557 !important; color: white !important; }
          .day-title { background: #f3f4f6; padding: 8px 12px; font-weight: bold; font-size: 11px; }
          .summary-title { background: #f3f4f6; padding: 8px 12px; font-weight: bold; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th { background: linear-gradient(135deg, #ea580c, #f97316); color: white; padding: 6px 4px; text-align: center; font-size: 8px; }
          td { border: 1px solid #e5e7eb; padding: 4px 3px; text-align: center; }
          tr:nth-child(even) { background: #f9fafb; }
          .total-row { background: #fed7aa !important; font-weight: bold; }
          .subtotal-row { background: #fef3c7 !important; font-weight: bold; }
          .material-section { margin-top: 15px; page-break-inside: avoid; }
          .material-header { background: #f97316; color: white; padding: 8px 12px; font-weight: bold; font-size: 11px; border-radius: 6px 6px 0 0; }
          .footer { text-align: center; margin-top: 15px; font-size: 8px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-top">
            <img class="header-logo" src="${logoBase64}" alt="Logo" />
            <div class="header-info">
              ${obraConfig.nome ? `<div class="header-obra-nome">${obraConfig.nome}</div>` : ''}
              ${obraConfig.local ? `<div class="header-obra-local">📍 ${obraConfig.local}</div>` : ''}
              <div class="header-title">${title}</div>
            </div>
          </div>
          <div class="header-bottom">
            <span class="header-period">📅 Período: <b>${activeDateRange.start} — ${activeDateRange.end}</b></span>
          </div>
          ${filterBadges.length > 0 ? `<div style="padding:0 18px 10px;">${filterBadges.map(b => `<span class="filter-badge">${b}</span>`).join('')}</div>` : ''}
        </div>

        <div class="summary-grid">
          ${resumoAcumuladoHtml}
          ${resumoDiaHtml}
        </div>

        ${detalhamentoViagemHtml || `<p style="padding:12px;font-size:9px;color:#6b7280;text-align:center;">Sem detalhamentos para ${selectedDayStr}</p>`}
        
        <div class="footer">
          <p>Gerado em: ${new Date().toLocaleString('pt-BR')} • ${filteredRecords.length} registros no período</p>
          <p>ApropriAPP - Gestão Inteligente de Obras</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
    }
  };

  const handleExportPDFDetalhamento = async () => {
    const logoBase64 = await toBase64(activeLogo);
    const hc = getHeaderCss();
    const hasDateFilter = filterStartDate || filterEndDate;
    const todayStr = format(new Date(), 'dd/MM/yyyy');

    let selectedDayRecords: PedreiraRecord[];
    let selectedDayStr: string;

    if (hasDateFilter) {
      selectedDayRecords = filteredRecords;
      selectedDayStr = activeDateRange.start === activeDateRange.end
        ? activeDateRange.start
        : `${activeDateRange.start} a ${activeDateRange.end}`;
    } else {
      selectedDayRecords = filteredRecords.filter(r => r.data === todayStr);
      selectedDayStr = todayStr;
    }

    const selectedDayViagens = selectedDayRecords.length;

    // ── Análise de divergência ──
    const recsWithBoth = selectedDayRecords.filter(r => r.toneladaTicket && r.toneladaTicket > 0 && r.toneladaCalcObra && r.toneladaCalcObra > 0);
    const totalTonTicket = recsWithBoth.reduce((s, r) => s + (r.toneladaTicket || 0), 0);
    const totalTonCalcObra = recsWithBoth.reduce((s, r) => s + (r.toneladaCalcObra || 0), 0);
    const totalDif = totalTonCalcObra - totalTonTicket;
    const totalDifKg = totalDif * 1000;
    const percentDif = totalTonTicket > 0 ? ((totalDif / totalTonTicket) * 100) : 0;

    // Per-record divergence
    const recsAnalysis = recsWithBoth.map(r => {
      const difTon = (r.toneladaCalcObra || 0) - (r.toneladaTicket || 0);
      const difKg = difTon * 1000;
      const difPercent = (r.toneladaTicket || 0) > 0 ? ((difTon / (r.toneladaTicket || 1)) * 100) : 0;
      return { ...r, difTon, difKg, difPercent };
    }).sort((a, b) => Math.abs(b.difTon) - Math.abs(a.difTon));

    const recsPositive = recsAnalysis.filter(r => r.difKg > 50);
    const recsNegative = recsAnalysis.filter(r => r.difKg < -50);
    const recsOk = recsAnalysis.filter(r => Math.abs(r.difKg) <= 50);

    const mediaAbsDif = recsAnalysis.length > 0
      ? recsAnalysis.reduce((s, r) => s + Math.abs(r.difKg), 0) / recsAnalysis.length : 0;

    // Divergence by vehicle
    const vehicleDivMap = new Map<string, { prefixo: string; empresa: string; viagens: number; tonTicket: number; tonObra: number; difTon: number }>();
    recsAnalysis.forEach(r => {
      const key = r.prefixo || '—';
      if (!vehicleDivMap.has(key)) vehicleDivMap.set(key, { prefixo: key, empresa: r.empresa || '', viagens: 0, tonTicket: 0, tonObra: 0, difTon: 0 });
      const v = vehicleDivMap.get(key)!;
      v.viagens += 1;
      v.tonTicket += (r.toneladaTicket || 0);
      v.tonObra += (r.toneladaCalcObra || 0);
      v.difTon += r.difTon;
    });
    const vehicleDivRows = Array.from(vehicleDivMap.values()).sort((a, b) => Math.abs(b.difTon) - Math.abs(a.difTon));

    // Divergence by material
    const matDivMap = new Map<string, { material: string; viagens: number; tonTicket: number; tonObra: number; difTon: number }>();
    recsAnalysis.forEach(r => {
      const key = r.material || 'Outros';
      if (!matDivMap.has(key)) matDivMap.set(key, { material: key, viagens: 0, tonTicket: 0, tonObra: 0, difTon: 0 });
      const m = matDivMap.get(key)!;
      m.viagens += 1;
      m.tonTicket += (r.toneladaTicket || 0);
      m.tonObra += (r.toneladaCalcObra || 0);
      m.difTon += r.difTon;
    });
    const matDivRows = Array.from(matDivMap.values()).sort((a, b) => Math.abs(b.difTon) - Math.abs(a.difTon));

    const difColor = (v: number) => v > 0.05 ? '#2563eb' : v < -0.05 ? '#dc2626' : '#059669';
    const difBg = (v: number) => v > 0.05 ? '#dbeafe' : v < -0.05 ? '#fee2e2' : '#d1fae5';
    const difIcon = (v: number) => v > 0.05 ? '🔵' : v < -0.05 ? '🔴' : '🟢';

    const printContent = `<!DOCTYPE html><html><head>
      <title>Divergência de Pesos - ${selectedDayStr}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm 10mm; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { padding:0; font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif; font-size:10px; color:#1e293b; line-height:1.5; }

        /* ── HEADER ── */
        .report-header {
          background:#1d3557; color:white;
          padding:${hc.headerPadding}; display:flex; align-items:center; gap:${hc.headerGap};
          border-bottom:4px solid #e76f51;
        }
        .report-header img { height:${hc.logoHeight}; ${!hc.logoVisible ? 'display:none;' : ''} }
        .report-header .title-block { flex:1; }
        .report-header .title-block h1 { font-size:${hc.titleFontSize}; font-weight:800; letter-spacing:1px; margin:0; }
        .report-header .title-block .subtitle { font-size:${hc.subtitleFontSize}; opacity:0.8; margin-top:2px; }
        .report-header .date-block {
          text-align:right; font-size:${hc.dateFontSize}; line-height:1.6;
        }
        .report-header .date-block .date-value { font-weight:800; font-size:13px; }

        /* ── KPIs ── */
        .kpi-strip {
          display:flex; gap:0; margin:0; border-bottom:1px solid #e2e8f0;
        }
        .kpi-card {
          flex:1; padding:12px 14px; text-align:center;
          border-right:1px solid #e2e8f0; background:#f8fafc;
        }
        .kpi-card:last-child { border-right:none; }
        .kpi-card .kpi-label {
          font-size:8px; text-transform:uppercase; letter-spacing:1px;
          color:#64748b; font-weight:700; margin-bottom:4px;
        }
        .kpi-card .kpi-value { font-size:20px; font-weight:900; }
        .kpi-card .kpi-sub { font-size:9px; color:#94a3b8; margin-top:2px; }

        /* ── TABLE ── */
        .section-title {
          background:#1d3557; color:white; padding:8px 16px;
          font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;
          margin-top:0;
        }
        table { width:100%; border-collapse:collapse; }
        thead th {
          background:#334155; color:#e2e8f0; padding:7px 5px;
          font-size:8.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;
          text-align:center; border-bottom:2px solid #1d3557;
        }
        thead th.col-ticket { background:#1e40af; color:white; }
        thead th.col-obra { background:#047857; color:white; }
        thead th.col-dif { background:#92400e; color:white; }
        tbody td {
          padding:5px 4px; text-align:center; font-size:9.5px;
          border-bottom:1px solid #e2e8f0;
        }
        tbody tr:nth-child(even) { background:#f1f5f9; }
        tbody tr.row-alert { background:#fef2f2 !important; border-left:3px solid #dc2626; }
        tbody tr.row-alert td:first-child { padding-left:2px; }
        tfoot td {
          padding:8px 5px; font-weight:800; font-size:10px;
          border-top:2px solid #1d3557; background:#f8fafc;
        }

        /* ── FOOTER ── */
        .report-footer {
          display:flex; justify-content:space-between; align-items:center;
          padding:8px 16px; margin-top:6px; border-top:1px solid #e2e8f0;
          font-size:8px; color:#94a3b8;
        }
        .report-footer .legend-items { display:flex; gap:14px; }
        .report-footer .legend-items span { display:inline-flex; align-items:center; gap:3px; }
        .dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
        .dot-green { background:#059669; }
        .dot-blue { background:#2563eb; }
        .dot-red { background:#dc2626; }

        @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
      </style></head><body>

      <!-- HEADER -->
      <div class="report-header">
        ${hc.logoVisible ? `<img src="${logoBase64}" alt="Logo" />` : ''}
        <div class="title-block">
          <h1>RELATÓRIO DE DIVERGÊNCIA DE PESOS</h1>
          <div class="subtitle">${obraConfig.nome || 'Pedreira'}${obraConfig.local ? ` — ${obraConfig.local}` : ''}</div>
        </div>
        <div class="date-block">
          <div class="date-value">${selectedDayStr}</div>
          <div>${recsAnalysis.length} viagens analisadas</div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-strip">
        <div class="kpi-card">
          <div class="kpi-label">Peso Ticket</div>
          <div class="kpi-value" style="color:#1e40af;">${formatNumber(totalTonTicket)} t</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Peso Calc. Obra</div>
          <div class="kpi-value" style="color:#047857;">${formatNumber(totalTonCalcObra)} t</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Diferença Total</div>
          <div class="kpi-value" style="color:${difColor(totalDif)};">${totalDif >= 0 ? '+' : ''}${formatNumber(totalDif)} t</div>
          <div class="kpi-sub">${percentDif >= 0 ? '+' : ''}${formatNumber(percentDif)}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Alertas</div>
          <div class="kpi-value">${recsNegative.length + recsPositive.length}</div>
          <div class="kpi-sub">${recsOk.length} dentro da tolerância</div>
        </div>
      </div>

      <!-- TABLE -->
      <div class="section-title">Detalhamento por Viagem — Maior Divergência Primeiro</div>
      <table>
        <thead><tr>
          <th style="width:3%;">#</th>
          <th style="width:7%;">Data</th>
          <th style="width:4%;">Hora</th>
          <th style="width:5%;">OS</th>
          <th style="width:6%;">Veículo</th>
          <th style="width:11%;text-align:left;">Empresa</th>
          <th style="width:11%;text-align:left;">Fornecedor</th>
          <th style="width:11%;text-align:left;">Material</th>
          <th class="col-ticket" style="width:9%;">Ton. Ticket</th>
          <th class="col-obra" style="width:9%;">Ton. Obra</th>
          <th class="col-dif" style="width:9%;">Diferença (t)</th>
          <th style="width:5%;">Var. %</th>
          <th style="width:4%;">Status</th>
        </tr></thead>
        <tbody>
          ${recsAnalysis.map((r, i) => {
            const isAlert = Math.abs(r.difTon) > 0.5;
            return `<tr${isAlert ? ' class="row-alert"' : ''}>
              <td style="color:#94a3b8;font-weight:600;">${i + 1}</td>
              <td>${r.data}</td>
              <td>${r.hora || '—'}</td>
              <td style="font-weight:700;">${r.ordem || '—'}</td>
              <td style="font-weight:700;">${r.prefixo || '—'}</td>
              <td style="text-align:left;padding-left:6px;">${r.empresa || '—'}</td>
              <td style="text-align:left;padding-left:6px;">${r.fornecedor || '—'}</td>
              <td style="text-align:left;padding-left:6px;">${r.material || '—'}</td>
              <td style="font-weight:700;color:#1e40af;">${formatNumber(r.toneladaTicket || 0)}</td>
              <td style="font-weight:700;color:#047857;">${formatNumber(r.toneladaCalcObra || 0)}</td>
              <td style="font-weight:800;color:${difColor(r.difTon)};background:${difBg(r.difTon)};font-size:10px;">${r.difTon >= 0 ? '+' : ''}${formatNumber(r.difTon)}</td>
              <td style="font-weight:600;color:${difColor(r.difTon)};">${r.difPercent >= 0 ? '+' : ''}${formatNumber(r.difPercent)}%</td>
              <td>${difIcon(r.difTon)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="8" style="text-align:right;padding-right:10px;">TOTAL GERAL</td>
            <td style="color:#1e40af;">${formatNumber(totalTonTicket)}</td>
            <td style="color:#047857;">${formatNumber(totalTonCalcObra)}</td>
            <td style="color:${difColor(totalDif)};">${totalDif >= 0 ? '+' : ''}${formatNumber(totalDif)}</td>
            <td style="color:${difColor(totalDif)};">${percentDif >= 0 ? '+' : ''}${formatNumber(percentDif)}%</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <!-- FOOTER -->
      <div class="report-footer">
        <div class="legend-items">
          <span><span class="dot dot-green"></span> OK (±0,05t)</span>
          <span><span class="dot dot-blue"></span> Obra &gt; Ticket</span>
          <span><span class="dot dot-red"></span> Obra &lt; Ticket</span>
          <span style="color:#dc2626;font-weight:600;">▌Linha vermelha = dif &gt; 0,5t</span>
        </div>
        <div>Gerado em ${new Date().toLocaleString('pt-BR')} • ApropriAPP</div>
      </div>

    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(printContent); w.document.close(); setTimeout(() => w.print(), 300); }
  };

  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();

    // Summary sheet with material totals
    const matData = materialSummary.map(m => ({
      'Material': m.material,
      'Fornecedor': m.fornecedor,
      'Total de Viagens': m.viagens,
      'Total em Toneladas': m.toneladas,
    }));
    matData.push({
      'Material': 'TOTAL GERAL',
      'Fornecedor': '',
      'Total de Viagens': totalViagens,
      'Total em Toneladas': totalToneladas,
    });
    const wsMat = XLSX.utils.json_to_sheet(matData);
    XLSX.utils.book_append_sheet(wb, wsMat, 'Resumo por Material');

    // Create a sheet for each material
    recordsByMaterial.forEach(([material, recs]) => {
      const matTotal = recs.reduce((sum, r) => sum + r.tonelada, 0);
      const sheetData = [...recs]
        .sort((a, b) => (a.prefixo || '').localeCompare(b.prefixo || '', 'pt-BR', { numeric: true }))
        .map((r, idx) => ({
          '#': idx + 1,
          'Data': r.data,
          'Hora': r.hora,
          'Veículo': r.prefixo,
          'Nº do Pedido/OC': r.ordem,
          'Tonelada Calc.': r.tonelada,
          'Tonelada Ticket': (r.toneladaTicket && r.toneladaTicket > 0) ? r.toneladaTicket : '',
          'Tonelada Calc Obra': (r.toneladaCalcObra && r.toneladaCalcObra > 0) ? r.toneladaCalcObra : '',
          'Peso Final': r.pesoFinal || '',
          'Peso Chegada': r.pesoChegada || '',
          'Diferença': (r.pesoFinal && r.pesoChegada && r.pesoChegada > 0) ? (r.pesoFinal - r.pesoChegada) : '',
        }));
      
      sheetData.push({
        '#': '',
        'Data': '',
        'Hora': '',
        'Veículo': '',
        'Nº do Pedido/OC': `Subtotal ${material}`,
        'Total (ton)': matTotal,
      } as any);

      // Truncate sheet name to 31 chars (Excel limit)
      const sheetName = material.length > 31 ? material.substring(0, 28) + '...' : material;
      const ws = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Add daily summary sheet (when multiple days)
    if (isMultipleDays) {
      const dayRows: any[] = [];
      dailySummary.forEach(day => {
        // Add main day row
        dayRows.push({
          'Data': day.data,
          'Viagens': day.viagens,
          'Toneladas': day.toneladas,
          'Detalhamento': day.materiais.map(m => `${m.material}: ${m.viagens}v / ${formatNumber(m.toneladas)}t`).join(' | '),
        });
      });
      dayRows.push({
        'Data': 'TOTAL GERAL',
        'Viagens': totalViagens,
        'Toneladas': totalToneladas,
        'Detalhamento': '',
      });
      const wsDay = XLSX.utils.json_to_sheet(dayRows);
      XLSX.utils.book_append_sheet(wb, wsDay, 'Resumo por Dia');
    }

    // Add empresa summary sheet
    const empData = empresaSummary.map(e => ({
      'Empresa': e.empresa,
      'Total de Viagens': e.viagens,
      'Total de Veículos': e.veiculos,
    }));
    empData.push({
      'Empresa': 'TOTAL GERAL',
      'Total de Viagens': totalViagens,
      'Total de Veículos': totalVeiculos,
    });
    const wsEmp = XLSX.utils.json_to_sheet(empData);
    XLSX.utils.book_append_sheet(wb, wsEmp, 'Resumo por Empresa');

    XLSX.writeFile(wb, `relatorio-pedreira-${activeDateRange.start.replace(/\//g, '-')}-${activeDateRange.end.replace(/\//g, '-')}.xlsx`);
  };

  return (
    <>
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80">
              <Mountain className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-medium">Relatório Geral de Carregamento</CardTitle>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setShowWhatsApp(true)} title="Exportar resumo por fornecedor via WhatsApp">
                <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
                WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="w-4 h-4 mr-2 text-red-600" />
                Relatório PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDFDetalhamento}>
                <FileDown className="w-4 h-4 mr-2 text-orange-600" />
                PDF Divergência
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportXLSX}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-700" />
                Relatório XLSX
              </Button>
            </div>
          </div>
          
          {/* Date Filters and Search */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-sm text-muted-foreground">Período:</span>
            
            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !filterStartDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filterStartDate ? format(filterStartDate, 'dd/MM/yyyy') : 'Data inicial'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterStartDate}
                  onSelect={setFilterStartDate}
                  initialFocus
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <span className="text-sm text-muted-foreground">até</span>

            {/* End Date with quick-select buttons */}
            <div className="flex items-center gap-1">
              {/* Quick select: Ontem */}
              {(() => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                const isYesterday = filterEndDate && format(filterEndDate, 'dd/MM/yyyy') === format(yesterday, 'dd/MM/yyyy');
                return (
                  <Button
                    variant={isYesterday ? 'default' : 'outline'}
                    size="sm"
                    className={cn("h-9 px-3 text-xs font-medium", isYesterday && "bg-[#1d3557] hover:bg-[#1d3557]/90")}
                    onClick={() => setFilterEndDate(yesterday)}
                    title="Definir data final como ontem (recomendado se ainda há viagens em andamento hoje)"
                  >
                    Ontem
                  </Button>
                );
              })()}
              {/* Quick select: Hoje */}
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isToday = filterEndDate && format(filterEndDate, 'dd/MM/yyyy') === format(today, 'dd/MM/yyyy');
                return (
                  <Button
                    variant={isToday ? 'default' : 'outline'}
                    size="sm"
                    className={cn("h-9 px-3 text-xs font-medium", isToday && "bg-primary hover:bg-primary/90")}
                    onClick={() => setFilterEndDate(today)}
                    title="Definir data final como hoje"
                  >
                    Hoje
                  </Button>
                );
              })()}
              {/* Calendar picker for custom end date */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-[130px] justify-start text-left font-normal",
                      !filterEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterEndDate ? format(filterEndDate, 'dd/MM/yyyy') : 'Personalizado'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterEndDate}
                    onSelect={setFilterEndDate}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] max-w-[250px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar veículo, material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            {/* Empresa Filter */}
            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger className="w-[180px] h-9">
                <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Todas empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas empresas</SelectItem>
                {availableEmpresas.map(emp => (
                  <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Material Filter */}
            <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
              <SelectTrigger className="w-[180px] h-9">
                <Mountain className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Todos materiais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos materiais</SelectItem>
                {availableMaterials.map(mat => (
                  <SelectItem key={mat} value={mat}>{mat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}

            {hasFilter && (
              <Badge variant="secondary" className="ml-2">
                {filteredRecords.length} de {records.length} registros
              </Badge>
            )}
          </div>

          {/* Chip filter bar */}
          <div className="px-6 pb-2">
            <PedreiraFilterBar
              records={records}
              filterMaterial={chipFilterMaterial} setFilterMaterial={setChipFilterMaterial}
              filterFornecedor={chipFilterFornecedor} setFilterFornecedor={setChipFilterFornecedor}
              filterEmpresa={chipFilterEmpresa} setFilterEmpresa={setChipFilterEmpresa}
              filterVeiculo={chipFilterVeiculo} setFilterVeiculo={setChipFilterVeiculo}
            />
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent>
            <div ref={reportRef} className="bg-background p-4 space-y-6">
              {/* Header com logo e dados da obra - visível apenas no PDF exportado */}
              <div className="bg-primary text-primary-foreground p-4 rounded-lg flex items-center gap-4 hidden print-header-pedreira-geral">
                <img src={activeLogo} alt="Logo" className="h-14 w-auto object-contain bg-white/15 rounded-lg p-1" />
                <div className="flex-1">
                  {obraConfig.nome && <p className="text-sm font-semibold opacity-90">{obraConfig.nome}</p>}
                  {obraConfig.local && <p className="text-xs opacity-70">📍 {obraConfig.local}</p>}
                  <h2 className="text-xl font-bold mt-0.5">{title}</h2>
                </div>
                <div className="text-sm opacity-80 text-right shrink-0">
                  📅 {activeDateRange.start} — {activeDateRange.end}
                </div>
              </div>

                <Tabs defaultValue="relatorio" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="relatorio">📋 Relatório</TabsTrigger>
                  <TabsTrigger value="fornecedores">🏭 Fornecedores</TabsTrigger>
                </TabsList>

                {/* KPI Cards - Totais do Período */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                  <Card className="border-2 border-foreground/20 shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <p className="text-2xl font-extrabold text-foreground">{formatNumber(totalViagens, 0)}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Total Viagens</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-blue-300 dark:border-blue-700 shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">{formatNumber(totalToneladas)} t</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Ton. Ticket</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-emerald-300 dark:border-emerald-700 shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{formatNumber(totalToneladasCalcObra)} t</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Ton. Calc. Obra</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{activeDateRange.start === activeDateRange.end ? activeDateRange.start : `${activeDateRange.start} a ${activeDateRange.end}`}</p>
                    </CardContent>
                  </Card>
                  <Card className="border shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <p className="text-2xl font-extrabold text-foreground">{formatNumber(todayStats.viagens, 0)}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Viagens Hoje</p>
                      <p className="text-[10px] text-muted-foreground">{formatNumber(todayStats.toneladas)} t</p>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-amber-300 dark:border-amber-700 shadow-sm">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                      <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">{vehicleKpi.total > 0 ? vehicleKpi.total : totalVeiculos}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Veículos Ativos</p>
                      {vehicleKpi.total > 0 && (
                        <div className="flex items-center gap-2 mt-1 text-[10px]">
                          <span className="font-medium text-muted-foreground">{vehicleKpi.basculante} Basc.</span>
                          <span className="font-medium text-muted-foreground">{vehicleKpi.reboque} Reb.</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Tab: Relatório */}
                <TabsContent value="relatorio" className="space-y-6 mt-4">

                  {/* ══ RESUMO ACUMULADO GERAL (sempre TODOS os registros) ══ */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-[#1d3557] text-white text-[10px]">📊 Resumo Acumulado Geral ({dateRange.start} — {dateRange.end})</Badge>
                      <Badge variant="secondary" className="text-[10px]">{records.length} viagens</Badge>
                      <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">{formatNumber(totalToneladas)} t</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {materialsByFornecedorTotal.map((forn, fi) => {
                        const colors = [
                          { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-300', text: 'text-blue-800', subtotal: 'bg-blue-50/80 dark:bg-blue-950/50' },
                          { bg: 'bg-indigo-50 dark:bg-indigo-950', border: 'border-indigo-300', text: 'text-indigo-800', subtotal: 'bg-indigo-50/80 dark:bg-indigo-950/50' },
                          { bg: 'bg-teal-50 dark:bg-teal-950', border: 'border-teal-300', text: 'text-teal-800', subtotal: 'bg-teal-50/80 dark:bg-teal-950/50' },
                          { bg: 'bg-slate-50 dark:bg-slate-900', border: 'border-slate-300', text: 'text-slate-800', subtotal: 'bg-slate-50/80 dark:bg-slate-900/50' },
                        ];
                        const c = colors[fi % colors.length];
                        const totalFrete = forn.materiais.reduce((s, m) => s + m.toneladas * getFreteForMaterial(m.material, forn.fornecedor), 0);
                        return (
                          <Card key={forn.fornecedor} className={`border-2 ${c.border} overflow-hidden`}>
                            <CardHeader className={`py-2.5 px-4 ${c.bg} flex-row items-center justify-between space-y-0`}>
                              <CardTitle className="text-xs flex items-center gap-2">
                                <Building2 className={`w-3.5 h-3.5 ${c.text}`} />
                                {forn.fornecedor}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/30">
                                    <TableHead className="py-1 text-[10px] font-bold">Material</TableHead>
                                    <TableHead className="py-1 text-[10px] font-bold text-center">Viagens</TableHead>
                                    <TableHead className="py-1 text-[10px] font-bold text-right">Toneladas</TableHead>
                                    <TableHead className="py-1 text-[10px] font-bold text-right">R$/ton</TableHead>
                                    <TableHead className="py-1 text-[10px] font-bold text-right">Total Frete</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {forn.materiais.map((m, mi) => {
                                    const freteUnit = getFreteForMaterial(m.material, forn.fornecedor);
                                    const freteTotal = m.toneladas * freteUnit;
                                    return (
                                      <TableRow key={mi}>
                                        <TableCell className="py-1 font-medium text-[10px]">{m.material}</TableCell>
                                        <TableCell className="py-1 text-center">
                                          <Badge variant="outline" className="text-[9px] px-1 py-0">{m.viagens}</Badge>
                                        </TableCell>
                                        <TableCell className="py-1 text-right text-[10px]">{formatNumber(m.toneladas)}</TableCell>
                                        <TableCell className="py-1 text-right text-[10px] text-muted-foreground">{freteUnit > 0 ? formatNumber(freteUnit) : '—'}</TableCell>
                                        <TableCell className="py-1 text-right text-[10px] font-medium text-emerald-700">{freteTotal > 0 ? `R$ ${formatNumber(freteTotal)}` : '—'}</TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                                <TableFooter>
                                  <TableRow className={c.subtotal}>
                                    <TableCell className={`py-1 font-bold text-[9px] ${c.text}`}>SUBTOTAL</TableCell>
                                    <TableCell className={`py-1 text-center font-bold text-[9px] ${c.text}`}>{forn.totalViagens}</TableCell>
                                    <TableCell className={`py-1 text-right font-bold text-[9px] ${c.text}`}>{formatNumber(forn.totalToneladas)}</TableCell>
                                    <TableCell className="py-1"></TableCell>
                                    <TableCell className={`py-1 text-right font-bold text-[9px] text-emerald-700`}>{totalFrete > 0 ? `R$ ${formatNumber(totalFrete)}` : '—'}</TableCell>
                                  </TableRow>
                                </TableFooter>
                              </Table>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  {/* ══ RESUMO DO PERÍODO SELECIONADO/FILTRADO ══ */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-orange-500 text-white text-[10px]">📅 Resumo do Período ({displayDateLabel})</Badge>
                      <Badge variant="secondary" className="text-[10px]">{displayRecords.length} viagens</Badge>
                      <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">{formatNumber(displayRecords.reduce((s, r) => s + (r.toneladaTicket || r.tonelada || 0), 0))} t</Badge>
                    </div>

                  {/* Cards por Fornecedor — período filtrado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {materialsByFornecedor.map((forn, fi) => {
                      const colors = [
                        { bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-500/10 text-orange-700 border-orange-300', subtotal: 'bg-orange-50/80 dark:bg-orange-950/50' },
                        { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500/10 text-blue-700 border-blue-300', subtotal: 'bg-blue-50/80 dark:bg-blue-950/50' },
                        { bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-500/10 text-green-700 border-green-300', subtotal: 'bg-green-50/80 dark:bg-green-950/50' },
                        { bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-500/10 text-purple-700 border-purple-300', subtotal: 'bg-purple-50/80 dark:bg-purple-950/50' },
                        { bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500/10 text-amber-700 border-amber-300', subtotal: 'bg-amber-50/80 dark:bg-amber-950/50' },
                      ];
                      const c = colors[fi % colors.length];

                      return (
                        <Card key={forn.fornecedor} className={`border-2 ${c.border} overflow-hidden`}>
                          <CardHeader className={`py-3 px-4 ${c.bg} flex-row items-center justify-between space-y-0`}>
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Building2 className={`w-4 h-4 ${c.text}`} />
                              {forn.fornecedor}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                   <TableHead className="py-1.5 text-[11px] font-bold">Material</TableHead>
                                  <TableHead className="py-1.5 text-[11px] font-bold text-center">Viagens</TableHead>
                                  <TableHead className="py-1.5 text-[11px] font-bold text-right">Toneladas</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {forn.materiais.map((m, mi) => (
                                  <TableRow key={mi}>
                                    <TableCell className="py-1.5 font-medium text-xs">{m.material}</TableCell>
                                    <TableCell className="py-1.5 text-center">
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{m.viagens}</Badge>
                                    </TableCell>
                                    <TableCell className="py-1.5 text-right font-medium text-xs">{formatNumber(m.toneladas)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                              <TableFooter>
                                <TableRow className={c.subtotal}>
                                  <TableCell className={`py-1.5 font-bold text-[10px] ${c.text}`}>SUBTOTAL</TableCell>
                                  <TableCell className={`py-1.5 text-center font-bold text-[10px] ${c.text}`}>{forn.totalViagens}</TableCell>
                                  <TableCell className={`py-1.5 text-right font-bold text-[10px] ${c.text}`}>{formatNumber(forn.totalToneladas)}</TableCell>
                                </TableRow>
                              </TableFooter>
                            </Table>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  </div>

                  {/* Detalhamento de viagens */}
                  <Card className="overflow-hidden border-0 shadow-md">
                    <div className="bg-[#1d3557] px-4 py-3 flex items-center gap-2">
                      <Mountain className="w-4 h-4 text-white/80" />
                      <span className="text-white font-semibold text-sm">
                        Detalhamento de Viagens — {displayDateLabel} ({displayRecords.length} registros)
                      </span>
                    </div>
                    <CardContent className="p-0">
                      <div className="w-full overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <colgroup>
                            <col style={{ width: '3%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '4%' }} />
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '6%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '7%' }} />
                            {(onEdit || onDelete) && <col style={{ width: '7%' }} />}
                          </colgroup>
                          <thead>
                            <tr style={{ background: '#1d3557cc' }}>
                              <th className="py-1.5 px-1 text-[10px] text-white text-center font-medium">#</th>
                              <th className="py-1.5 px-1 text-[10px] text-white text-center font-medium">Data</th>
                              <th className="py-1.5 px-1 text-[10px] text-white text-center font-medium">Hora</th>
                              <th className="py-1.5 px-1 text-[10px] text-white text-center font-medium">Nº OS</th>
                              <th className="py-1.5 px-1 text-[10px] text-white text-center font-medium">Veículo</th>
                              <th className="py-1.5 px-1 text-[10px] text-white font-medium">Descrição</th>
                              <th className="py-1.5 px-1 text-[10px] text-white font-medium">Empresa</th>
                              <th className="py-1.5 px-1 text-[10px] text-white font-medium">Fornecedor</th>
                              <th className="py-1.5 px-1 text-[10px] text-white font-medium">Material</th>
                              <th className="py-1.5 px-1 text-[10px] text-white text-right font-medium">Ton. Ticket</th>
                              <th className="py-1.5 px-1 text-[10px] text-white text-right font-medium">Ton. Calc</th>
                              <th className="py-1.5 px-1 text-[10px] text-white text-right font-medium">Dif.</th>
                              {hasDieselRecords && <th className="py-1.5 px-1 text-[10px] text-white text-right font-medium">⛽ Litros</th>}
                              {(onEdit || onDelete) && <th className="py-1.5 px-1 text-[10px] text-white text-center font-medium">Ações</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {[...displayRecords].sort((a, b) => {
                              const dateA = a.data ? a.data.split('/').reverse().join('') : '';
                              const dateB = b.data ? b.data.split('/').reverse().join('') : '';
                              if (dateA !== dateB) return dateB.localeCompare(dateA);
                              return (b.hora || '').localeCompare(a.hora || '');
                            }).map((r, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? '#1d355710' : '#1d355720' }}>
                                <td className="py-1 px-1 text-muted-foreground text-center">{i + 1}</td>
                                <td className="py-1 px-1 text-center">{r.data}</td>
                                <td className="py-1 px-1 text-center">{r.hora}</td>
                                <td className="py-1 px-1 text-center font-medium">{r.ordem || '—'}</td>
                                <td className="py-1 px-1 text-center font-bold">{r.prefixo}</td>
                                <td className="py-1 px-1 truncate">{r.descricao || 'Cam. Basculante'}</td>
                                <td className="py-1 px-1 truncate">{r.empresa || '—'}</td>
                                <td className="py-1 px-1 truncate">{r.fornecedor || '—'}</td>
                                <td className="py-1 px-1 truncate">{r.material || '—'}</td>
                                <td className="py-1 px-1 text-right font-bold text-foreground">
                                  {(r.toneladaTicket && r.toneladaTicket > 0) ? formatNumber(r.toneladaTicket) : '—'}
                                </td>
                                <td className="py-1 px-1 text-right font-medium text-emerald-600">
                                  {(r.toneladaCalcObra && r.toneladaCalcObra > 0) ? formatNumber(r.toneladaCalcObra) : '—'}
                                </td>
                                <td className={`py-1 px-1 text-right font-medium ${
                                  (r.toneladaTicket && r.toneladaCalcObra && r.toneladaTicket > 0 && r.toneladaCalcObra > 0)
                                    ? (r.toneladaCalcObra - r.toneladaTicket) >= 0 ? 'text-blue-600' : 'text-red-600'
                                    : 'text-muted-foreground'
                                }`}>
                                  {(r.toneladaTicket && r.toneladaCalcObra && r.toneladaTicket > 0 && r.toneladaCalcObra > 0)
                                    ? formatNumber(r.toneladaCalcObra - r.toneladaTicket)
                                    : '—'}
                                </td>
                                {hasDieselRecords && (
                                  <td className="py-1 px-1 text-right font-bold text-amber-700">
                                    {isDieselRecord(r) && (r.pesoLiquido || 0) > 0
                                      ? `${formatNumber((r.pesoLiquido || 0) / DIESEL_DENSITY)} L`
                                      : '—'}
                                  </td>
                                )}
                                {(onEdit || onDelete) && (
                                  <td className="py-1 px-1 text-center">
                                    <div className="flex items-center justify-center gap-0.5">
                                      {onEdit && (
                                        <button onClick={() => onEdit(r)} className="p-1 rounded hover:bg-muted" title="Editar">
                                          <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                        </button>
                                      )}
                                      {onDelete && (
                                        <button onClick={() => onDelete(r)} className="p-1 rounded hover:bg-destructive/10" title="Excluir">
                                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            {(() => {
                              const recsWithBoth = displayRecords.filter(r => (r.toneladaTicket || r.tonelada || 0) > 0 && (r.toneladaCalcObra || 0) > 0);
                              const totalTicket = displayRecords.reduce((sum, r) => sum + (r.toneladaTicket || r.tonelada || 0), 0);
                              const totalCalcObra = displayRecords.reduce((sum, r) => sum + (r.toneladaCalcObra || 0), 0);
                              const totalDifFiltered = recsWithBoth.reduce((sum, r) => sum + ((r.toneladaCalcObra || 0) - (r.toneladaTicket || r.tonelada || 0)), 0);
                              const hasDif = recsWithBoth.length > 0;
                              return (
                                <tr className="font-bold" style={{ background: '#1d355740' }}>
                                  <td className="py-1.5 px-1" colSpan={9} style={{ textAlign: 'right' }}>TOTAL</td>
                                  <td className="py-1.5 px-1 text-right font-bold text-foreground">
                                    {formatNumber(totalTicket)}
                                  </td>
                                  <td className="py-1.5 px-1 text-right text-emerald-600">
                                    {formatNumber(totalCalcObra)}
                                  </td>
                                  <td className={`py-1.5 px-1 text-right ${hasDif ? (totalDifFiltered >= 0 ? 'text-blue-600' : 'text-red-600') : 'text-muted-foreground'}`}>
                                    {hasDif ? formatNumber(totalDifFiltered) : '—'}
                                  </td>
                                  {(onEdit || onDelete) && <td className="py-1.5 px-1"></td>}
                                </tr>
                              );
                            })()}
                          </tfoot>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab: Fornecedores (Herval vs Outros) */}
                <TabsContent value="fornecedores" className="space-y-4 mt-4">
                  {/* Herval Section */}
                  {hervalRecords.length > 0 && (
                    <Card>
                      <CardHeader className="py-3 bg-green-50 dark:bg-green-950 border-b border-green-200 dark:border-green-800">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <span className="text-green-700 dark:text-green-300">🏭 HERVAL</span>
                          <Badge className="bg-green-500 text-white ml-1">{hervalTotal.viagens} viagens</Badge>
                          <Badge variant="outline" className="text-green-700 border-green-400 ml-1">{formatNumber(hervalTotal.toneladas)} t</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-2 text-xs">Material</TableHead>
                              <TableHead className="py-2 text-xs text-center">Viagens</TableHead>
                              <TableHead className="py-2 text-xs text-right">Toneladas</TableHead>
                              <TableHead className="py-2 text-xs text-center">Veículos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {hervalMateriais.map((m, i) => (
                              <TableRow key={i}>
                                <TableCell className="py-2 font-medium">{m.material}</TableCell>
                                <TableCell className="py-2 text-center">{m.viagens}</TableCell>
                                <TableCell className="py-2 text-right">{formatNumber(m.toneladas)}</TableCell>
                                <TableCell className="py-2 text-center">{m.veiculos.size}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell className="py-2 font-bold">TOTAL HERVAL</TableCell>
                              <TableCell className="py-2 text-center font-bold">{hervalTotal.viagens}</TableCell>
                              <TableCell className="py-2 text-right font-bold">{formatNumber(hervalTotal.toneladas)}</TableCell>
                              <TableCell className="py-2 text-center font-bold">{new Set(hervalRecords.map(r=>r.prefixo).filter(Boolean)).size}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                        {/* Herval pivot table: vehicles as rows, materials as columns */}
                        {(() => {
                          const mats = Array.from(new Set(hervalRecords.map(r => r.material || 'Outros'))).sort();
                          const vMap = new Map<string, { empresa: string; byMat: Map<string, number>; total: number; totalTon: number }>();
                          hervalRecords.forEach(r => {
                            const k = r.prefixo || '—';
                            if (!vMap.has(k)) vMap.set(k, { empresa: r.empresa || '', byMat: new Map(), total: 0, totalTon: 0 });
                            const v = vMap.get(k)!;
                            const mat = r.material || 'Outros';
                            v.byMat.set(mat, (v.byMat.get(mat) || 0) + 1);
                            v.total += 1;
                            v.totalTon += r.tonelada;
                          });
                          const rows = Array.from(vMap.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }));
                          const colTotals = new Map(mats.map(m => [m, hervalRecords.filter(r => (r.material || 'Outros') === m).length]));
                          return (
                            <div className="border-t pt-0 overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-green-50/50 dark:bg-green-950/30">
                                    <TableHead className="py-2 text-xs">#</TableHead>
                                    <TableHead className="py-2 text-xs">Veículo</TableHead>
                                    <TableHead className="py-2 text-xs">Empresa</TableHead>
                                    {mats.map(mat => (
                                      <TableHead key={mat} className="py-2 text-xs text-center">{mat}</TableHead>
                                    ))}
                                    <TableHead className="py-2 text-xs text-center bg-primary/10">Total Viagens</TableHead>
                                    <TableHead className="py-2 text-xs text-right bg-primary/10">Total (ton)</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.map(([prefixo, v], i) => (
                                    <TableRow key={i} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                                      <TableCell className="py-1.5 text-xs">{i + 1}.</TableCell>
                                      <TableCell className="py-1.5 text-xs font-medium">{prefixo}</TableCell>
                                      <TableCell className="py-1.5 text-xs">{v.empresa}</TableCell>
                                      {mats.map(mat => (
                                        <TableCell key={mat} className="py-1.5 text-xs text-center">
                                          {v.byMat.get(mat) || '—'}
                                        </TableCell>
                                      ))}
                                      <TableCell className="py-1.5 text-xs text-center font-bold bg-primary/5">{v.total}</TableCell>
                                      <TableCell className="py-1.5 text-xs text-right font-bold bg-primary/5">{formatNumber(v.totalTon)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                                <TableFooter>
                                  <TableRow className="bg-green-100 dark:bg-green-900">
                                    <TableCell colSpan={3} className="py-2 text-xs font-bold text-right">Subtotal Herval</TableCell>
                                    {mats.map(mat => (
                                      <TableCell key={mat} className="py-2 text-xs text-center font-bold">{colTotals.get(mat) || 0}</TableCell>
                                    ))}
                                    <TableCell className="py-2 text-xs text-center font-bold">{hervalTotal.viagens}</TableCell>
                                    <TableCell className="py-2 text-xs text-right font-bold">{formatNumber(hervalTotal.toneladas)}</TableCell>
                                  </TableRow>
                                </TableFooter>
                              </Table>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}

                  {/* Outros Fornecedores Section */}
                  {outrosRecords.length > 0 && (
                    <Card>
                      <CardHeader className="py-3 bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <span className="text-blue-700 dark:text-blue-300">🏭 OUTROS FORNECEDORES</span>
                          <Badge className="bg-blue-500 text-white ml-1">{outrosTotal.viagens} viagens</Badge>
                          <Badge variant="outline" className="text-blue-700 border-blue-400 ml-1">{formatNumber(outrosTotal.toneladas)} t</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-2 text-xs">Material</TableHead>
                              <TableHead className="py-2 text-xs text-center">Viagens</TableHead>
                              <TableHead className="py-2 text-xs text-right">Toneladas</TableHead>
                              <TableHead className="py-2 text-xs text-center">Veículos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {outrosMateriais.map((m, i) => (
                              <TableRow key={i}>
                                <TableCell className="py-2 font-medium">{m.material}</TableCell>
                                <TableCell className="py-2 text-center">{m.viagens}</TableCell>
                                <TableCell className="py-2 text-right">{formatNumber(m.toneladas)}</TableCell>
                                <TableCell className="py-2 text-center">{m.veiculos.size}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell className="py-2 font-bold">TOTAL OUTROS</TableCell>
                              <TableCell className="py-2 text-center font-bold">{outrosTotal.viagens}</TableCell>
                              <TableCell className="py-2 text-right font-bold">{formatNumber(outrosTotal.toneladas)}</TableCell>
                              <TableCell className="py-2 text-center font-bold">{new Set(outrosRecords.map(r=>r.prefixo).filter(Boolean)).size}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                        {/* Outros pivot table: vehicles as rows, materials as columns */}
                        {(() => {
                          const mats = Array.from(new Set(outrosRecords.map(r => r.material || 'Outros'))).sort();
                          const vMap = new Map<string, { empresa: string; fornecedor: string; byMat: Map<string, number>; total: number; totalTon: number }>();
                          outrosRecords.forEach(r => {
                            const k = r.prefixo || '—';
                            if (!vMap.has(k)) vMap.set(k, { empresa: r.empresa || '', fornecedor: r.fornecedor || '', byMat: new Map(), total: 0, totalTon: 0 });
                            const v = vMap.get(k)!;
                            const mat = r.material || 'Outros';
                            v.byMat.set(mat, (v.byMat.get(mat) || 0) + 1);
                            v.total += 1;
                            v.totalTon += r.tonelada;
                          });
                          const rows = Array.from(vMap.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }));
                          const colTotals = new Map(mats.map(m => [m, outrosRecords.filter(r => (r.material || 'Outros') === m).length]));
                          return (
                            <div className="border-t pt-0 overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-blue-50/50 dark:bg-blue-950/30">
                                    <TableHead className="py-2 text-xs">#</TableHead>
                                    <TableHead className="py-2 text-xs">Veículo</TableHead>
                                    <TableHead className="py-2 text-xs">Empresa</TableHead>
                                    {mats.map(mat => (
                                      <TableHead key={mat} className="py-2 text-xs text-center">{mat}</TableHead>
                                    ))}
                                    <TableHead className="py-2 text-xs text-center bg-primary/10">Total Viagens</TableHead>
                                    <TableHead className="py-2 text-xs text-right bg-primary/10">Total (ton)</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rows.map(([prefixo, v], i) => (
                                    <TableRow key={i} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                                      <TableCell className="py-1.5 text-xs">{i + 1}.</TableCell>
                                      <TableCell className="py-1.5 text-xs font-medium">{prefixo}</TableCell>
                                      <TableCell className="py-1.5 text-xs">{v.empresa}</TableCell>
                                      {mats.map(mat => (
                                        <TableCell key={mat} className="py-1.5 text-xs text-center">
                                          {v.byMat.get(mat) || '—'}
                                        </TableCell>
                                      ))}
                                      <TableCell className="py-1.5 text-xs text-center font-bold bg-primary/5">{v.total}</TableCell>
                                      <TableCell className="py-1.5 text-xs text-right font-bold bg-primary/5">{formatNumber(v.totalTon)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                                <TableFooter>
                                  <TableRow className="bg-blue-100 dark:bg-blue-900">
                                    <TableCell colSpan={3} className="py-2 text-xs font-bold text-right">Subtotal Outros</TableCell>
                                    {mats.map(mat => (
                                      <TableCell key={mat} className="py-2 text-xs text-center font-bold">{colTotals.get(mat) || 0}</TableCell>
                                    ))}
                                    <TableCell className="py-2 text-xs text-center font-bold">{outrosTotal.viagens}</TableCell>
                                    <TableCell className="py-2 text-xs text-right font-bold">{formatNumber(outrosTotal.toneladas)}</TableCell>
                                  </TableRow>
                                </TableFooter>
                              </Table>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}

                  {hervalRecords.length === 0 && outrosRecords.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                      <Mountain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Nenhum registro encontrado</p>
                    </div>
                  )}
                </TabsContent>

              </Tabs>

              {/* Footer */}
              <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                <p>Data da última atualização: {new Date().toLocaleString('pt-BR')}</p>
                <p className="mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {filteredRecords.length} registros
                  </Badge>
                </p>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>

    {/* WhatsApp Dialog */}
    <Dialog open={showWhatsApp} onOpenChange={setShowWhatsApp}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" />
            Resumo por Fornecedor — WhatsApp
          </DialogTitle>
        </DialogHeader>
        <div className="bg-green-50 dark:bg-green-950 rounded-xl p-4 max-h-72 overflow-y-auto border border-green-200 dark:border-green-800">
          <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
            {generateWhatsAppMessage()}
          </pre>
        </div>
        <textarea
          value={whatsAppObservacao}
          onChange={(e) => setWhatsAppObservacao(e.target.value)}
          placeholder="Adicionar observação (opcional)..."
          className="w-full h-16 p-3 border border-border rounded-xl resize-none text-sm bg-background focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <Button onClick={sendWhatsApp} className="w-full bg-green-500 hover:bg-green-600 text-white py-5 rounded-xl">
          <Send className="w-5 h-5 mr-2" />
          Enviar via WhatsApp
        </Button>
      </DialogContent>
    </Dialog>
    </>
  );
}
