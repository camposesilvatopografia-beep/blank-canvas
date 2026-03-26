import { useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { FileDown, CalendarIcon, X, Building2, Loader2, Copy, MessageCircle, Send, Mountain } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PedreiraFilterBar } from '@/components/reports/PedreiraFilterBar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useObraConfig } from '@/hooks/useObraConfig';
import { useReportHeaderConfig } from '@/hooks/useReportHeaderConfig';
import { useToast } from '@/hooks/use-toast';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface FornecedorRecord {
  data: string;
  hora: string;
  ordem: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  fornecedor: string;
  material: string;
  pesoVazio: number;
  pesoFinal: number;
  tonelada: number;
  toneladaTicket?: number;
  toneladaCalcObra?: number;
}

interface RelatorioFornecedorPedreiraProps {
  records: FornecedorRecord[];
  dateRange: { start: string; end: string };
}

export function RelatorioFornecedorPedreira({ records, dateRange }: RelatorioFornecedorPedreiraProps) {
  const { obraConfig } = useObraConfig();
  const { config: hCfg, getHeaderCss } = useReportHeaderConfig('fornecedor_pedreira');
  const { toast } = useToast();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const tableRef = useRef<HTMLDivElement>(null);

  const [selectedFornecedor, setSelectedFornecedor] = useState<string>('todos');
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsAppObs, setWhatsAppObs] = useState('');
  const [exporting, setExporting] = useState(false);
  const [filterMaterial, setFilterMaterial] = useState<string[]>([]);
  const [filterFornecedorChip, setFilterFornecedorChip] = useState<string[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterVeiculo, setFilterVeiculo] = useState<string[]>([]);

  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    try {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    } catch { return null; }
  };

  const availableFornecedores = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.fornecedor) set.add(r.fornecedor); });
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let result = records;
    if (selectedFornecedor !== 'todos') {
      result = result.filter(r => r.fornecedor === selectedFornecedor);
    }
    if (filterStartDate || filterEndDate) {
      result = result.filter(r => {
        const d = parseDate(r.data);
        if (!d) return false;
        if (filterStartDate && d < filterStartDate) return false;
        if (filterEndDate && d > filterEndDate) return false;
        return true;
      });
    }
    result = result.filter(r => {
      if (filterMaterial.length > 0 && !filterMaterial.includes(r.material)) return false;
      if (filterFornecedorChip.length > 0 && !filterFornecedorChip.includes(r.fornecedor)) return false;
      if (filterEmpresa.length > 0 && !filterEmpresa.includes(r.empresa)) return false;
      if (filterVeiculo.length > 0 && !filterVeiculo.includes(r.prefixo)) return false;
      return true;
    });
    return result.sort((a, b) => {
      const da = parseDate(a.data);
      const db = parseDate(b.data);
      if (!da || !db) return 0;
      return db.getTime() - da.getTime();
    });
  }, [records, selectedFornecedor, filterStartDate, filterEndDate, filterMaterial, filterFornecedorChip, filterEmpresa, filterVeiculo]);

  const activeDateRange = useMemo(() => ({
    start: filterStartDate ? format(filterStartDate, 'dd/MM/yyyy') : dateRange.start,
    end: filterEndDate ? format(filterEndDate, 'dd/MM/yyyy') : dateRange.end,
  }), [filterStartDate, filterEndDate, dateRange]);

  const hasFilter = selectedFornecedor !== 'todos' || filterStartDate || filterEndDate;

  const clearFilters = () => {
    setSelectedFornecedor('todos');
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
  };

  const totalViagens = filteredRecords.length;
  const totalToneladas = filteredRecords.reduce((s, r) => s + (r.toneladaTicket || r.tonelada || 0), 0);
  const totalTonCalcObra = filteredRecords.reduce((s, r) => s + (r.toneladaCalcObra || 0), 0);
  const recsWithBoth = filteredRecords.filter(r => r.toneladaTicket && r.toneladaTicket > 0 && r.toneladaCalcObra && r.toneladaCalcObra > 0);
  const totalDif = recsWithBoth.reduce((s, r) => s + ((r.toneladaCalcObra || 0) - (r.toneladaTicket || 0)), 0);
  const totalVeiculos = new Set(filteredRecords.map(r => r.prefixo).filter(Boolean)).size;

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fornRecSort = useTableSort(filteredRecords);

  // WhatsApp message
  const generateMessage = () => {
    const label = activeDateRange.start === activeDateRange.end
      ? activeDateRange.start
      : `${activeDateRange.start} a ${activeDateRange.end}`;
    const fornLabel = selectedFornecedor !== 'todos' ? selectedFornecedor : 'Todos';
    let msg = `⛰️ *RELATÓRIO POR FORNECEDOR — PEDREIRA*\n`;
    msg += `📅 Período: ${label}\n`;
    msg += `🏭 Fornecedor: ${fornLabel}\n\n`;
    msg += `📊 *RESUMO*\n`;
    msg += `• Viagens: ${totalViagens}\n`;
    msg += `• Ton. Ticket: ${fmt(totalToneladas)}\n`;
    msg += `• Ton. Calc. Obra: ${fmt(totalTonCalcObra)}\n`;
    if (recsWithBoth.length > 0) msg += `• Diferença: ${totalDif >= 0 ? '+' : ''}${fmt(totalDif)} t\n`;
    msg += `\n📋 *DETALHAMENTO*\n`;
    filteredRecords.forEach((r, i) => {
      msg += `${i + 1}. ${r.data} | ${r.ordem || '—'} | ${r.prefixo} | ${fmt(r.toneladaTicket || r.tonelada)} t\n`;
    });
    if (whatsAppObs) msg += `\n📝 *Obs:* ${whatsAppObs}\n`;
    msg += `\n---\n_Enviado via ApropriAPP_`;
    return msg;
  };

  const sendWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(generateMessage())}`, '_blank');
    setShowWhatsApp(false);
    setWhatsAppObs('');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateMessage());
    toast({ title: 'Copiado!', description: 'Relatório copiado para a área de transferência.' });
  };

  // Helper: converts any img src to base64 data URL
  const toBase64 = (src: string): Promise<string> => {
    if (src.startsWith('data:')) return Promise.resolve(src);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  };

  // PDF Export
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const hc = getHeaderCss();
      const logoBase64 = await toBase64(activeLogo);

      const dateLabel = activeDateRange.start === activeDateRange.end
        ? activeDateRange.start
        : `${activeDateRange.start} a ${activeDateRange.end}`;
      const fornLabel = selectedFornecedor !== 'todos' ? selectedFornecedor : 'Todos os Fornecedores';

      const printContent = `<!DOCTYPE html><html><head>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { margin:0; padding:0; box-sizing:border-box; font-family:'Segoe UI',Arial,sans-serif; }
          body { padding:8px; font-size:9px; color:#1a1a2e; }

          .report-header {
            background: linear-gradient(135deg,#1d3557 0%,#264673 60%,#2a5a8a 100%);
            color:white; border-radius:8px; margin-bottom:12px; overflow:hidden;
            display:flex; align-items:center;
            padding: ${hc.headerPadding}; gap: ${hc.headerGap};
            box-shadow: 0 2px 8px rgba(0,0,0,.15);
          }
          .report-header img { height: ${hc.logoHeight}; border-radius:6px; background:rgba(255,255,255,.1); padding:3px; ${!hc.logoVisible ? 'display:none;' : ''} }
          .report-header .info { flex:1; }
          .report-header .info h1 { font-size: ${hc.titleFontSize}; font-weight:800; margin-bottom:2px; }
          .report-header .info p { font-size: ${hc.subtitleFontSize}; opacity:.85; }
          .report-header .date-block { text-align:right; }
          .report-header .date-block .badge { background:rgba(255,255,255,.15); padding:4px 12px; border-radius:20px; font-size:10px; display:inline-block; margin:2px 0; }

          .kpi-strip { display:flex; gap:12px; margin-bottom:14px; }
          .kpi-card { flex:1; padding:14px 12px; text-align:center; border-radius:8px; border:2px solid #e2e8f0; background:#fff; }
          .kpi-card .kpi-label { font-size:8px; text-transform:uppercase; letter-spacing:.6px; color:#64748b; font-weight:600; margin-top:4px; }
          .kpi-card .kpi-value { font-size:18px; font-weight:900; color:#0f172a; }
          .kpi-card .kpi-sub { font-size:7px; color:#94a3b8; margin-top:2px; }
          .kpi-card.border-blue { border-color:#93c5fd; }
          .kpi-card.border-green { border-color:#6ee7b7; }
          .kpi-card.border-red { border-color:#fca5a5; }
          .kpi-card.border-dark { border-color:#94a3b8; }

          table { width:100%; border-collapse:collapse; }
          thead th { background:#1d3557; color:white; padding:6px 5px; font-size:8px; text-align:center; font-weight:700; }
          thead th.col-ticket { background:#1e40af; }
          thead th.col-obra { background:#047857; }
          thead th.col-dif { background:#92400e; }
          tbody td { border-bottom:1px solid #e5e7eb; padding:4px 5px; text-align:center; font-size:8px; }
          tbody tr:nth-child(even) { background:#f1f5f9; }
          tbody tr:hover { background:#e2e8f0; }
          tfoot td { padding:8px 5px; font-weight:800; font-size:9px; border-top:2px solid #1d3557; background:#f8fafc; }

          .report-footer { text-align:center; margin-top:10px; font-size:7px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:6px; }
          @media print { body { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
        </style></head><body>

        <div class="report-header">
          ${hc.logoVisible ? `<img src="${logoBase64}" alt="Logo" />` : ''}
          <div class="info">
            <h1>⛰️ RELATÓRIO POR FORNECEDOR — PEDREIRA</h1>
            ${obraConfig.nome ? `<p>${obraConfig.nome}</p>` : ''}
            ${obraConfig.local ? `<p>📍 ${obraConfig.local}</p>` : ''}
          </div>
          <div class="date-block">
            <div class="badge">📅 ${dateLabel}</div>
            <div class="badge">🏭 ${fornLabel}</div>
          </div>
        </div>

        <div class="kpi-strip">
          <div class="kpi-card border-dark">
            <div class="kpi-value">${totalViagens}</div>
            <div class="kpi-label">Total Viagens</div>
          </div>
          <div class="kpi-card border-blue">
            <div class="kpi-value">${fmt(totalToneladas)} t</div>
            <div class="kpi-label">Ton. Ticket</div>
          </div>
          <div class="kpi-card border-green">
            <div class="kpi-value">${fmt(totalTonCalcObra)} t</div>
            <div class="kpi-label">Ton. Calc. Obra</div>
            <div class="kpi-sub">${dateLabel}</div>
          </div>
          <div class="kpi-card${recsWithBoth.length > 0 && totalDif < 0 ? ' border-red' : ''}">
            <div class="kpi-value" style="color:${recsWithBoth.length > 0 ? (totalDif >= 0 ? '#0f172a' : '#dc2626') : '#94a3b8'};">${recsWithBoth.length > 0 ? `${totalDif >= 0 ? '+' : ''}${fmt(totalDif)} t` : '—'}</div>
            <div class="kpi-label">Diferença</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">${totalVeiculos}</div>
            <div class="kpi-label">Veículos</div>
          </div>
        </div>

        <table>
          <thead><tr>
            <th>#</th>
            <th>Data</th>
            <th>Hora</th>
            <th>Nº OS</th>
            <th>Veículo</th>
            <th>Empresa</th>
            <th>Fornecedor</th>
            <th>Material</th>
            <th class="col-ticket">Ton. Ticket</th>
            <th class="col-obra">Ton. Calc. Obra</th>
            <th class="col-dif">Dif. (t)</th>
          </tr></thead>
          <tbody>
            ${filteredRecords.map((r, i) => {
              const ticket = r.toneladaTicket || r.tonelada || 0;
              const calcObra = r.toneladaCalcObra || 0;
              const hasBoth = ticket > 0 && calcObra > 0;
              const dif = hasBoth ? calcObra - ticket : null;
              return `<tr>
                <td>${i + 1}</td>
                <td>${r.data}</td>
                <td>${r.hora || '—'}</td>
                <td style="font-weight:600;">${r.ordem || '—'}</td>
                <td style="font-weight:700;">${r.prefixo}</td>
                <td style="text-align:left;padding-left:4px;font-size:7px;">${r.empresa || '—'}</td>
                <td style="text-align:left;padding-left:4px;font-size:7px;">${r.fornecedor || '—'}</td>
                <td style="text-align:left;padding-left:4px;font-size:7px;">${r.material || '—'}</td>
                <td style="font-weight:700;color:#1e40af;">${ticket > 0 ? fmt(ticket) : '—'}</td>
                <td style="font-weight:600;color:#047857;">${calcObra > 0 ? fmt(calcObra) : '—'}</td>
                <td style="font-weight:600;color:${dif !== null ? (dif >= 0 ? '#1e40af' : '#dc2626') : '#94a3b8'};">${dif !== null ? `${dif >= 0 ? '+' : ''}${fmt(dif)}` : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="8" style="text-align:right;padding-right:8px;">TOTAL</td>
              <td style="color:#1e40af;">${fmt(totalToneladas)}</td>
              <td style="color:#047857;">${fmt(totalTonCalcObra)}</td>
              <td style="color:${recsWithBoth.length > 0 ? (totalDif >= 0 ? '#1e40af' : '#dc2626') : '#94a3b8'};">${recsWithBoth.length > 0 ? `${totalDif >= 0 ? '+' : ''}${fmt(totalDif)}` : '—'}</td>
            </tr>
          </tfoot>
        </table>

        <div class="report-footer">
          <p>Gerado em ${new Date().toLocaleString('pt-BR')} • ${filteredRecords.length} registros • ApropriAPP — Gestão Inteligente</p>
        </div>
      </body></html>`;

      const w = window.open('', '_blank');
      if (w) { w.document.write(printContent); w.document.close(); setTimeout(() => w.print(), 400); }
    } catch (err) {
      console.error('PDF export error:', err);
      toast({ title: 'Erro', description: 'Falha ao gerar PDF', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Fornecedores</SelectItem>
                  {availableFornecedores.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", filterStartDate && "border-primary text-primary")}>
                    <CalendarIcon className="w-3 h-3" />
                    {filterStartDate ? format(filterStartDate, 'dd/MM/yyyy') : 'Data Início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filterStartDate} onSelect={setFilterStartDate} locale={ptBR} />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">→</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1", filterEndDate && "border-primary text-primary")}>
                    <CalendarIcon className="w-3 h-3" />
                    {filterEndDate ? format(filterEndDate, 'dd/MM/yyyy') : 'Data Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={filterEndDate} onSelect={setFilterEndDate} locale={ptBR} />
                </PopoverContent>
              </Popover>
            </div>

            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1 text-destructive">
                <X className="w-3 h-3" /> Limpar
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard} className="h-8 text-xs gap-1">
                <Copy className="w-3.5 h-3.5" /> Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowWhatsApp(true)} className="h-8 text-xs gap-1 border-green-200 hover:bg-green-50">
                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                <span className="text-green-700">WhatsApp</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="h-8 text-xs gap-1 border-red-200 hover:bg-red-50">
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-red-600" />}
                <span className="text-red-700">PDF</span>
              </Button>
            </div>
          </div>

          {hasFilter && (
            <div className="flex items-center gap-2 mt-2">
              {selectedFornecedor !== 'todos' && (
                <Badge variant="secondary" className="text-xs">🏭 {selectedFornecedor}</Badge>
              )}
              {filterStartDate && (
                <Badge variant="secondary" className="text-xs">De: {format(filterStartDate, 'dd/MM/yyyy')}</Badge>
              )}
              {filterEndDate && (
                <Badge variant="secondary" className="text-xs">Até: {format(filterEndDate, 'dd/MM/yyyy')}</Badge>
              )}
              <Badge variant="outline" className="text-xs">{totalViagens} registros</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter chips */}
      <PedreiraFilterBar
        records={records as any}
        filterMaterial={filterMaterial} setFilterMaterial={setFilterMaterial}
        filterFornecedor={filterFornecedorChip} setFilterFornecedor={setFilterFornecedorChip}
        filterEmpresa={filterEmpresa} setFilterEmpresa={setFilterEmpresa}
        filterVeiculo={filterVeiculo} setFilterVeiculo={setFilterVeiculo}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-2 border-foreground/20 shadow-sm">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <p className="text-2xl font-extrabold text-foreground">{totalViagens}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Total Viagens</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-300 dark:border-blue-700 shadow-sm">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <p className="text-2xl font-extrabold text-foreground">{fmt(totalToneladas)} t</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Ton. Ticket</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-300 dark:border-emerald-700 shadow-sm">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <p className="text-2xl font-extrabold text-foreground">{fmt(totalTonCalcObra)} t</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Ton. Calc. Obra</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{activeDateRange.start === activeDateRange.end ? activeDateRange.start : `${activeDateRange.start} a ${activeDateRange.end}`}</p>
          </CardContent>
        </Card>
        <Card className={`border-2 shadow-sm ${recsWithBoth.length > 0 && totalDif < 0 ? 'border-red-300 dark:border-red-700' : 'border-foreground/10'}`}>
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <p className={`text-2xl font-extrabold ${recsWithBoth.length > 0 ? (totalDif >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400') : 'text-muted-foreground'}`}>
              {recsWithBoth.length > 0 ? `${totalDif >= 0 ? '+' : ''}${fmt(totalDif)} t` : '—'}
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Diferença</p>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <p className="text-2xl font-extrabold text-foreground">{totalVeiculos}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1">Veículos</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="bg-[#1d3557] px-4 py-3 flex items-center gap-2">
          <Mountain className="w-4 h-4 text-white/80" />
          <span className="text-white font-semibold text-sm">
            Detalhamento — {activeDateRange.start === activeDateRange.end ? activeDateRange.start : `${activeDateRange.start} a ${activeDateRange.end}`}
          </span>
          <Badge variant="secondary" className="ml-auto text-[10px] bg-white/15 text-white border-0">{filteredRecords.length} registros</Badge>
        </div>
        <CardContent className="p-0" ref={tableRef}>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap text-center">#</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Data</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Hora</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Nº OS</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Veículo</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Empresa</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Fornecedor</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Material</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap text-right">Ton. Ticket</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap text-right">Ton. Calc. Obra</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap text-right">Dif. (t)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornRecSort.sortedData.map((r, i) => {
                  const ticket = r.toneladaTicket || r.tonelada || 0;
                  const calcObra = r.toneladaCalcObra || 0;
                  const hasBoth = ticket > 0 && calcObra > 0;
                  const dif = hasBoth ? calcObra - ticket : null;
                  return (
                    <TableRow key={`${r.data}-${r.ordem}-${i}`} className="hover:bg-muted/30">
                      <TableCell className="text-xs px-2 py-1.5 text-center text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap">{r.data}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap text-amber-600 font-medium">{r.hora || '—'}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap font-semibold">{r.ordem || '—'}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap text-orange-600 font-semibold">{r.prefixo}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 truncate max-w-[120px]">{r.empresa || '—'}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 truncate max-w-[120px]">{r.fornecedor || '—'}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap">{r.material || '—'}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 text-right font-bold text-blue-600">{ticket > 0 ? fmt(ticket) : '—'}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 text-right font-semibold text-emerald-600">{calcObra > 0 ? fmt(calcObra) : '—'}</TableCell>
                      <TableCell className={`text-xs px-2 py-1.5 text-right font-semibold ${dif !== null ? (dif >= 0 ? 'text-blue-600' : 'text-red-600') : 'text-muted-foreground'}`}>
                        {dif !== null ? fmt(dif) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {filteredRecords.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-foreground/20 bg-muted/40">
                    <td className="py-2 px-2 text-xs font-extrabold text-right" colSpan={8}>TOTAL</td>
                    <td className="py-2 px-2 text-xs text-right font-extrabold text-blue-600">{fmt(totalToneladas)}</td>
                    <td className="py-2 px-2 text-xs text-right font-extrabold text-emerald-600">{fmt(totalTonCalcObra)}</td>
                    <td className={`py-2 px-2 text-xs text-right font-extrabold ${recsWithBoth.length > 0 ? (totalDif >= 0 ? 'text-blue-600' : 'text-red-600') : 'text-muted-foreground'}`}>
                      {recsWithBoth.length > 0 ? fmt(totalDif) : '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Modal */}
      <Dialog open={showWhatsApp} onOpenChange={setShowWhatsApp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Enviar via WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {totalViagens} registros • {fmt(totalToneladas)} toneladas
              {selectedFornecedor !== 'todos' && ` • ${selectedFornecedor}`}
            </div>
            <Textarea
              placeholder="Observações (opcional)"
              value={whatsAppObs}
              onChange={e => setWhatsAppObs(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsApp(false)}>Cancelar</Button>
            <Button onClick={sendWhatsApp} className="bg-green-600 hover:bg-green-700 gap-1">
              <Send className="w-4 h-4" /> Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
