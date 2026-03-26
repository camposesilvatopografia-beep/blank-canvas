import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useObraConfig } from '@/hooks/useObraConfig';
import { useReportHeaderConfig } from '@/hooks/useReportHeaderConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Truck, Building2, Search, CheckCircle, AlertTriangle, BarChart3, Package, ArrowUpDown, Loader2, Car, ChevronRight, FileText, Settings2, Pencil, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ReportHeaderConfigModal } from '@/components/crud/ReportHeaderConfigModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
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
  operador: string;
  status: string;
  rowIndex: number;
}

interface ColIndices {
  item: number; codigo: number; proprietario: number; equipamento: number;
  marca: number; potencia: number; operador: number; status: number;
  totalCols: number;
}

const STATUS_COLORS: Record<string, string> = {
  'MOBILIZADO': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'DESMOBILIZADO': 'bg-red-500/15 text-red-400 border-red-500/30',
  'A MOBILIZAR': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'EM MANUTENÇÃO': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

export default function FrotaGeralObra() {
  const { readSheet, writeSheet, deleteRow: deleteSheetRow, loading: sheetsLoading } = useGoogleSheets();
  const [data, setData] = useState<EquipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingIdx, setTogglingIdx] = useState<number | null>(null);
  const { obraConfig } = useObraConfig();
  const { config: headerConfig, save: saveHeaderConfig, getHeaderCss, defaults: headerDefaults } = useReportHeaderConfig('frota_geral_obra');
  const [showHeaderConfig, setShowHeaderConfig] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmpresa, setFilterEmpresa] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');
  const [statusColIndex, setStatusColIndex] = useState(-1);
  const [colIndices, setColIndices] = useState<ColIndices | null>(null);
  const [expandedTipo, setExpandedTipo] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [editItem, setEditItem] = useState<EquipRow | null>(null);
  const [editForm, setEditForm] = useState<Partial<EquipRow>>({});
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<EquipRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
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
      const iOp = idx('OPERADOR') >= 0 ? idx('OPERADOR') : idx('MOTORISTA');
      const iStatus = idx('STATUS');
      setStatusColIndex(iStatus);
      setColIndices({ item: iItem, codigo: iCodigo, proprietario: iProp, equipamento: iEquip, marca: iMarca, potencia: iPot, operador: iOp, status: iStatus, totalCols: headers.length });

      const parsed: EquipRow[] = rows.slice(1)
        .map((r: any[], i: number) => {
          if (!r.some((c: any) => c && c.toString().trim())) return null;
          return {
            item: r[iItem] || '',
            codigo: r[iCodigo] || '',
            proprietario: (r[iProp] || '').toString().trim(),
            equipamento: (r[iEquip] || '').toString().trim(),
            marcaModelo: (r[iMarca] || '').toString().trim(),
            potencia: (r[iPot] || '').toString().trim(),
            operador: (r[iOp] || '').toString().trim(),
            status: (r[iStatus] || '').toString().trim().toUpperCase(),
            rowIndex: i + 1,
          };
        })
        .filter(Boolean) as EquipRow[];
      setData(parsed);
    } catch (err) {
      console.error('Erro ao carregar Mobilização:', err);
    } finally {
      setLoading(false);
    }
  }, [readSheet]);

  useEffect(() => { loadData(); }, []);

  const toggleStatus = useCallback(async (eq: EquipRow) => {
    if (statusColIndex < 0) return;
    const newStatus = eq.status === 'MOBILIZADO' ? 'DESMOBILIZADO' : 'MOBILIZADO';
    setTogglingIdx(eq.rowIndex);
    try {
      const colLetter = String.fromCharCode(65 + statusColIndex);
      const cellRef = `${colLetter}${eq.rowIndex + 1}`;
      const ok = await writeSheet('Mobilização', cellRef, [[newStatus]]);
      if (!ok) throw new Error('Falha ao gravar');
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


  const openEdit = useCallback((eq: EquipRow) => {
    setEditForm({ ...eq });
    setEditItem(eq);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editItem || !colIndices) return;
    setSaving(true);
    try {
      const colLetter = (idx: number) => idx >= 0 ? String.fromCharCode(65 + idx) : null;
      const updates: [string, string[][]][] = [];
      const row = editItem.rowIndex + 1;
      
      const fieldMap: { field: keyof EquipRow; colIdx: number }[] = [
        { field: 'codigo', colIdx: colIndices.codigo },
        { field: 'proprietario', colIdx: colIndices.proprietario },
        { field: 'equipamento', colIdx: colIndices.equipamento },
        { field: 'marcaModelo', colIdx: colIndices.marca },
        { field: 'potencia', colIdx: colIndices.potencia },
        { field: 'operador', colIdx: colIndices.operador },
        { field: 'status', colIdx: colIndices.status },
      ];
      
      for (const { field, colIdx } of fieldMap) {
        if (colIdx < 0) continue;
        const newVal = (editForm[field] || '').toString();
        const oldVal = (editItem[field] || '').toString();
        if (newVal !== oldVal) {
          const letter = colLetter(colIdx);
          if (letter) updates.push([`${letter}${row}`, [[newVal]]]);
        }
      }
      
      if (updates.length === 0) {
        toast.info('Nenhuma alteração detectada');
        setEditItem(null);
        setSaving(false);
        return;
      }
      
      for (const [cellRef, values] of updates) {
        const ok = await writeSheet('Mobilização', cellRef, values);
        if (!ok) throw new Error(`Falha ao gravar ${cellRef}`);
      }
      
      setData(prev => prev.map(d =>
        d.rowIndex === editItem.rowIndex ? {
          ...d,
          codigo: editForm.codigo || d.codigo,
          proprietario: editForm.proprietario || d.proprietario,
          equipamento: editForm.equipamento || d.equipamento,
          marcaModelo: editForm.marcaModelo || d.marcaModelo,
          potencia: editForm.potencia || d.potencia,
          operador: editForm.operador || d.operador,
          status: (editForm.status || d.status).toUpperCase(),
        } : d
      ));
      toast.success(`${editForm.codigo || editItem.codigo} atualizado`);
      setEditItem(null);
    } catch (err) {
      console.error('Erro ao salvar edição:', err);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  }, [editItem, editForm, colIndices, writeSheet]);

  const handleDelete = useCallback(async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const ok = await deleteSheetRow('Mobilização', deleteItem.rowIndex);
      if (!ok) throw new Error('Falha ao excluir');
      setData(prev => prev.filter(d => d.rowIndex !== deleteItem.rowIndex));
      toast.success(`${deleteItem.codigo} excluído`);
      setDeleteItem(null);
    } catch (err) {
      console.error('Erro ao excluir:', err);
      toast.error('Erro ao excluir equipamento');
    } finally {
      setDeleting(false);
    }
  }, [deleteItem, deleteSheetRow]);

  const empresas = useMemo(() => [...new Set(data.map(d => d.proprietario).filter(Boolean))].sort(), [data]);
  const tipos = useMemo(() => [...new Set(data.map(d => d.equipamento).filter(Boolean))].sort(), [data]);
  const statuses = useMemo(() => [...new Set(data.map(d => d.status).filter(Boolean))].sort(), [data]);

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

  const totalEquip = data.length;
  const mobilizadosData = useMemo(() => data.filter(d => d.status === 'MOBILIZADO'), [data]);
  const desmobilizadosData = useMemo(() => data.filter(d => d.status === 'DESMOBILIZADO'), [data]);
  const mobilizados = mobilizadosData.length;
  const desmobilizados = desmobilizadosData.length;
  const aMobilizar = data.filter(d => d.status === 'A MOBILIZAR').length;

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

  const desmobByEmpresa = useMemo(() => {
    const map: Record<string, EquipRow[]> = {};
    desmobilizadosData.forEach(d => {
      const key = d.proprietario || 'Sem Proprietário';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [desmobilizadosData]);

  const byEmpresa = useMemo(() => {
    const map: Record<string, EquipRow[]> = {};
    filtered.forEach(d => {
      const key = d.proprietario || 'Sem Proprietário';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const byTipoItems = useMemo(() => {
    const map: Record<string, EquipRow[]> = {};
    filtered.forEach(d => {
      const key = d.equipamento || 'Outros';
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(d => {
      const key = d.status || 'Sem Status';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const veiculosLeves = useMemo(() => {
    return data.filter(d => d.equipamento.toUpperCase().includes('VEÍCULO LEVE') || d.equipamento.toUpperCase().includes('VEICULO LEVE'));
  }, [data]);

  const veiculosLevesFiltered = useMemo(() => {
    return filtered.filter(d => d.equipamento.toUpperCase().includes('VEÍCULO LEVE') || d.equipamento.toUpperCase().includes('VEICULO LEVE'));
  }, [filtered]);

  // PDF Export (sem valores)
  const exportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const NAVY = [29, 53, 87] as const;
      const GRAY = [120, 120, 120] as const;
      const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      let y = 8;
      const padLeft = headerConfig.header_padding_left || 20;

      if (obraConfig.logo) {
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
      doc.text('FROTA GERAL DA OBRA', W / 2, y, { align: 'center' });
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

      // KPIs (sem valor)
      const kpis = [
        { label: 'Total Equipamentos', value: String(totalEquip) },
        { label: 'Mobilizados', value: String(mobilizados) },
        { label: 'Desmobilizados', value: String(desmobilizados) },
        { label: 'A Mobilizar', value: String(aMobilizar) },
      ];
      const kpiW = (W - padLeft * 2 - 3 * 3) / 4;
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

      // Resumo por empresa (sem valores)
      doc.setFontSize(10); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
      doc.text('RESUMO POR EMPRESA', padLeft, y); y += 5;
      const empCols = ['Empresa', 'Qtd Total', 'Mobilizados', 'Desmob.'];
      const empColW = [70, 30, 30, 30];
      let xPos = padLeft;
      doc.setFillColor(...NAVY); doc.rect(padLeft, y, W - padLeft * 2, 6, 'F');
      doc.setFontSize(7); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
      empCols.forEach((col, i) => { doc.text(col, xPos + 2, y + 4); xPos += empColW[i]; });
      y += 6;

      const empresasSummary = empresas.map(emp => {
        const items = data.filter(d => d.proprietario === emp);
        return {
          empresa: emp,
          total: items.length,
          mobilizados: items.filter(d => d.status === 'MOBILIZADO').length,
          desmobilizados: items.filter(d => d.status === 'DESMOBILIZADO').length,
        };
      }).sort((a, b) => b.total - a.total);

      doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      empresasSummary.forEach((emp, idx) => {
        if (idx % 2 === 0) { doc.setFillColor(248, 249, 252); doc.rect(padLeft, y, W - padLeft * 2, 5, 'F'); }
        xPos = padLeft;
        [emp.empresa, String(emp.total), String(emp.mobilizados), String(emp.desmobilizados)].forEach((v, i) => { doc.text(v, xPos + 2, y + 3.5); xPos += empColW[i]; });
        y += 5;
      });
      y += 4;

      // Tipo table (sem valores)
      doc.setFontSize(10); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
      doc.text('DISTRIBUIÇÃO POR TIPO DE EQUIPAMENTO', padLeft, y); y += 5;
      const tipoCols = ['Tipo', 'Qtd', 'Mob.', 'Desmob.'];
      const tipoColW = [80, 25, 25, 25];
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
        if (idx % 2 === 0) { doc.setFillColor(248, 249, 252); doc.rect(padLeft, y, W - padLeft * 2, 5, 'F'); }
        xPos = padLeft;
        [tipo, String(items.length), String(mob.length), String(desm.length)].forEach((v, i) => { doc.text(v, xPos + 2, y + 3.5); xPos += tipoColW[i]; });
        y += 5;
      });
      y += 4;

      // Detailed list (sem valores)
      const empresasGroup: Record<string, EquipRow[]> = {};
      data.forEach(d => {
        const emp = d.proprietario || 'Sem Proprietário';
        if (!empresasGroup[emp]) empresasGroup[emp] = [];
        empresasGroup[emp].push(d);
      });
      const sortedEmpresas = Object.entries(empresasGroup).sort((a, b) => b[1].length - a[1].length);

      const detCols = ['Código', 'Tipo', 'Marca/Modelo', 'Operador', 'Status'];
      const detColW = [28, 55, 60, 55, 30];
      const tableW = detColW.reduce((s, w) => s + w, 0);

      const empBgColors: [number, number, number][] = [
        [230, 240, 255], [245, 230, 255], [225, 248, 240], [255, 240, 225], [240, 255, 245], [255, 235, 240]
      ];

      sortedEmpresas.forEach(([empresa, items], empIdx) => {
        if (y > H - 30) { doc.addPage(); y = 10; }
        const mobItems = items.filter(d => d.status === 'MOBILIZADO');
        const desmItems = items.filter(d => d.status === 'DESMOBILIZADO');
        const bgColor = empBgColors[empIdx % empBgColors.length];

        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.roundedRect(padLeft, y, W - padLeft * 2, 10, 1.5, 1.5, 'F');
        doc.setFontSize(9); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
        doc.text(empresa.toUpperCase(), padLeft + 3, y + 4.5);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
        doc.text(`${items.length} equip.  |  ${mobItems.length} mob.  |  ${desmItems.length} desmob.`, padLeft + 3, y + 8.5);
        y += 12;

        xPos = padLeft;
        doc.setFillColor(...NAVY); doc.rect(padLeft, y, tableW, 5.5, 'F');
        doc.setFontSize(6.5); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
        detCols.forEach((c, i) => { doc.text(c, xPos + 1.5, y + 3.8); xPos += detColW[i]; });
        y += 5.5;

        doc.setTextColor(0); doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        items.forEach((eq, idx) => {
          if (y > H - 10) { doc.addPage(); y = 10; }
          if (idx % 2 === 0) { doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]); doc.rect(padLeft, y, tableW, 4.5, 'F'); }
          xPos = padLeft;
          [eq.codigo, eq.equipamento, eq.marcaModelo, eq.operador || '—', eq.status].forEach((v, i) => {
            doc.text(String(v).substring(0, 35), xPos + 1.5, y + 3.2); xPos += detColW[i];
          });
          y += 4.5;
        });

        doc.setFillColor(bgColor[0] - 10, bgColor[1] - 10, bgColor[2] - 10);
        doc.rect(padLeft, y, tableW, 5, 'F');
        doc.setFontSize(6.5); doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold');
        doc.text(`Subtotal ${empresa}: ${items.length} equip.`, padLeft + 2, y + 3.5);
        y += 8;
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(...GRAY); doc.setFont('helvetica', 'italic');
        doc.text(`Página ${i}/${pageCount}`, W - padLeft, H - 5, { align: 'right' });
        doc.text('AproprIApp — Frota Geral da Obra', padLeft, H - 5);
      }

      doc.save(`frota-geral-obra-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Relatório exportado com sucesso');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.error('Erro ao gerar PDF');
    }
    setExporting(false);
  }, [data, totalEquip, mobilizados, desmobilizados, aMobilizar, byTipoItems, obraConfig, headerConfig, empresas]);

  if (loading) return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-96" />
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/20">
            <Truck className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Frota Geral da Obra</h1>
            <p className="text-sm text-muted-foreground">Visão operacional da frota mobilizada</p>
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

      {/* KPI Cards (sem valores) */}
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
              <div className="p-2 rounded-lg bg-amber-500/15"><Truck className="w-5 h-5 text-amber-400" /></div>
              <div>
                <p className="text-xs text-muted-foreground">A Mobilizar</p>
                <p className="text-2xl font-bold text-amber-400">{aMobilizar}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Por Tipo de Equipamento</CardTitle></CardHeader>
              <CardContent className="max-h-[320px] overflow-y-auto space-y-0">
                {byTipoItems.map(([tipo, items]) => {
                  const isExpanded = expandedTipo === tipo;
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

        {/* Veículos Leves Tab (sem valores) */}
        <TabsContent value="leves">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
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
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Código</TableHead>
                    <TableHead className="text-xs">Proprietário</TableHead>
                    <TableHead className="text-xs">Marca/Modelo</TableHead>
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
                      <TableCell className="text-xs">{eq.operador}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] h-5 ${STATUS_COLORS[eq.status] || ''}`}>{eq.status}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant={eq.status === 'MOBILIZADO' ? 'destructive' : 'default'} disabled={togglingIdx === eq.rowIndex} onClick={() => toggleStatus(eq)} className="h-6 text-[10px] gap-1 px-2">
                            {togglingIdx === eq.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
                            {eq.status === 'MOBILIZADO' ? 'Desmob.' : 'Mob.'}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(eq)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setDeleteItem(eq)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Desmobilizados Tab (sem valores) */}
        <TabsContent value="desmob">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
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
          </div>
          <div className="space-y-3">
            {desmobByEmpresa.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum equipamento desmobilizado</p>
            ) : desmobByEmpresa.map(([empresa, items]) => {
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
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">{items.length} desmob.</Badge>
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
                                      <span className="text-xs truncate">{eq.operador || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button size="sm" variant="default" disabled={togglingIdx === eq.rowIndex} onClick={() => toggleStatus(eq)} className="h-5 text-[10px] gap-1 px-1.5">
                                        {togglingIdx === eq.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
                                        Mobilizar
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => openEdit(eq)}><Pencil className="w-3 h-3" /></Button>
                                      <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => setDeleteItem(eq)}><Trash2 className="w-3 h-3" /></Button>
                                    </div>
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

        {/* Por Empresa Tab (sem valores) */}
        <TabsContent value="empresa">
          <div className="space-y-3">
            {byEmpresa.map(([empresa, items]) => {
              const mobItems = items.filter(d => d.status === 'MOBILIZADO');
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
                          return (
                            <Collapsible key={tipo}>
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors border-b border-border">
                                  <div className="flex items-center gap-2">
                                    <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-90" />
                                    <span className="text-xs font-medium">{tipo}</span>
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1">{tipoItems.length}</Badge>
                                  </div>
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{tipoMob.length} mob.</Badge>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="ml-5 border-l-2 border-muted">
                                  {tipoItems.map(eq => (
                                    <div key={eq.rowIndex} className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/20 transition-colors">
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className="font-mono text-xs font-medium shrink-0 w-16">{eq.codigo}</span>
                                        <span className="text-xs text-muted-foreground truncate w-24">{eq.marcaModelo}</span>
                                        <span className="text-xs truncate">{eq.operador || '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Badge variant="outline" className={`text-[10px] h-5 ${STATUS_COLORS[eq.status] || ''}`}>{eq.status}</Badge>
                                        <Button size="sm" variant={eq.status === 'MOBILIZADO' ? 'destructive' : 'default'} disabled={togglingIdx === eq.rowIndex} onClick={() => toggleStatus(eq)} className="h-5 text-[10px] gap-1 px-1.5">
                                          {togglingIdx === eq.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
                                          {eq.status === 'MOBILIZADO' ? 'Desmob.' : 'Mob.'}
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => openEdit(eq)}><Pencil className="w-3 h-3" /></Button>
                                        <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => setDeleteItem(eq)}><Trash2 className="w-3 h-3" /></Button>
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

        {/* Listagem Tab (sem valores) */}
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
                            return (
                              <Collapsible key={tipo}>
                                <CollapsibleTrigger asChild>
                                  <div className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors border-b border-border">
                                    <div className="flex items-center gap-2">
                                      <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-90" />
                                      <span className="text-xs font-medium">{tipo}</span>
                                      <Badge variant="secondary" className="text-[10px] h-4 px-1">{items.length}</Badge>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] h-4 px-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">{tipoMob.length} mob.</Badge>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="ml-5 border-l-2 border-muted">
                                    {items.map(eq => (
                                      <div key={eq.rowIndex} className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/20 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                          <span className="font-mono text-xs font-medium shrink-0 w-16">{eq.codigo}</span>
                                          <span className="text-xs text-muted-foreground truncate w-24">{eq.marcaModelo}</span>
                                          <span className="text-xs truncate">{eq.operador || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Badge variant="outline" className={`text-[10px] h-5 ${STATUS_COLORS[eq.status] || ''}`}>{eq.status}</Badge>
                                          <Button size="sm" variant={eq.status === 'MOBILIZADO' ? 'destructive' : 'default'} disabled={togglingIdx === eq.rowIndex} onClick={() => toggleStatus(eq)} className="h-5 text-[10px] gap-1 px-1.5">
                                            {togglingIdx === eq.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
                                            {eq.status === 'MOBILIZADO' ? 'Desmob.' : 'Mob.'}
                                          </Button>
                                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => openEdit(eq)}><Pencil className="w-3 h-3" /></Button>
                                          <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => setDeleteItem(eq)}><Trash2 className="w-3 h-3" /></Button>
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
        reportLabel="Frota Geral da Obra"
        config={headerConfig}
        defaults={headerDefaults}
        onSave={saveHeaderConfig}
      />

      {/* Edit Modal */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Equipamento — {editForm.codigo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código / TAG</Label>
                <Input value={editForm.codigo || ''} onChange={e => setEditForm(p => ({ ...p, codigo: e.target.value }))} disabled={saving} />
              </div>
              <div className="space-y-2">
                <Label>Proprietário</Label>
                <Input value={editForm.proprietario || ''} onChange={e => setEditForm(p => ({ ...p, proprietario: e.target.value }))} disabled={saving} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Equipamento</Label>
              <Input value={editForm.equipamento || ''} onChange={e => setEditForm(p => ({ ...p, equipamento: e.target.value }))} disabled={saving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca / Modelo</Label>
                <Input value={editForm.marcaModelo || ''} onChange={e => setEditForm(p => ({ ...p, marcaModelo: e.target.value }))} disabled={saving} />
              </div>
              <div className="space-y-2">
                <Label>Potência</Label>
                <Input value={editForm.potencia || ''} onChange={e => setEditForm(p => ({ ...p, potencia: e.target.value }))} disabled={saving} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Operador / Motorista</Label>
              <Input value={editForm.operador || ''} onChange={e => setEditForm(p => ({ ...p, operador: e.target.value }))} disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status || ''} onValueChange={v => setEditForm(p => ({ ...p, status: v }))} disabled={saving}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {['MOBILIZADO', 'DESMOBILIZADO', 'A MOBILIZAR', 'EM MANUTENÇÃO'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  {editForm.status && !['MOBILIZADO', 'DESMOBILIZADO', 'A MOBILIZAR', 'EM MANUTENÇÃO'].includes(editForm.status) && (
                    <SelectItem value={editForm.status}>{editForm.status}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => { if (!o) setDeleteItem(null); }}
        onConfirm={handleDelete}
        title="Excluir Equipamento"
        description={`Tem certeza que deseja excluir "${deleteItem?.codigo}" (${deleteItem?.equipamento})? Esta ação não pode ser desfeita.`}
        loading={deleting}
      />
    </div>
  );
}
