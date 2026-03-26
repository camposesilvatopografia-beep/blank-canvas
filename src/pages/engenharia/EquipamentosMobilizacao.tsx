import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useObraConfig } from '@/hooks/useObraConfig';
import { useReportHeaderConfig } from '@/hooks/useReportHeaderConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, Building2, Search, CheckCircle, AlertTriangle, BarChart3, Package, ArrowUpDown, DollarSign, Loader2, Car, ChevronRight, FileText, Settings2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ReportHeaderConfigModal } from '@/components/crud/ReportHeaderConfigModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

interface EquipRow {
  item: string;
  codigo: string;
  proprietario: string;
  equipamento: string;
  marcaModelo: string;
  potencia: string;
  valorLocacao: string;
  valorNumerico: number;
  operador: string;
  status: string;
  rowIndex: number; // row index in the sheet (1-based, header=0)
}

const STATUS_COLORS: Record<string, string> = {
  'MOBILIZADO': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'DESMOBILIZADO': 'bg-red-500/15 text-red-400 border-red-500/30',
  'A MOBILIZAR': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'EM MANUTENÇÃO': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

const TARGET_EMPRESAS = ['ENGEMAT', 'A. BARRETO', 'L. PEREIRA'];

function parseValor(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[R$\s.]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function EquipamentosMobilizacao() {
  const { readSheet, writeSheet, loading: sheetsLoading } = useGoogleSheets();
  const [data, setData] = useState<EquipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingIdx, setTogglingIdx] = useState<number | null>(null);
  const { obraConfig } = useObraConfig();
  const { config: headerConfig, save: saveHeaderConfig, getHeaderCss, defaults: headerDefaults } = useReportHeaderConfig('mobilizacao');
  const [showHeaderConfig, setShowHeaderConfig] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmpresa, setFilterEmpresa] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');
  const [statusColIndex, setStatusColIndex] = useState(-1);
  const [expandedTipo, setExpandedTipo] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const rows = await readSheet('Mobilização');
        if (rows.length < 2) { setData([]); return; }
        const headers = rows[0].map((h: string) => (h || '').toString().trim().toUpperCase());
        const idx = (name: string) => {
          const i = headers.findIndex((h: string) => h.includes(name));
          return i >= 0 ? i : -1;
        };
        const iItem = idx('ITEM');
        const iCodigo = idx('CÓDIGO') >= 0 ? idx('CÓDIGO') : idx('CODIGO') >= 0 ? idx('CODIGO') : idx('TAG');
        const iProp = idx('PROPRIETÁRIO') >= 0 ? idx('PROPRIETÁRIO') : idx('PROPRIETARIO');
        const iEquip = idx('EQUIPAMENTO');
        const iMarca = idx('MARCA');
        const iPot = idx('POTÊNCIA') >= 0 ? idx('POTÊNCIA') : idx('POTENCIA');
        const iValor = idx('VALOR');
        const iOp = idx('OPERADOR') >= 0 ? idx('OPERADOR') : idx('MOTORISTA');
        const iStatus = idx('STATUS');
        setStatusColIndex(iStatus);

        const parsed: EquipRow[] = rows.slice(1)
          .map((r: any[], i: number) => {
            if (!r.some((c: any) => c && c.toString().trim())) return null;
            const rawValor = (r[iValor] || '').toString().trim();
            return {
              item: r[iItem] || '',
              codigo: r[iCodigo] || '',
              proprietario: (r[iProp] || '').toString().trim(),
              equipamento: (r[iEquip] || '').toString().trim(),
              marcaModelo: (r[iMarca] || '').toString().trim(),
              potencia: (r[iPot] || '').toString().trim(),
              valorLocacao: rawValor,
              valorNumerico: parseValor(rawValor),
              operador: (r[iOp] || '').toString().trim(),
              status: (r[iStatus] || '').toString().trim().toUpperCase(),
              rowIndex: i + 1, // 0-based data row + 1 for header
            };
          })
          .filter(Boolean) as EquipRow[];
        setData(parsed);
      } catch (err) {
        console.error('Erro ao carregar Mobilização:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Toggle status locally + write to sheet
  const toggleStatus = useCallback(async (eq: EquipRow) => {
    if (statusColIndex < 0) return;
    const newStatus = eq.status === 'MOBILIZADO' ? 'DESMOBILIZADO' : 'MOBILIZADO';
    setTogglingIdx(eq.rowIndex);
    try {
      // Convert column index to letter (A=0, B=1...)
      const colLetter = String.fromCharCode(65 + statusColIndex);
      const cellRef = `${colLetter}${eq.rowIndex + 1}`; // +1 because sheets are 1-indexed
      const ok = await writeSheet('Mobilização', cellRef, [[newStatus]]);
      if (!ok) throw new Error('Falha ao gravar');
      // Update local state
      setData(prev => prev.map(d =>
        d.rowIndex === eq.rowIndex ? { ...d, status: newStatus } : d
      ));
      toast.success(`${eq.codigo} → ${newStatus}`);
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Erro ao alterar status na planilha');
    } finally {
      setTogglingIdx(null);
    }
  }, [statusColIndex, writeSheet]);

  // Derived lists
  const empresas = useMemo(() => [...new Set(data.map(d => d.proprietario).filter(Boolean))].sort(), [data]);
  const tipos = useMemo(() => [...new Set(data.map(d => d.equipamento).filter(Boolean))].sort(), [data]);
  const statuses = useMemo(() => [...new Set(data.map(d => d.status).filter(Boolean))].sort(), [data]);

  // Filtered data
  const filtered = useMemo(() => {
    return data.filter(d => {
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      if (filterEmpresa !== 'all' && d.proprietario !== filterEmpresa) return false;
      if (filterTipo !== 'all' && d.equipamento !== filterTipo) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          d.codigo.toLowerCase().includes(s) ||
          d.proprietario.toLowerCase().includes(s) ||
          d.equipamento.toLowerCase().includes(s) ||
          d.marcaModelo.toLowerCase().includes(s) ||
          d.operador.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [data, filterStatus, filterEmpresa, filterTipo, search]);

  // KPIs
  const totalEquip = data.length;
  const mobilizadosData = useMemo(() => data.filter(d => d.status === 'MOBILIZADO'), [data]);
  const desmobilizadosData = useMemo(() => data.filter(d => d.status === 'DESMOBILIZADO'), [data]);
  const mobilizados = mobilizadosData.length;
  const desmobilizados = desmobilizadosData.length;
  const aMobilizar = data.filter(d => d.status === 'A MOBILIZAR').length;

  // Mini-resumo por empresa para mob/desmob
  const mobPorEmpresa = useMemo(() => {
    const map: Record<string, number> = {};
    mobilizadosData.forEach(d => { const e = d.proprietario || 'Outros'; map[e] = (map[e] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [mobilizadosData]);

  const desmobPorEmpresa = useMemo(() => {
    const map: Record<string, number> = {};
    desmobilizadosData.forEach(d => { const e = d.proprietario || 'Outros'; map[e] = (map[e] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [desmobilizadosData]);

  // Desmobilizados grouped by empresa > tipo
  const desmobByEmpresa = useMemo(() => {
    const map: Record<string, EquipRow[]> = {};
    desmobilizadosData.forEach(d => {
      const key = d.proprietario || 'Sem Proprietário';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [desmobilizadosData]);

  // Resumo de aluguel por empresa (somente mobilizados)
  const resumoEmpresas = useMemo(() => {
    return TARGET_EMPRESAS.map(emp => {
      const empUpper = emp.toUpperCase();
      const items = data.filter(d => d.proprietario.toUpperCase().includes(empUpper));
      const mobItems = items.filter(d => d.status === 'MOBILIZADO');
      const totalValor = mobItems.reduce((sum, d) => sum + d.valorNumerico, 0);
      return {
        empresa: emp,
        total: items.length,
        mobilizados: mobItems.length,
        desmobilizados: items.filter(d => d.status === 'DESMOBILIZADO').length,
        valorMensal: totalValor,
      };
    });
  }, [data]);

  const totalAluguelGeral = useMemo(() => resumoEmpresas.reduce((s, e) => s + e.valorMensal, 0), [resumoEmpresas]);




  // Group by empresa
  const byEmpresa = useMemo(() => {
    const map: Record<string, EquipRow[]> = {};
    filtered.forEach(d => {
      const key = d.proprietario || 'Sem Proprietário';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  // Group by tipo (with items for empresa drill-down)
  const byTipoItems = useMemo(() => {
    const map: Record<string, EquipRow[]> = {};
    filtered.forEach(d => {
      const key = d.equipamento || 'Outros';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  // Group by status
  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(d => {
      const key = d.status || 'Sem Status';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  // Veículos Leves
  const veiculosLeves = useMemo(() => {
    return data.filter(d => d.equipamento.toUpperCase().includes('VEÍCULO LEVE') || d.equipamento.toUpperCase().includes('VEICULO LEVE'));
  }, [data]);

  const veiculosLevesFiltered = useMemo(() => {
    return filtered.filter(d => d.equipamento.toUpperCase().includes('VEÍCULO LEVE') || d.equipamento.toUpperCase().includes('VEICULO LEVE'));
  }, [filtered]);

  // PDF Export
  const exportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const hCss = getHeaderCss();
      const NAVY = [29, 53, 87] as const;
      const GRAY = [120, 120, 120] as const;
      const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      let y = 8;
      const padLeft = headerConfig.header_padding_left || 20;

      if (hCss.logoVisible && obraConfig.logo) {
        try {
          const resp = await fetch(obraConfig.logo);
          const blob = await resp.blob();
          const b64 = await new Promise<string>(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          const logoH = (headerConfig.logo_height || 60) * 0.26;
          doc.addImage(b64, 'PNG', padLeft, y, logoH * 2.5, logoH);
          y += logoH + 2;
        } catch { /* skip */ }
      }

      const titleSize = headerConfig.title_font_size || 18;
      doc.setFontSize(titleSize);
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE MOBILIZAÇÃO DE EQUIPAMENTOS', W / 2, y, { align: 'center' });
      y += titleSize * 0.5;
      const subtitleSize = headerConfig.subtitle_font_size || 13;
      doc.setFontSize(subtitleSize);
      doc.setFont('helvetica', 'normal');
      if (obraConfig.nome) {
        doc.text(obraConfig.nome + (obraConfig.local ? ` — ${obraConfig.local}` : ''), W / 2, y, { align: 'center' });
        y += subtitleSize * 0.45;
      }
      doc.setFontSize(headerConfig.date_font_size || 11);
      doc.setTextColor(...GRAY);
      doc.text(`Emitido em ${hoje}`, W / 2, y, { align: 'center' });
      y += 6;
      doc.setDrawColor(...NAVY); doc.setLineWidth(0.5);
      doc.line(padLeft, y, W - padLeft, y);
      y += 5;

      // KPIs
      const kpis = [
        { label: 'Total Equipamentos', value: String(totalEquip) },
        { label: 'Mobilizados', value: String(mobilizados) },
        { label: 'Desmobilizados', value: String(desmobilizados) },
        { label: 'A Mobilizar', value: String(aMobilizar) },
        { label: 'Aluguel Total (Mob.)', value: formatBRL(totalAluguelGeral) },
      ];
      const kpiW = (W - padLeft * 2 - 4 * 3) / 5;
      kpis.forEach((kpi, i) => {
        const x = padLeft + i * (kpiW + 3);
        doc.setFillColor(240, 244, 248);
        doc.roundedRect(x, y, kpiW, 14, 2, 2, 'F');
        doc.setFontSize(7); doc.setTextColor(...GRAY); doc.setFont('helvetica', 'normal');
        doc.text(kpi.label, x + kpiW / 2, y + 4.5, { align: 'center' });
        doc.setFontSize(11); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
        doc.text(kpi.value, x + kpiW / 2, y + 11, { align: 'center' });
      });
      y += 18;

      // Empresas table
      doc.setFontSize(10); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
      doc.text('RESUMO POR EMPRESA (MOBILIZADOS)', padLeft, y); y += 5;
      const empCols = ['Empresa', 'Qtd Total', 'Mobilizados', 'Desmob.', 'Valor Mensal', '% do Total'];
      const empColW = [55, 22, 22, 22, 35, 22];
      let xPos = padLeft;
      doc.setFillColor(...NAVY); doc.rect(padLeft, y, W - padLeft * 2, 6, 'F');
      doc.setFontSize(7); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
      empCols.forEach((col, i) => { doc.text(col, xPos + 2, y + 4); xPos += empColW[i]; });
      y += 6;
      doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      resumoEmpresas.forEach((emp, idx) => {
        const pct = totalAluguelGeral ? Math.round((emp.valorMensal / totalAluguelGeral) * 100) : 0;
        if (idx % 2 === 0) { doc.setFillColor(248, 249, 252); doc.rect(padLeft, y, W - padLeft * 2, 5, 'F'); }
        xPos = padLeft;
        [emp.empresa, String(emp.total), String(emp.mobilizados), String(emp.desmobilizados), formatBRL(emp.valorMensal), `${pct}%`].forEach((v, i) => { doc.text(v, xPos + 2, y + 3.5); xPos += empColW[i]; });
        y += 5;
      });
      y += 4;

      // Tipo table
      doc.setFontSize(10); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
      doc.text('DISTRIBUIÇÃO POR TIPO DE EQUIPAMENTO', padLeft, y); y += 5;
      const tipoCols = ['Tipo', 'Qtd', 'Mob.', 'Desmob.', 'Valor Mob.'];
      const tipoColW = [70, 20, 20, 20, 35];
      xPos = padLeft;
      doc.setFillColor(...NAVY); doc.rect(padLeft, y, W - padLeft * 2, 6, 'F');
      doc.setFontSize(7); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
      tipoCols.forEach((c, i) => { doc.text(c, xPos + 2, y + 4); xPos += tipoColW[i]; });
      y += 6;
      doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      byTipoItems.forEach(([tipo, items], idx) => {
        if (y > H - 15) { doc.addPage(); y = 10; }
        const mob = items.filter(d => d.status === 'MOBILIZADO');
        const desm = items.filter(d => d.status === 'DESMOBILIZADO');
        const val = mob.reduce((s, d) => s + d.valorNumerico, 0);
        if (idx % 2 === 0) { doc.setFillColor(248, 249, 252); doc.rect(padLeft, y, W - padLeft * 2, 5, 'F'); }
        xPos = padLeft;
        [tipo, String(items.length), String(mob.length), String(desm.length), formatBRL(val)].forEach((v, i) => { doc.text(v, xPos + 2, y + 3.5); xPos += tipoColW[i]; });
        y += 5;
      });
      y += 4;

      // Detailed list ORGANIZED BY EMPRESA
      const empresasGroup: Record<string, typeof data> = {};
      data.forEach(d => {
        const emp = d.proprietario || 'Sem Proprietário';
        if (!empresasGroup[emp]) empresasGroup[emp] = [];
        empresasGroup[emp].push(d);
      });
      const sortedEmpresas = Object.entries(empresasGroup).sort((a, b) => b[1].length - a[1].length);

      const detCols = ['Código', 'Tipo', 'Marca/Modelo', 'Valor', 'Operador', 'Status'];
      const detColW = [24, 50, 55, 30, 50, 28];
      const tableW = detColW.reduce((s, w) => s + w, 0);

      const empBgColors: [number, number, number][] = [
        [230, 240, 255], [245, 230, 255], [225, 248, 240], [255, 240, 225], [240, 255, 245], [255, 235, 240]
      ];

      sortedEmpresas.forEach(([empresa, items], empIdx) => {
        if (y > H - 30) { doc.addPage(); y = 10; }

        const mobItems = items.filter(d => d.status === 'MOBILIZADO');
        const desmItems = items.filter(d => d.status === 'DESMOBILIZADO');
        const valorEmp = mobItems.reduce((s, d) => s + d.valorNumerico, 0);
        const bgColor = empBgColors[empIdx % empBgColors.length];

        // Empresa header band
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.roundedRect(padLeft, y, W - padLeft * 2, 10, 1.5, 1.5, 'F');
        doc.setFontSize(9); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
        doc.text(empresa.toUpperCase(), padLeft + 3, y + 4.5);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
        const empSummary = `${items.length} equip.  |  ${mobItems.length} mob.  |  ${desmItems.length} desmob.  |  Valor mob.: ${formatBRL(valorEmp)}`;
        doc.text(empSummary, padLeft + 3, y + 8.5);
        y += 12;

        // Table header
        xPos = padLeft;
        doc.setFillColor(...NAVY); doc.rect(padLeft, y, tableW, 5.5, 'F');
        doc.setFontSize(6.5); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
        detCols.forEach((c, i) => { doc.text(c, xPos + 1.5, y + 3.8); xPos += detColW[i]; });
        y += 5.5;

        // Items
        doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        items.forEach((eq, idx) => {
          if (y > H - 10) { doc.addPage(); y = 10; }
          if (idx % 2 === 0) { doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]); doc.rect(padLeft, y, tableW, 4.5, 'F'); }
          xPos = padLeft;
          [eq.codigo, eq.equipamento, eq.marcaModelo, eq.valorLocacao || '—', eq.operador || '—', eq.status].forEach((v, i) => {
            doc.text(String(v).substring(0, 30), xPos + 1.5, y + 3.2); xPos += detColW[i];
          });
          y += 4.5;
        });

        // Subtotal line
        doc.setFillColor(bgColor[0] - 10, bgColor[1] - 10, bgColor[2] - 10);
        doc.rect(padLeft, y, tableW, 5, 'F');
        doc.setFontSize(6.5); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
        doc.text(`Subtotal ${empresa}: ${items.length} equip. — Valor mobilizado: ${formatBRL(valorEmp)}`, padLeft + 2, y + 3.5);
        y += 8;
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(...GRAY); doc.setFont('helvetica', 'italic');
        doc.text(`Página ${i}/${pageCount}`, W - padLeft, H - 5, { align: 'right' });
        doc.text('AproprIApp — Mobilização', padLeft, H - 5);
      }

      doc.save(`mobilizacao-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Relatório exportado com sucesso');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.error('Erro ao gerar PDF');
    }
    setExporting(false);
  }, [data, totalEquip, mobilizados, desmobilizados, aMobilizar, totalAluguelGeral, resumoEmpresas, byTipoItems, obraConfig, headerConfig, getHeaderCss]);

  if (loading) return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-96" />
    </div>
  );

  const EMPRESA_COLORS = ['bg-blue-500/15 text-blue-400 border-blue-500/30', 'bg-purple-500/15 text-purple-400 border-purple-500/30', 'bg-teal-500/15 text-teal-400 border-teal-500/30'];
  const EMPRESA_CARD_BG = ['bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40', 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/40', 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800/40'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/20">
            <Truck className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Equipamentos - Mobilização</h1>
            <p className="text-sm text-muted-foreground">Visão gerencial da frota mobilizada · Equilibre valores entre empresas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHeaderConfig(true)} className="gap-1">
            <Settings2 className="w-4 h-4" /> Layout PDF
          </Button>
          <Button variant="default" size="sm" onClick={exportPdf} disabled={exporting} className="gap-1">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/15"><Package className="w-5 h-5 text-sky-400" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{totalEquip}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/15"><CheckCircle className="w-5 h-5 text-emerald-400" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Mobilizados</p>
                <p className="text-2xl font-bold text-emerald-400">{mobilizados}</p>
              </div>
            </div>
            {mobPorEmpresa.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border space-y-0.5">
                {mobPorEmpresa.map(([emp, count]) => (
                  <div key={emp} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground truncate">{emp}</span>
                    <span className="font-medium text-emerald-400 shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/15"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Desmobilizados</p>
                <p className="text-2xl font-bold text-red-400">{desmobilizados}</p>
              </div>
            </div>
            {desmobPorEmpresa.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border space-y-0.5">
                {desmobPorEmpresa.map(([emp, count]) => (
                  <div key={emp} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground truncate">{emp}</span>
                    <span className="font-medium text-red-400 shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/15"><DollarSign className="w-5 h-5 text-amber-400" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Aluguel Mob. Total</p>
                <p className="text-lg font-bold text-amber-400">{formatBRL(totalAluguelGeral)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Aluguel por Empresa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {resumoEmpresas.map((emp, idx) => {
          const pctTotal = totalAluguelGeral ? Math.round((emp.valorMensal / totalAluguelGeral) * 100) : 0;
          return (
            <Card key={emp.empresa} className={EMPRESA_CARD_BG[idx] || 'border-border'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {emp.empresa}
                  </span>
                  <Badge variant="outline" className={EMPRESA_COLORS[idx]}>{pctTotal}% do total</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-bold">{formatBRL(emp.valorMensal)}</div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-purple-500' : 'bg-teal-500'}`}
                    style={{ width: `${pctTotal}%` }}
                  />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{emp.total} equip.</span>
                  <span className="text-emerald-400">{emp.mobilizados} mob.</span>
                  <span className="text-red-400">{emp.desmobilizados} desmob.</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar código, empresa, equipamento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Empresas</SelectItem>
            {empresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            {tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumo"><BarChart3 className="w-4 h-4 mr-1" />Resumo</TabsTrigger>
          <TabsTrigger value="leves"><Car className="w-4 h-4 mr-1" />Veículos Leves</TabsTrigger>
          <TabsTrigger value="desmob"><AlertTriangle className="w-4 h-4 mr-1" />Desmobilizados</TabsTrigger>
          <TabsTrigger value="empresa"><Building2 className="w-4 h-4 mr-1" />Por Empresa</TabsTrigger>
          <TabsTrigger value="lista"><Truck className="w-4 h-4 mr-1" />Listagem</TabsTrigger>
        </TabsList>

        {/* Resumo Tab */}
        <TabsContent value="resumo">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Por Status */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por Status</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {byStatus.map(([status, count]) => {
                  const pct = totalEquip ? Math.round((count / totalEquip) * 100) : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{status}</span>
                        <span className="font-medium">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            status === 'MOBILIZADO' ? 'bg-emerald-500'
                            : status === 'DESMOBILIZADO' ? 'bg-red-500'
                            : status === 'A MOBILIZAR' ? 'bg-amber-500'
                            : 'bg-sky-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Por Tipo - clicável com detalhamento por empresa */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por Tipo de Equipamento</CardTitle></CardHeader>
              <CardContent className="max-h-[320px] overflow-y-auto space-y-0">
                {byTipoItems.map(([tipo, items]) => {
                  const isExpanded = expandedTipo === tipo;
                  // Group items by empresa
                  const byEmpresaMap: Record<string, number> = {};
                  items.forEach(d => {
                    const emp = d.proprietario || 'Sem Proprietário';
                    byEmpresaMap[emp] = (byEmpresaMap[emp] || 0) + 1;
                  });
                  const empresaEntries = Object.entries(byEmpresaMap).sort((a, b) => b[1] - a[1]);

                  return (
                    <div key={tipo}>
                      <button
                        type="button"
                        onClick={() => setExpandedTipo(isExpanded ? null : tipo)}
                        className="w-full flex items-center justify-between py-1.5 border-b border-border hover:bg-muted/40 transition-colors px-1 rounded"
                      >
                        <div className="flex items-center gap-1.5">
                          <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <span className="text-xs truncate">{tipo}</span>
                        </div>
                        <Badge variant="secondary" className="font-mono text-[10px] h-5 shrink-0">{items.length}</Badge>
                      </button>
                      {isExpanded && (
                        <div className="ml-5 border-l-2 border-muted pl-2 py-1 space-y-0.5">
                          {empresaEntries.map(([emp, count]) => (
                            <div key={emp} className="flex items-center justify-between py-0.5">
                              <span className="text-[11px] text-muted-foreground truncate">{emp}</span>
                              <Badge variant="outline" className="font-mono text-[10px] h-4 px-1.5 shrink-0">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Veículos Leves resumo compacto */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Car className="w-4 h-4 text-indigo-400" />
                  Veículos Leves
                  <Badge variant="secondary" className="text-[10px] h-5">{veiculosLeves.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[320px] overflow-y-auto">
                <div className="space-y-0">
                  {veiculosLeves.map(eq => (
                    <div key={eq.rowIndex} className="flex items-center justify-between py-1 border-b border-border last:border-0 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-medium shrink-0">{eq.codigo}</span>
                        <span className="text-xs text-muted-foreground truncate">{eq.operador || '—'}</span>
                      </div>
                      <Badge variant="outline" className={`text-[10px] h-5 shrink-0 ${STATUS_COLORS[eq.status] || ''}`}>{eq.status === 'MOBILIZADO' ? 'MOB' : eq.status === 'DESMOBILIZADO' ? 'DESM' : eq.status}</Badge>
                    </div>
                  ))}
                  {veiculosLeves.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhum veículo leve</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Veículos Leves Tab */}
        <TabsContent value="leves">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Total Leves</p>
                <p className="text-xl font-bold">{veiculosLeves.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Mobilizados</p>
                <p className="text-xl font-bold text-emerald-400">{veiculosLeves.filter(d => d.status === 'MOBILIZADO').length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Desmobilizados</p>
                <p className="text-xl font-bold text-red-400">{veiculosLeves.filter(d => d.status === 'DESMOBILIZADO').length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-sky-400">{formatBRL(veiculosLeves.reduce((s, d) => s + d.valorNumerico, 0))}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Valor Mob.</p>
                <p className="text-lg font-bold text-amber-400">{formatBRL(veiculosLeves.filter(d => d.status === 'MOBILIZADO').reduce((s, d) => s + d.valorNumerico, 0))}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Função / Proprietário</TableHead>
                    <TableHead className="text-xs">Marca/Modelo</TableHead>
                    <TableHead className="text-xs">Valor Locação</TableHead>
                    <TableHead className="text-xs">Operador</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veiculosLevesFiltered.map(eq => (
                    <TableRow key={eq.rowIndex} className="h-9">
                      <TableCell className="font-mono text-xs font-medium">{eq.codigo}</TableCell>
                      <TableCell className="text-xs">{eq.proprietario}</TableCell>
                      <TableCell className="text-xs">{eq.marcaModelo}</TableCell>
                      <TableCell className="text-xs font-mono">{eq.valorLocacao}</TableCell>
                      <TableCell className="text-xs">{eq.operador}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] h-5 ${STATUS_COLORS[eq.status] || ''}`}>{eq.status}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant={eq.status === 'MOBILIZADO' ? 'destructive' : 'default'}
                          disabled={togglingIdx === eq.rowIndex}
                          onClick={() => toggleStatus(eq)}
                          className="h-6 text-[10px] gap-1 px-2"
                        >
                          {togglingIdx === eq.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
                          {eq.status === 'MOBILIZADO' ? 'Desmob.' : 'Mob.'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Desmobilizados Tab */}
        <TabsContent value="desmob">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Total Desmobilizados</p>
                <p className="text-xl font-bold text-red-400">{desmobilizados}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Empresas</p>
                <p className="text-xl font-bold">{desmobByEmpresa.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Tipos</p>
                <p className="text-xl font-bold">{[...new Set(desmobilizadosData.map(d => d.equipamento))].length}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="pt-3 pb-3">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-muted-foreground">{formatBRL(desmobilizadosData.reduce((s, d) => s + d.valorNumerico, 0))}</p>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-3">
            {desmobByEmpresa.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum equipamento desmobilizado</p>
            ) : desmobByEmpresa.map(([empresa, items]) => {
              const valorEmpresa = items.reduce((s, d) => s + d.valorNumerico, 0);
              const byTipoMap: Record<string, EquipRow[]> = {};
              items.forEach(d => {
                const t = d.equipamento || 'Outros';
                if (!byTipoMap[t]) byTipoMap[t] = [];
                byTipoMap[t].push(d);
              });
              const tipoEntries = Object.entries(byTipoMap).sort((a, b) => b[1].length - a[1].length);

              return (
                <Collapsible key={empresa}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 transition-transform [[data-state=open]_&]:rotate-90" />
                            <Building2 className="w-4 h-4 text-red-400" />
                            {empresa}
                          </CardTitle>
                          <div className="flex items-center gap-3">
                            {valorEmpresa > 0 && <span className="text-sm font-medium text-muted-foreground">{formatBRL(valorEmpresa)}</span>}
                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">{items.length} desmob.</Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-1">
                        {tipoEntries.map(([tipo, tipoItems]) => (
                          <Collapsible key={tipo}>
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors border-b border-border">
                                <div className="flex items-center gap-2">
                                  <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-90" />
                                  <span className="text-xs font-medium">{tipo}</span>
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">{tipoItems.length}</Badge>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="ml-5 border-l-2 border-muted">
                                {tipoItems.map(eq => (
                                  <div key={eq.rowIndex} className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/20 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <span className="font-mono text-xs font-medium shrink-0 w-16">{eq.codigo}</span>
                                      <span className="text-xs text-muted-foreground truncate w-28">{eq.marcaModelo}</span>
                                      <span className="text-xs font-mono text-muted-foreground shrink-0 w-20">{eq.valorLocacao || '—'}</span>
                                      <span className="text-xs truncate">{eq.operador || '—'}</span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      disabled={togglingIdx === eq.rowIndex}
                                      onClick={() => toggleStatus(eq)}
                                      className="h-5 text-[10px] gap-1 px-1.5"
                                    >
                                      {togglingIdx === eq.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
                                      Mobilizar
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="empresa">
          <div className="space-y-3">
            {byEmpresa.map(([empresa, items]) => {
              const mobItems = items.filter(d => d.status === 'MOBILIZADO');
              const valorEmpresa = mobItems.reduce((s, d) => s + d.valorNumerico, 0);
              // Sub-group by tipo
              const byTipoMap: Record<string, EquipRow[]> = {};
              items.forEach(d => {
                const t = d.equipamento || 'Outros';
                if (!byTipoMap[t]) byTipoMap[t] = [];
                byTipoMap[t].push(d);
              });
              const tipoEntries = Object.entries(byTipoMap).sort((a, b) => b[1].length - a[1].length);

              return (
                <Collapsible key={empresa}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 transition-transform [[data-state=open]_&]:rotate-90" />
                            <Building2 className="w-4 h-4 text-sky-400" />
                            {empresa}
                          </CardTitle>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-amber-400">{formatBRL(valorEmpresa)}</span>
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{mobItems.length} mob.</Badge>
                            <Badge variant="outline">{items.length} equip.</Badge>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-1">
                        {tipoEntries.map(([tipo, tipoItems]) => {
                          const tipoMob = tipoItems.filter(d => d.status === 'MOBILIZADO');
                          const tipoValor = tipoMob.reduce((s, d) => s + d.valorNumerico, 0);
                          return (
                            <Collapsible key={tipo}>
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors border-b border-border">
                                  <div className="flex items-center gap-2">
                                    <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-90" />
                                    <span className="text-xs font-medium">{tipo}</span>
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1">{tipoItems.length}</Badge>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {tipoValor > 0 && <span className="text-[10px] font-mono text-amber-400">{formatBRL(tipoValor)}</span>}
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{tipoMob.length} mob.</Badge>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="ml-5 border-l-2 border-muted">
                                  {tipoItems.map(eq => (
                                    <div key={eq.rowIndex} className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/20 transition-colors">
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className="font-mono text-xs font-medium shrink-0 w-16">{eq.codigo}</span>
                                        <span className="text-xs text-muted-foreground truncate w-24">{eq.marcaModelo}</span>
                                        <span className="text-xs font-mono text-muted-foreground shrink-0 w-20">{eq.valorLocacao || '—'}</span>
                                        <span className="text-xs truncate">{eq.operador || '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <Badge variant="outline" className={`text-[10px] h-5 ${STATUS_COLORS[eq.status] || ''}`}>{eq.status}</Badge>
                                        <Button
                                          size="sm"
                                          variant={eq.status === 'MOBILIZADO' ? 'destructive' : 'default'}
                                          disabled={togglingIdx === eq.rowIndex}
                                          onClick={() => toggleStatus(eq)}
                                          className="h-5 text-[10px] gap-1 px-1.5"
                                        >
                                          {togglingIdx === eq.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
                                          {eq.status === 'MOBILIZADO' ? 'Desmob.' : 'Mob.'}
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </TabsContent>

        {/* Listagem Tab - Grouped by Empresa > Tipo */}
        <TabsContent value="lista">
          <div className="text-sm text-muted-foreground mb-3">
            Exibindo {filtered.length} de {totalEquip} equipamentos
          </div>
          <div className="space-y-3">
            {(() => {
              const grouped: Record<string, Record<string, EquipRow[]>> = {};
              filtered.forEach(d => {
                const emp = d.proprietario || 'Sem Proprietário';
                const tipo = d.equipamento || 'Outros';
                if (!grouped[emp]) grouped[emp] = {};
                if (!grouped[emp][tipo]) grouped[emp][tipo] = [];
                grouped[emp][tipo].push(d);
              });
              const sortedEmpresas = Object.entries(grouped).sort((a, b) => {
                const countA = Object.values(a[1]).reduce((s, arr) => s + arr.length, 0);
                const countB = Object.values(b[1]).reduce((s, arr) => s + arr.length, 0);
                return countB - countA;
              });

              return sortedEmpresas.map(([empresa, tipos]) => {
                const empTotal = Object.values(tipos).reduce((s, arr) => s + arr.length, 0);
                const empMob = Object.values(tipos).flat().filter(d => d.status === 'MOBILIZADO');
                const empValor = empMob.reduce((s, d) => s + d.valorNumerico, 0);
                return (
                  <Collapsible key={empresa}>
                    <Card>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <ChevronRight className="w-4 h-4 transition-transform [[data-state=open]_&]:rotate-90" />
                              <Building2 className="w-4 h-4 text-sky-400" />
                              {empresa}
                            </CardTitle>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-amber-400">{formatBRL(empValor)}</span>
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{empMob.length} mob.</Badge>
                              <Badge variant="outline">{empTotal} equip.</Badge>
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0 space-y-1">
                          {Object.entries(tipos).sort((a, b) => b[1].length - a[1].length).map(([tipo, items]) => {
                            const tipoMob = items.filter(d => d.status === 'MOBILIZADO');
                            const tipoValor = tipoMob.reduce((s, d) => s + d.valorNumerico, 0);
                            return (
                              <Collapsible key={tipo}>
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors border-b border-border">
                                    <div className="flex items-center gap-2">
                                      <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-90" />
                                      <span className="text-xs font-medium">{tipo}</span>
                                      <Badge variant="secondary" className="text-[10px] h-4 px-1">{items.length}</Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {tipoValor > 0 && <span className="text-[10px] font-mono text-amber-400">{formatBRL(tipoValor)}</span>}
                                      <Badge variant="outline" className="text-[10px] h-4 px-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{tipoMob.length} mob.</Badge>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="ml-5 border-l-2 border-muted">
                                    {items.map(eq => (
                                      <div key={eq.rowIndex} className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/20 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                          <span className="font-mono text-xs font-medium shrink-0 w-16">{eq.codigo}</span>
                                          <span className="text-xs text-muted-foreground truncate w-24">{eq.marcaModelo}</span>
                                          <span className="text-xs font-mono text-muted-foreground shrink-0 w-20">{eq.valorLocacao || '—'}</span>
                                          <span className="text-xs truncate">{eq.operador || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <Badge variant="outline" className={`text-[10px] h-5 ${STATUS_COLORS[eq.status] || ''}`}>{eq.status}</Badge>
                                          <Button
                                            size="sm"
                                            variant={eq.status === 'MOBILIZADO' ? 'destructive' : 'default'}
                                            disabled={togglingIdx === eq.rowIndex}
                                            onClick={() => toggleStatus(eq)}
                                            className="h-5 text-[10px] gap-1 px-1.5"
                                          >
                                            {togglingIdx === eq.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
                                            {eq.status === 'MOBILIZADO' ? 'Desmob.' : 'Mob.'}
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              });
            })()}
          </div>
        </TabsContent>
      </Tabs>

      <ReportHeaderConfigModal
        open={showHeaderConfig}
        onOpenChange={setShowHeaderConfig}
        reportLabel="Mobilização"
        config={headerConfig}
        defaults={headerDefaults}
        onSave={saveHeaderConfig}
      />
    </div>
  );
}

