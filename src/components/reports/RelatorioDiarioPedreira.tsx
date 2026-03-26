import { useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Truck, Mountain, Building2, Package, ClipboardList, CalendarDays, MessageCircle, Scale } from 'lucide-react';
import { PedreiraFilterBar } from '@/components/reports/PedreiraFilterBar';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';

interface DayRecord {
  data?: string;
  hora: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  fornecedor: string;
  motorista: string;
  material: string;
  tonelada: number;
  ordem: string;
  pesoFinal?: number;
  pesoChegada?: number;
  fotoChegada?: string;
  status?: string;
}

interface RelatorioDiarioPedreiraProps {
  records: DayRecord[];
  selectedDate: string;
  freteRate?: number;
  allRecords?: DayRecord[];
  availableDates?: string[];
}

export function RelatorioDiarioPedreira({
  records,
  selectedDate,
  freteRate = 0,
  allRecords,
  availableDates = [],
}: RelatorioDiarioPedreiraProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [internalDate, setInternalDate] = useState<string>('');
  const [filterMaterial, setFilterMaterial] = useState<string[]>([]);
  const [filterFornecedor, setFilterFornecedor] = useState<string[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterVeiculo, setFilterVeiculo] = useState<string[]>([]);

  const toBase64 = (src: string): Promise<string> => {
    if (src.startsWith('data:')) return Promise.resolve(src);
    return new Promise<string>((resolve) => {
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

  const baseRecordsForDate = useMemo(() => {
    if (internalDate && allRecords) {
      return allRecords.filter(r => r.data === internalDate);
    }
    return records;
  }, [internalDate, allRecords, records]);

  const activeRecords = useMemo(() => {
    return baseRecordsForDate.filter(r => {
      if (filterMaterial.length > 0 && !filterMaterial.includes(r.material)) return false;
      if (filterFornecedor.length > 0 && !filterFornecedor.includes(r.fornecedor)) return false;
      if (filterEmpresa.length > 0 && !filterEmpresa.includes(r.empresa)) return false;
      if (filterVeiculo.length > 0 && !filterVeiculo.includes(r.prefixo)) return false;
      return true;
    });
  }, [baseRecordsForDate, filterMaterial, filterFornecedor, filterEmpresa, filterVeiculo]);

  const activeDate = internalDate || selectedDate;
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const totalViagens = activeRecords.length;
  const finalizadoRecords = activeRecords.filter(r => !r.status || r.status.toLowerCase() === 'finalizado');
  const totalTon = finalizadoRecords.reduce((s, r) => s + r.tonelada, 0);

  // --- Vehicle summary ---
  const vehicleStats = useMemo(() => {
    const vehicleMap = new Map<string, { empresa: string; motorista: string; viagens: number; toneladas: number; materiais: Set<string> }>();
    activeRecords.forEach(r => {
      const k = r.prefixo || 'Sem Prefixo';
      if (!vehicleMap.has(k)) vehicleMap.set(k, { empresa: r.empresa, motorista: r.motorista, viagens: 0, toneladas: 0, materiais: new Set() });
      const v = vehicleMap.get(k)!;
      v.viagens += 1;
      v.toneladas += r.tonelada;
      if (r.material) v.materiais.add(r.material);
    });
    return Array.from(vehicleMap.entries())
      .map(([prefixo, v]) => ({ prefixo, ...v, materiais: Array.from(v.materiais) }))
      .sort((a, b) => b.viagens - a.viagens);
  }, [activeRecords]);

  // --- Material + Fornecedor summary ---
  const materialStats = useMemo(() => {
    const matMap = new Map<string, { material: string; fornecedor: string; viagens: number; toneladas: number; veiculos: Set<string> }>();
    activeRecords
      .filter(r => (r.material || '').trim() !== '' && (r.material || '').trim().toLowerCase() !== 'outros' && r.tonelada > 0)
      .forEach(r => {
      const mat = r.material || 'Outros';
      const forn = r.fornecedor || 'Sem Fornecedor';
      const k = `${mat}|${forn}`;
      if (!matMap.has(k)) matMap.set(k, { material: mat, fornecedor: forn, viagens: 0, toneladas: 0, veiculos: new Set() });
      const v = matMap.get(k)!;
      v.viagens += 1;
      v.toneladas += r.tonelada;
      if (r.prefixo) v.veiculos.add(r.prefixo);
    });
    return Array.from(matMap.values())
      .filter(v => v.material !== 'Outros')
      .sort((a, b) => a.material.localeCompare(b.material) || a.fornecedor.localeCompare(b.fornecedor));
  }, [activeRecords]);

  // --- Empresa summary ---
  const empresaStats = useMemo(() => {
    const empMap = new Map<string, { viagens: number; toneladas: number; veiculos: Set<string> }>();
    activeRecords.forEach(r => {
      const k = r.empresa || 'Outros';
      if (!empMap.has(k)) empMap.set(k, { viagens: 0, toneladas: 0, veiculos: new Set() });
      const v = empMap.get(k)!;
      v.viagens += 1;
      v.toneladas += r.tonelada;
      if (r.prefixo) v.veiculos.add(r.prefixo);
    });
    return Array.from(empMap.entries())
      .filter(([empresa]) => empresa !== 'Outros')
      .map(([empresa, v]) => ({ empresa, viagens: v.viagens, toneladas: v.toneladas, veiculos: v.veiculos.size }))
      .sort((a, b) => b.viagens - a.viagens);
  }, [activeRecords]);

  // --- Fornecedor summary ---
  const fornecedorStats = useMemo(() => {
    const fornMap = new Map<string, { viagens: number; toneladas: number }>();
    activeRecords.forEach(r => {
      const k = r.fornecedor || 'Sem Fornecedor';
      if (!fornMap.has(k)) fornMap.set(k, { viagens: 0, toneladas: 0 });
      const v = fornMap.get(k)!;
      v.viagens += 1;
      v.toneladas += r.tonelada;
    });
    return Array.from(fornMap.entries())
      .map(([fornecedor, v]) => ({ fornecedor, viagens: v.viagens, toneladas: v.toneladas }))
      .sort((a, b) => b.viagens - a.viagens);
  }, [activeRecords]);

  // --- Materials grouped by Fornecedor (for separate cards) ---
  const materialsByFornecedor = useMemo(() => {
    const grouped = new Map<string, { material: string; viagens: number; toneladas: number }[]>();
    activeRecords
      .filter(r => (r.material || '').trim() !== '' && (r.material || '').trim().toLowerCase() !== 'outros' && r.tonelada > 0)
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
  }, [activeRecords]);

  // ─── Vehicle KPI (excluindo Areia Express) ─────────────────────────────────
  const vehicleKpi = useMemo(() => {
    const nonAE = activeRecords.filter(r => !(r.fornecedor || '').toLowerCase().includes('areia express'));
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
  }, [activeRecords]);

  // ─── Sorting hooks ───────────────────────────────────────────────────────────
  const empSort = useTableSort(empresaStats);
  const vehSort = useTableSort(vehicleStats);

  // Weight records with diferenca field for sorting
  const weightRecordsWithDif = useMemo(() => {
    const recsComChegada = activeRecords.filter(r => (r.pesoChegada || 0) > 0 && (r.pesoFinal || 0) > 0);
    return recsComChegada.map(r => ({ ...r, diferenca: (r.pesoFinal || 0) - (r.pesoChegada || 0) }));
  }, [activeRecords]);
  const weightSort = useTableSort(weightRecordsWithDif);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const openWhatsApp = (text: string) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const exportMiniPDF = (title: string, icon: string, headers: string[], rows: string[][], totalRow: string[]) => {
    const buildTable = () => `
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r, i) => `<tr class="${i % 2 === 0 ? '' : 'alt'}">${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr>${totalRow.map(t => `<td>${t}</td>`).join('')}</tr></tfoot>
      </table>`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <title>${title}</title>
      <style>
        @page{size:A4 portrait;margin:12mm}
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
        body{padding:0;font-size:9px;color:#1a1a2e}
        .hd{background:linear-gradient(135deg,#c2410c,#f97316);color:#fff;padding:12px 16px;border-radius:8px 8px 0 0}
        .hd h1{font-size:14px;font-weight:800}
        .hd p{font-size:8px;opacity:.9;margin-top:3px}
        .section{border:1px solid #e5e7eb;border-radius:0 0 7px 7px;overflow:hidden}
        table{width:100%;border-collapse:collapse}
        th{background:#fff7ed;color:#7c2d12;padding:6px 8px;text-align:left;font-size:8px;font-weight:700;border-bottom:2px solid #ea580c}
        td{border-bottom:1px solid #f3f4f6;padding:5px 8px;font-size:8.5px;color:#374151}
        tr.alt td{background:#fafafa}
        tfoot td{background:#fff7ed!important;font-weight:700;border-top:2px solid #ea580c;color:#7c2d12}
        .ft{text-align:center;font-size:7.5px;color:#9ca3af;margin-top:10px;padding-top:6px;border-top:1px solid #e5e7eb}
        @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style></head><body>
      <div class="hd"><h1>${icon} ${title}</h1><p>📅 ${activeDate} • ${totalViagens} viagens • ${fmt(totalTon)} t</p></div>
      <div class="section">${buildTable()}</div>
      <div class="ft">ApropriAPP — Gestão Inteligente • ${new Date().toLocaleString('pt-BR')}</div>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
  };

  // WhatsApp per section
  const whatsAppMaterial = () => {
    const lines = materialStats.map(m => `📦 *${m.material}* (${m.fornecedor}) — ${m.viagens} viag. — ${fmt(m.toneladas)} t`).join('\n');
    openWhatsApp(`⛰️ *PEDREIRA — Por Material*\n📅 ${activeDate}\n\n${lines}\n\n✅ *TOTAL: ${totalViagens} viagens | ${fmt(totalTon)} t*`);
  };

  // Main WhatsApp (consolidated: veículo + material)
  const whatsAppCompleto = () => {
    const veiculoLines = vehicleStats.map(v => `  🚛 *${v.prefixo}* — ${v.viagens} viag. — ${fmt(v.toneladas)} t`).join('\n');
    const materialLines = materialStats.map(m => `  📦 *${m.material}* — ${m.viagens} viag. — ${fmt(m.toneladas)} t`).join('\n');
    const text = [
      `⛰️ *RELATÓRIO DIÁRIO — PEDREIRA*`,
      `📅 ${activeDate}`,
      ``,
      `📊 *TOTAIS*`,
      `  • Viagens: *${totalViagens}*`,
      `  • Toneladas: *${fmt(totalTon)} t*`,
      `  • Veículos: ${vehicleStats.length} | Fornecedores: ${fornecedorStats.length}`,
      ``,
      `🚛 *POR VEÍCULO*`,
      veiculoLines,
      ``,
      `📦 *POR MATERIAL*`,
      materialLines,
      ``,
      `✅ *Total: ${totalViagens} viagens | ${fmt(totalTon)} t*`,
    ].join('\n');
    openWhatsApp(text);
  };

  // ─── PDF Export ────────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    // Temporarily show the print header for PDF capture
    const printHeader = reportRef.current.querySelector('.print-header-pedreira');
    if (printHeader) {
      printHeader.classList.remove('hidden');
    }

    // Pre-load logo as base64 to avoid CORS issues in canvas
    const logoImgs = reportRef.current.querySelectorAll('img');
    const logoPromises = Array.from(logoImgs).map(async (img) => {
      try {
        const b64 = await toBase64(img.src);
        img.src = b64;
      } catch { /* ignore */ }
    });
    await Promise.all(logoPromises);

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    // Hide the print header again
    if (printHeader) {
      printHeader.classList.add('hidden');
    }

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const usableWidth = pdfWidth - margin * 2;
    const scaledHeight = (imgHeight * usableWidth) / imgWidth;

    if (scaledHeight <= pdfHeight - margin * 2) {
      pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, scaledHeight);
    } else {
      let yOffset = 0;
      const pageContentHeight = pdfHeight - margin * 2;
      const sourcePageHeight = (pageContentHeight * imgWidth) / usableWidth;

      while (yOffset < imgHeight) {
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = imgWidth;
        cropCanvas.height = Math.min(sourcePageHeight, imgHeight - yOffset);
        const ctx = cropCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, -yOffset);
        const pageImg = cropCanvas.toDataURL('image/png');
        const cropScaledHeight = (cropCanvas.height * usableWidth) / imgWidth;

        if (yOffset > 0) pdf.addPage();
        pdf.addImage(pageImg, 'PNG', margin, margin, usableWidth, cropScaledHeight);
        yOffset += sourcePageHeight;
      }
    }

    pdf.save(`Relatorio_Diario_Pedreira_${activeDate.replace(/\//g, '-')}.pdf`);
  };




  // Don't render if no records at all
  if (records.length === 0 && !internalDate) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <CardTitle className="text-base font-medium">Relatório Diário — {activeDate}</CardTitle>
            {totalViagens > 0 && (
              <>
                <Badge variant="secondary">{totalViagens} viagens</Badge>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {availableDates.length > 0 && (
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={internalDate || selectedDate}
                  onValueChange={(v) => setInternalDate(v === selectedDate ? '' : v)}
                >
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue placeholder="Filtrar data" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDates.map(d => (
                      <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={whatsAppCompleto} size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
            <Button onClick={handleExportPDF} size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50">
              <FileDown className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-2">
        <PedreiraFilterBar
          records={baseRecordsForDate}
          filterMaterial={filterMaterial} setFilterMaterial={setFilterMaterial}
          filterFornecedor={filterFornecedor} setFilterFornecedor={setFilterFornecedor}
          filterEmpresa={filterEmpresa} setFilterEmpresa={setFilterEmpresa}
          filterVeiculo={filterVeiculo} setFilterVeiculo={setFilterVeiculo}
        />
      </CardContent>

      {totalViagens === 0 ? (
        <CardContent>
          <p className="text-center text-muted-foreground py-6 text-sm">Nenhum registro para a data selecionada.</p>
        </CardContent>
      ) : (
        <CardContent ref={reportRef} className="space-y-4">
          {/* Header com logo e dados da obra - visível apenas no PDF exportado */}
          <div className="bg-primary text-primary-foreground p-4 rounded-lg flex items-center gap-4 hidden print-header-pedreira">
            <img src={activeLogo} alt="Logo" className="h-14 w-auto object-contain bg-white/15 rounded-lg p-1" />
            <div className="flex-1">
              {obraConfig.nome && <p className="text-sm font-semibold opacity-90">{obraConfig.nome}</p>}
              {obraConfig.local && <p className="text-xs opacity-70">📍 {obraConfig.local}</p>}
              <h2 className="text-xl font-bold mt-0.5">⛰️ Relatório Diário — Pedreira</h2>
            </div>
            <div className="text-sm opacity-80 text-right shrink-0">
              📅 {activeDate}
            </div>
          </div>

          {/* KPI — Veículos ativos (excluindo Areia Express) */}
          {vehicleKpi.total > 0 && (
            <Card className="border-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <Truck className="w-5 h-5 text-slate-600 dark:text-slate-300 mb-1" />
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{vehicleKpi.total}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Veículos Ativos</p>
                <p className="text-[8px] text-slate-400 dark:text-slate-500">excl. Areia Express</p>
                <div className="flex items-center gap-4 mt-2 text-[10px]">
                  <span className="text-amber-600 dark:text-amber-400 font-medium">{vehicleKpi.basculante} Cam. Basculante</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">{vehicleKpi.reboque} Cam. Reboque</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resumo por Fornecedor — Cards separados */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {materialsByFornecedor.map((forn, fi) => {
              const colors = [
                { bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-500/10 text-orange-700 border-orange-300', subtotal: 'bg-orange-50/80 dark:bg-orange-950/50', icon: '🏭' },
                { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-500/10 text-blue-700 border-blue-300', subtotal: 'bg-blue-50/80 dark:bg-blue-950/50', icon: '🏗️' },
                { bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-500/10 text-green-700 border-green-300', subtotal: 'bg-green-50/80 dark:bg-green-950/50', icon: '🌿' },
                { bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-500/10 text-purple-700 border-purple-300', subtotal: 'bg-purple-50/80 dark:bg-purple-950/50', icon: '🔮' },
                { bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-500/10 text-amber-700 border-amber-300', subtotal: 'bg-amber-50/80 dark:bg-amber-950/50', icon: '⚡' },
              ];
              const c = colors[fi % colors.length];

              return (
                <Card key={forn.fornecedor} className={`border-2 ${c.border} overflow-hidden`}>
                  <CardHeader className={`py-3 px-4 ${c.bg} flex-row items-center justify-between space-y-0`}>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className={`w-4 h-4 ${c.text}`} />
                      {forn.fornecedor}
                    </CardTitle>
                     <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${c.badge}`}>{forn.totalViagens} viag.</Badge>
                      <Badge variant="outline" className={`text-[10px] font-bold ${c.badge}`}>{fmt(forn.totalToneladas)} t</Badge>
                    </div>
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
                            <TableCell className="py-1.5 text-right font-medium text-xs">{fmt(m.toneladas)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow className={c.subtotal}>
                           <TableCell className={`py-1.5 font-bold text-[10px] ${c.text}`}>SUBTOTAL</TableCell>
                          <TableCell className={`py-1.5 text-center font-bold text-[10px] ${c.text}`}>{forn.totalViagens}</TableCell>
                          <TableCell className={`py-1.5 text-right font-bold text-[10px] ${c.text}`}>{fmt(forn.totalToneladas)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Resumo Geral — Empresa */}
          <Card>
            <CardHeader className="py-2 px-4 bg-muted/30 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                Resumo por Empresa
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-green-600 hover:bg-green-50" onClick={whatsAppMaterial}>
                  <MessageCircle className="w-3 h-3 mr-0.5" />WA
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-orange-600 hover:bg-orange-50"
                  onClick={() => exportMiniPDF('RESUMO POR EMPRESA', '🏢',
                    ['Empresa', 'Viagens', 'Toneladas'],
                    empresaStats.map(e => [e.empresa, String(e.viagens), fmt(e.toneladas)]),
                    ['TOTAL', String(totalViagens), fmt(totalTon)])}>
                  <FileDown className="w-3 h-3 mr-0.5" />PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <SortableTableHead sortKey="empresa" sortConfig={empSort.sortConfig} onSort={empSort.requestSort} className="py-1 text-[11px]">Empresa</SortableTableHead>
                    <SortableTableHead sortKey="viagens" sortConfig={empSort.sortConfig} onSort={empSort.requestSort} className="py-1 text-[11px] text-center">Viagens</SortableTableHead>
                    <SortableTableHead sortKey="toneladas" sortConfig={empSort.sortConfig} onSort={empSort.requestSort} className="py-1 text-[11px] text-right">Toneladas</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empSort.sortedData.map((e, i) => (
                    <TableRow key={`emp-${i}`}>
                      <TableCell className="py-1 font-medium text-xs">{e.empresa}</TableCell>
                      <TableCell className="py-1 text-center">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{e.viagens}</Badge>
                      </TableCell>
                      <TableCell className="py-1 text-right font-medium text-xs">{fmt(e.toneladas)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="py-1 font-bold text-xs">TOTAL GERAL</TableCell>
                    <TableCell className="py-1 text-center font-bold text-xs">{totalViagens}</TableCell>
                    <TableCell className="py-1 text-right font-bold text-xs">{fmt(totalTon)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Controle de Peso (Chegada vs Final) */}
          {(() => {
            if (weightRecordsWithDif.length === 0) return null;
            const totalDif = weightRecordsWithDif.reduce((s, r) => s + r.diferenca, 0);
            return (
              <Card>
                <CardHeader className="py-3 px-5 bg-red-50 dark:bg-red-950">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="w-5 h-5 text-red-600" />
                    Controle de Peso — Diferença Saída × Chegada
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                      <SortableTableHead sortKey="prefixo" sortConfig={weightSort.sortConfig} onSort={weightSort.requestSort} className="py-2 text-sm">Prefixo</SortableTableHead>
                        <SortableTableHead sortKey="hora" sortConfig={weightSort.sortConfig} onSort={weightSort.requestSort} className="py-2 text-sm">Hora</SortableTableHead>
                        <SortableTableHead sortKey="material" sortConfig={weightSort.sortConfig} onSort={weightSort.requestSort} className="py-2 text-sm">Material</SortableTableHead>
                        <SortableTableHead sortKey="pesoFinal" sortConfig={weightSort.sortConfig} onSort={weightSort.requestSort} className="py-2 text-sm text-right">Peso Final (kg)</SortableTableHead>
                        <SortableTableHead sortKey="pesoChegada" sortConfig={weightSort.sortConfig} onSort={weightSort.requestSort} className="py-2 text-sm text-right">Peso Chegada (kg)</SortableTableHead>
                        <SortableTableHead sortKey="diferenca" sortConfig={weightSort.sortConfig} onSort={weightSort.requestSort} className="py-2 text-sm text-right">Diferença (kg)</SortableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weightSort.sortedData.map((r, i) => {
                        const dif = r.diferenca;
                        return (
                          <TableRow key={i}>
                            <TableCell className="py-2 font-semibold">{r.prefixo}</TableCell>
                            <TableCell className="py-2">{r.hora}</TableCell>
                            <TableCell className="py-2">{r.material}</TableCell>
                            <TableCell className="py-2 text-right">{fmt(r.pesoFinal || 0)}</TableCell>
                            <TableCell className="py-2 text-right">{fmt(r.pesoChegada || 0)}</TableCell>
                            <TableCell className={`py-2 text-right font-bold ${dif > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {dif > 0 ? '-' : '+'}{fmt(Math.abs(dif))}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={5} className="py-2 font-bold">TOTAL DIFERENÇA</TableCell>
                        <TableCell className={`py-2 text-right font-bold ${totalDif > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {totalDif > 0 ? '-' : '+'}{fmt(Math.abs(totalDif))}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}




          {/* Veículo — full width */}
          <Card>
            <CardHeader className="py-3 px-5 bg-primary/5">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Viagens por Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="prefixo" sortConfig={vehSort.sortConfig} onSort={vehSort.requestSort} className="py-3 text-base">Prefixo</SortableTableHead>
                    <SortableTableHead sortKey="motorista" sortConfig={vehSort.sortConfig} onSort={vehSort.requestSort} className="py-3 text-base">Motorista</SortableTableHead>
                    <SortableTableHead sortKey="empresa" sortConfig={vehSort.sortConfig} onSort={vehSort.requestSort} className="py-3 text-base">Empresa</SortableTableHead>
                    <TableHead className="py-3 text-base">Materiais</TableHead>
                    <SortableTableHead sortKey="viagens" sortConfig={vehSort.sortConfig} onSort={vehSort.requestSort} className="py-3 text-base text-center">Viagens</SortableTableHead>
                    <SortableTableHead sortKey="toneladas" sortConfig={vehSort.sortConfig} onSort={vehSort.requestSort} className="py-3 text-base text-right">Toneladas</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehSort.sortedData.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3 font-semibold text-lg">{v.prefixo}</TableCell>
                      <TableCell className="py-3 text-base">{v.motorista || '—'}</TableCell>
                      <TableCell className="py-3 text-base text-muted-foreground">{v.empresa}</TableCell>
                      <TableCell className="py-3 text-base text-muted-foreground">{v.materiais.join(', ')}</TableCell>
                      <TableCell className="py-3 text-center">
                        <Badge variant="secondary" className="text-base px-3">{v.viagens}</Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right text-lg font-medium">{fmt(v.toneladas)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="py-3 font-bold text-base">TOTAL</TableCell>
                    <TableCell className="py-3 text-center font-bold text-base">{totalViagens}</TableCell>
                    <TableCell className="py-3 text-right font-bold text-base">{fmt(totalTon)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </CardContent>
      )}
    </Card>
  );
}
