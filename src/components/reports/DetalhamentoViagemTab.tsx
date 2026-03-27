import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, ClipboardList, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PedreiraFilterBar } from '@/components/reports/PedreiraFilterBar';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

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
  toneladaTicket?: number;
  toneladaCalcObra?: number;
  pesoVazioObra?: number;
}

interface DetalhamentoViagemTabProps {
  records: DayRecord[];
  selectedDate: string;
  allRecords?: DayRecord[];
  availableDates?: string[];
}

export function DetalhamentoViagemTab({
  records,
  selectedDate,
  allRecords,
  availableDates = [],
}: DetalhamentoViagemTabProps) {
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [internalDate, setInternalDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'hora' | 'veiculo' | 'material' | 'fornecedor' | 'tonelada' | 'ordem'>('ordem');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterMaterial, setFilterMaterial] = useState<string[]>([]);
  const [filterFornecedor, setFilterFornecedor] = useState<string[]>([]);
  const [filterEmpresa, setFilterEmpresa] = useState<string[]>([]);
  const [filterVeiculo, setFilterVeiculo] = useState<string[]>([]);

  const toBase64 = useCallback((src: string): Promise<string> => {
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
  }, []);

  const baseRecords = useMemo(() => {
    if (internalDate && allRecords) {
      return allRecords.filter(r => r.data === internalDate);
    }
    return records;
  }, [internalDate, allRecords, records]);

  // Apply filters
  const activeRecords = useMemo(() => {
    return baseRecords.filter(r => {
      if (filterMaterial.length > 0 && !filterMaterial.includes(r.material)) return false;
      if (filterFornecedor.length > 0 && !filterFornecedor.includes(r.fornecedor)) return false;
      if (filterEmpresa.length > 0 && !filterEmpresa.includes(r.empresa)) return false;
      if (filterVeiculo.length > 0 && !filterVeiculo.includes(r.prefixo)) return false;
      return true;
    });
  }, [baseRecords, filterMaterial, filterFornecedor, filterEmpresa, filterVeiculo]);

  const activeDate = internalDate || selectedDate;
  const hasActiveFilters = filterMaterial.length + filterFornecedor.length + filterEmpresa.length + filterVeiculo.length > 0;
  const clearAllFilters = () => { setFilterMaterial([]); setFilterFornecedor([]); setFilterEmpresa([]); setFilterVeiculo([]); };
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalViagens = activeRecords.length;
  const totalTon = activeRecords.reduce((s, r) => s + r.tonelada, 0);

  const sortedRecords = useMemo(() => {
    const arr = [...activeRecords];
    const dir = sortAsc ? 1 : -1;
    const byHora = (a: DayRecord, b: DayRecord) => (a.hora || '').localeCompare(b.hora || '') * dir;
    switch (sortBy) {
      case 'ordem':
        arr.sort((a, b) => {
          const oa = parseInt(a.ordem) || 0;
          const ob = parseInt(b.ordem) || 0;
          return (oa - ob) * dir || byHora(a, b);
        });
        break;
      case 'veiculo':
        arr.sort((a, b) => (a.prefixo || '').localeCompare(b.prefixo || '') * dir || byHora(a, b));
        break;
      case 'material':
        arr.sort((a, b) => (a.material || '').localeCompare(b.material || '') * dir || byHora(a, b));
        break;
      case 'fornecedor':
        arr.sort((a, b) => (a.fornecedor || '').localeCompare(b.fornecedor || '') * dir || byHora(a, b));
        break;
      case 'tonelada':
        arr.sort((a, b) => (b.tonelada - a.tonelada) * dir || byHora(a, b));
        break;
      default:
        arr.sort(byHora);
    }
    return arr;
  }, [activeRecords, sortBy, sortAsc]);

  // Material + Fornecedor summary for day
  const materialStats = useMemo(() => {
    const matMap = new Map<string, { material: string; fornecedor: string; viagens: number; toneladas: number }>();
    activeRecords.forEach(r => {
      const mat = r.material || 'Outros';
      const forn = r.fornecedor || 'Sem Fornecedor';
      const k = `${mat}|${forn}`;
      if (!matMap.has(k)) matMap.set(k, { material: mat, fornecedor: forn, viagens: 0, toneladas: 0 });
      const v = matMap.get(k)!;
      v.viagens += 1;
      v.toneladas += r.tonelada;
    });
    return Array.from(matMap.values())
      .sort((a, b) => a.material.localeCompare(b.material) || a.fornecedor.localeCompare(b.fornecedor));
  }, [activeRecords]);

  // Vehicle stats
  const vehicleStats = useMemo(() => {
    const vehicleMap = new Map<string, { empresa: string; viagens: number; toneladas: number; materiais: Set<string> }>();
    activeRecords.forEach(r => {
      const k = r.prefixo || 'Sem Prefixo';
      if (!vehicleMap.has(k)) vehicleMap.set(k, { empresa: r.empresa, viagens: 0, toneladas: 0, materiais: new Set() });
      const v = vehicleMap.get(k)!;
      v.viagens += 1;
      v.toneladas += r.tonelada;
      if (r.material) v.materiais.add(r.material);
    });
    return Array.from(vehicleMap.entries())
      .map(([prefixo, v]) => ({ prefixo, ...v, materiais: Array.from(v.materiais) }))
      .sort((a, b) => b.viagens - a.viagens);
  }, [activeRecords]);
  const detMatSort = useTableSort(materialStats);
  const detVehSort = useTableSort(vehicleStats);

  const handleExportPDF = async () => {
    // Use filtered records for PDF
    const periodRecords = hasActiveFilters ? activeRecords : (allRecords || records);
    const periodMatMap = new Map<string, { material: string; fornecedor: string; viagens: number; toneladas: number }>();
    periodRecords.forEach(r => {
      const mat = r.material || 'Outros';
      const forn = r.fornecedor || 'Sem Fornecedor';
      const k = `${mat}|${forn}`;
      if (!periodMatMap.has(k)) periodMatMap.set(k, { material: mat, fornecedor: forn, viagens: 0, toneladas: 0 });
      const v = periodMatMap.get(k)!;
      v.viagens += 1;
      v.toneladas += r.tonelada;
    });
    const periodMats = Array.from(periodMatMap.values()).sort((a, b) => a.material.localeCompare(b.material) || a.fornecedor.localeCompare(b.fornecedor));
    const periodTotalViagens = periodRecords.length;
    const periodTotalTon = periodRecords.reduce((s, r) => s + r.tonelada, 0);

    const allDates = [...new Set(periodRecords.map(r => r.data || activeDate))].sort();
    const periodStart = allDates[0] || activeDate;
    const periodEnd = allDates[allDates.length - 1] || activeDate;

    const allMaterials = [...new Set(activeRecords.map(r => r.material || 'Outros'))].sort();

    const vehicleCross = vehicleStats.map(v => {
      const matCounts: Record<string, number> = {};
      allMaterials.forEach(m => { matCounts[m] = 0; });
      activeRecords.filter(r => r.prefixo === v.prefixo).forEach(r => {
        const mk = r.material || 'Outros';
        matCounts[mk] = (matCounts[mk] || 0) + 1;
      });
      return { prefixo: v.prefixo, empresa: v.empresa, matCounts, totalViagens: v.viagens, totalTon: v.toneladas };
    });

    let logoB64 = '';
    try { logoB64 = await toBase64(activeLogo); } catch { /* */ }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <title>Relatório de Carregamento — ${activeDate}</title>
      <style>
        @page{size:A4 portrait;margin:8mm 10mm}
        *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif}
        body{font-size:10px;color:#1a1a2e;background:#fff}
        .header{background:linear-gradient(135deg,#1d3557,#264b78);color:#fff;padding:12px 16px;display:flex;align-items:center;gap:12px;border-radius:6px;margin-bottom:6px}
        .header img{height:45px;border-radius:5px;background:rgba(255,255,255,0.12);padding:3px}
        .header .title{flex:1}
        .header h1{font-size:14px;font-weight:800;letter-spacing:0.3px}
        .header p{font-size:9px;opacity:.85;margin-top:1px}
        .period-badge{background:#1d3557;color:#fff;padding:4px 10px;border-radius:4px;font-size:8.5px;margin-bottom:6px;display:inline-block}
        .two-col{display:grid;grid-template-columns:1.4fr 1fr;gap:6px;margin-bottom:6px}
        .section{border:1px solid #d1d5db;border-radius:5px;overflow:hidden;margin-bottom:6px}
        .section-hd{background:linear-gradient(135deg,#c2410c,#f97316);color:#fff;padding:5px 10px;font-weight:700;font-size:11px}
        .section-hd-blue{background:linear-gradient(135deg,#1d3557,#264b78);color:#fff;padding:5px 10px;font-weight:700;font-size:11px}
        table{width:100%;border-collapse:collapse}
        th{background:#f3f4f6;color:#374151;padding:4px 6px;text-align:center;font-size:9px;font-weight:700;border-bottom:1px solid #d1d5db}
        td{border-bottom:1px solid #f0f0f0;padding:3px 5px;font-size:9.5px;color:#374151;text-align:center;line-height:1.35}
        tr:nth-child(even) td{background:#fafafa}
        tfoot td{background:#fff7ed!important;font-weight:700;border-top:2px solid #ea580c;color:#7c2d12;font-size:9.5px;text-align:center}
        .text-right{text-align:right}.text-center{text-align:center}.bold{font-weight:700}
        .em-dash{color:#bbb}
        .highlight-col{background:#fff7ed!important}
        .ft{text-align:center;font-size:7.5px;color:#9ca3af;margin-top:6px;padding-top:4px;border-top:1px solid #e5e7eb}
        @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style></head><body>

      <div class="header">
        ${logoB64 ? `<img src="${logoB64}" alt="Logo"/>` : ''}
        <div class="title">
          ${obraConfig.nome ? `<p style="font-size:11px;font-weight:600">${obraConfig.nome}</p>` : ''}
          ${obraConfig.local ? `<p>📍 ${obraConfig.local}</p>` : ''}
          <h1>RELATÓRIO DE CARREGAMENTO</h1>
        </div>
      </div>
      ${hasActiveFilters ? `<div class="period-badge" style="background:#c2410c">🔍 Filtros: ${filterMaterial.length ? 'Material: ' + filterMaterial.join(', ') + ' | ' : ''}${filterFornecedor.length ? 'Fornecedor: ' + filterFornecedor.join(', ') + ' | ' : ''}${filterEmpresa.length ? 'Empresa: ' + filterEmpresa.join(', ') + ' | ' : ''}${filterVeiculo.length ? 'Veículo: ' + filterVeiculo.join(', ') : ''}</div>` : ''}
      <div class="period-badge">📅 Período: ${periodStart} — ${periodEnd}</div>

      <div class="two-col">
        <div class="section">
          <div class="section-hd-blue">📊 Resumo Acumulado Geral (${periodStart} — ${periodEnd})</div>
          <table>
            <thead><tr><th>Material</th><th>Fornecedor</th><th class="text-center">Total de Viagens</th><th class="text-right">Total em Toneladas</th></tr></thead>
            <tbody>${periodMats.map(m => `<tr><td>${m.material}</td><td>${m.fornecedor}</td><td class="text-center">${m.viagens}</td><td class="text-right">${fmt(m.toneladas)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2" class="bold">Total geral</td><td class="text-center bold">${periodTotalViagens}</td><td class="text-right bold">${fmt(periodTotalTon)}</td></tr></tfoot>
          </table>
        </div>
        <div class="section">
          <div class="section-hd">📋 Resumo do Dia (${activeDate})</div>
          <table>
            <thead><tr><th class="orange-bg">Material</th><th class="orange-bg">Fornecedor</th><th class="orange-bg text-center">Viagens</th><th class="orange-bg text-right">Toneladas</th></tr></thead>
            <tbody>${materialStats.map(m => `<tr><td>${m.material}</td><td>${m.fornecedor}</td><td class="text-center">${m.viagens}</td><td class="text-right">${fmt(m.toneladas)}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2" class="bold">Total do dia</td><td class="text-center bold">${totalViagens}</td><td class="text-right bold">${fmt(totalTon)}</td></tr></tfoot>
          </table>
        </div>
      </div>


      <div class="section">
        <div class="section-hd">🚛 Detalhamento por Veículo e Material — ${activeDate}</div>
        <table>
          <thead><tr><th>#</th><th>Veículo</th><th>Empresa</th>
            ${allMaterials.map(m => `<th class="text-center">${m}</th>`).join('')}
            <th class="text-center highlight-col">Total Viagens</th><th class="text-right highlight-col">Total (ton)</th>
          </tr></thead>
          <tbody>${vehicleCross.map((v, i) => `<tr><td>${i + 1}.</td><td class="bold">${v.prefixo}</td><td>${v.empresa}</td>
            ${allMaterials.map(m => `<td class="text-center">${v.matCounts[m] > 0 ? v.matCounts[m] : '<span class="em-dash">—</span>'}</td>`).join('')}
            <td class="text-center highlight-col bold">${v.totalViagens}</td><td class="text-right highlight-col bold">${fmt(v.totalTon)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3" class="bold">TOTAL</td>
            ${allMaterials.map(m => { const ct = vehicleCross.reduce((s, v) => s + (v.matCounts[m] || 0), 0); return `<td class="text-center bold">${ct}</td>`; }).join('')}
            <td class="text-center highlight-col bold">${totalViagens}</td><td class="text-right highlight-col bold">${fmt(totalTon)}</td></tr></tfoot>
        </table>
      </div>

      <div class="section" style="page-break-before:auto">
        <div class="section-hd">📋 Detalhamento por Viagem — ${activeDate} (${{ ordem: 'por Nº OS', hora: 'por Hora', veiculo: 'por Veículo', material: 'por Material', fornecedor: 'por Fornecedor', tonelada: 'por Tonelada' }[sortBy]})</div>
        <table>
          <thead><tr>
            <th>Data</th><th>Hora</th><th>Prefixo</th>
            <th>Fornecedor</th><th>Nº Pedido/Nota</th><th>Descrição</th>
            <th>Material</th>
            <th class="text-right">Peso Ped. (t)</th>
            <th class="text-right">Peso Cheg. (kg)</th>
            <th class="text-right">Ton. Obra (t)</th>
            <th class="text-right">Dif. (t)</th>
          </tr></thead>
          <tbody>${sortedRecords.map(r => `<tr>
            <td>${r.data || activeDate}</td><td>${r.hora}</td><td class="bold" style="color:#c2410c">${r.prefixo}</td>
            <td>${r.fornecedor}</td><td>${r.ordem || '—'}</td><td>${r.descricao}</td>
            <td>${r.material}</td><td class="text-right bold">${fmt(r.tonelada)}</td>
          </tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="7" class="bold">TOTAL</td><td class="text-right bold">${fmt(totalTon)}</td></tr></tfoot>
        </table>
      </div>

      <div class="ft">Gerado em ${new Date().toLocaleString('pt-BR')} • ApropriAPP — Gestão Inteligente</div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  if (records.length === 0 && !internalDate) return null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-600" />
          <h3 className="text-base font-semibold">Detalhamento por Viagem — {activeDate}</h3>
          {totalViagens > 0 && (
            <>
              <Badge variant="secondary">{totalViagens} viagens</Badge>
              <Badge variant="outline" className="text-orange-600 border-orange-300">{fmt(totalTon)} t</Badge>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ordem" className="text-xs">Por Nº OS</SelectItem>
              <SelectItem value="hora" className="text-xs">Por Hora</SelectItem>
              <SelectItem value="veiculo" className="text-xs">Por Veículo</SelectItem>
              <SelectItem value="material" className="text-xs">Por Material</SelectItem>
              <SelectItem value="fornecedor" className="text-xs">Por Fornecedor</SelectItem>
              <SelectItem value="tonelada" className="text-xs">Por Tonelada</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => setSortAsc(prev => !prev)}
            title={sortAsc ? 'Crescente' : 'Decrescente'}
          >
            {sortAsc ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
          </Button>
          <Button onClick={handleExportPDF} size="sm" variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50">
            <FileDown className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <PedreiraFilterBar
        records={baseRecords}
        filterMaterial={filterMaterial} setFilterMaterial={setFilterMaterial}
        filterFornecedor={filterFornecedor} setFilterFornecedor={setFilterFornecedor}
        filterEmpresa={filterEmpresa} setFilterEmpresa={setFilterEmpresa}
        filterVeiculo={filterVeiculo} setFilterVeiculo={setFilterVeiculo}
      />

      {totalViagens === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground text-sm">Nenhum registro para a data selecionada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground font-medium">Total de Viagens</p>
                <p className="text-2xl font-bold text-blue-700">{totalViagens}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground font-medium">Total em Toneladas</p>
                <p className="text-2xl font-bold text-orange-700">{fmt(totalTon)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground font-medium">Média por Viagem</p>
                <p className="text-2xl font-bold text-emerald-700">{totalViagens > 0 ? fmt(totalTon / totalViagens) : '0,00'} t</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground font-medium">Veículos / Materiais</p>
                <p className="text-2xl font-bold text-purple-700">{vehicleStats.length} <span className="text-sm font-normal text-muted-foreground">/ {materialStats.length}</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Resumo do dia por material */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="py-3 px-5 bg-primary/5 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">📋 Resumo do Dia — {activeDate}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                 <Table>
                  <TableHeader>
                    <TableRow>
                     <SortableTableHead sortKey="material" sortConfig={detMatSort.sortConfig} onSort={detMatSort.requestSort} className="py-2 text-xs font-bold">Material</SortableTableHead>
                      <SortableTableHead sortKey="fornecedor" sortConfig={detMatSort.sortConfig} onSort={detMatSort.requestSort} className="py-2 text-xs font-bold">Fornecedor</SortableTableHead>
                      <SortableTableHead sortKey="viagens" sortConfig={detMatSort.sortConfig} onSort={detMatSort.requestSort} className="py-2 text-xs font-bold text-center">Viagens</SortableTableHead>
                      <TableHead className="py-2 text-xs font-bold text-center">%</TableHead>
                      <SortableTableHead sortKey="toneladas" sortConfig={detMatSort.sortConfig} onSort={detMatSort.requestSort} className="py-2 text-xs font-bold text-right">Toneladas</SortableTableHead>
                      <TableHead className="py-2 text-xs font-bold text-right">%</TableHead>
                      <TableHead className="py-2 text-xs font-bold text-right">Média (t)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detMatSort.sortedData.map((m, i) => (
                      <TableRow key={i} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                        <TableCell className="py-1.5 text-sm font-medium">{m.material}</TableCell>
                        <TableCell className="py-1.5 text-sm text-muted-foreground">{m.fornecedor}</TableCell>
                        <TableCell className="py-1.5 text-sm text-center">{m.viagens}</TableCell>
                        <TableCell className="py-1.5 text-xs text-center text-muted-foreground">{totalViagens > 0 ? fmt((m.viagens / totalViagens) * 100) : '0'}%</TableCell>
                        <TableCell className="py-1.5 text-sm text-right font-medium">{fmt(m.toneladas)}</TableCell>
                        <TableCell className="py-1.5 text-xs text-right text-muted-foreground">{totalTon > 0 ? fmt((m.toneladas / totalTon) * 100) : '0'}%</TableCell>
                        <TableCell className="py-1.5 text-sm text-right">{m.viagens > 0 ? fmt(m.toneladas / m.viagens) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="py-2 font-bold text-sm">Total do dia</TableCell>
                      <TableCell className="py-2 font-bold text-sm text-center">{totalViagens}</TableCell>
                      <TableCell className="py-2 font-bold text-xs text-center">100%</TableCell>
                      <TableCell className="py-2 font-bold text-sm text-right">{fmt(totalTon)}</TableCell>
                      <TableCell className="py-2 font-bold text-xs text-right">100%</TableCell>
                      <TableCell className="py-2 font-bold text-sm text-right">{totalViagens > 0 ? fmt(totalTon / totalViagens) : '—'}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 px-5 bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-800">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-700 dark:text-orange-300">🚛 Veículos × Material — {activeDate}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead sortKey="prefixo" sortConfig={detVehSort.sortConfig} onSort={detVehSort.requestSort} className="py-2 text-xs font-bold">Veículo</SortableTableHead>
                      <SortableTableHead sortKey="empresa" sortConfig={detVehSort.sortConfig} onSort={detVehSort.requestSort} className="py-2 text-xs font-bold">Empresa</SortableTableHead>
                      <SortableTableHead sortKey="viagens" sortConfig={detVehSort.sortConfig} onSort={detVehSort.requestSort} className="py-2 text-xs font-bold text-center">Viagens</SortableTableHead>
                      <TableHead className="py-2 text-xs font-bold text-center">%</TableHead>
                      <SortableTableHead sortKey="toneladas" sortConfig={detVehSort.sortConfig} onSort={detVehSort.requestSort} className="py-2 text-xs font-bold text-right">Toneladas</SortableTableHead>
                      <TableHead className="py-2 text-xs font-bold text-right">Média (t)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detVehSort.sortedData.map((v, i) => (
                      <TableRow key={i} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                        <TableCell className="py-1.5 text-sm font-semibold text-orange-700">{v.prefixo}</TableCell>
                        <TableCell className="py-1.5 text-sm text-muted-foreground">{v.empresa}</TableCell>
                        <TableCell className="py-1.5 text-sm text-center">{v.viagens}</TableCell>
                        <TableCell className="py-1.5 text-xs text-center text-muted-foreground">{totalViagens > 0 ? fmt((v.viagens / totalViagens) * 100) : '0'}%</TableCell>
                        <TableCell className="py-1.5 text-sm text-right font-medium">{fmt(v.toneladas)}</TableCell>
                        <TableCell className="py-1.5 text-sm text-right">{v.viagens > 0 ? fmt(v.toneladas / v.viagens) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2} className="py-2 font-bold text-sm">TOTAL</TableCell>
                      <TableCell className="py-2 font-bold text-sm text-center">{totalViagens}</TableCell>
                      <TableCell className="py-2 font-bold text-xs text-center">100%</TableCell>
                      <TableCell className="py-2 font-bold text-sm text-right">{fmt(totalTon)}</TableCell>
                      <TableCell className="py-2 font-bold text-sm text-right">{totalViagens > 0 ? fmt(totalTon / totalViagens) : '—'}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Trip detail table */}
          <Card className="border overflow-hidden">
            <CardHeader className="py-3 px-5 bg-muted/50 border-b">
              <CardTitle className="text-sm flex items-center gap-2 font-semibold">
                <ClipboardList className="w-4 h-4" />
                Detalhamento por Viagem — {activeDate}
                <Badge variant="secondary" className="ml-auto text-xs">{sortedRecords.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2 text-xs font-bold w-8 text-center">#</TableHead>
                    <TableHead className="py-2 text-xs font-bold cursor-pointer hover:text-primary select-none" onClick={() => setSortBy('hora')}>
                      Data {sortBy === 'hora' && '▾'}
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold cursor-pointer hover:text-primary select-none" onClick={() => setSortBy('hora')}>
                      Hora {sortBy === 'hora' && '▾'}
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold cursor-pointer hover:text-primary select-none" onClick={() => setSortBy('ordem')}>
                      Nº OS {sortBy === 'ordem' && '▾'}
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold cursor-pointer hover:text-primary select-none" onClick={() => setSortBy('veiculo')}>
                      Veículo {sortBy === 'veiculo' && '▾'}
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold cursor-pointer hover:text-primary select-none" onClick={() => setSortBy('fornecedor')}>
                      Fornecedor {sortBy === 'fornecedor' && '▾'}
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold">Descrição</TableHead>
                    <TableHead className="py-2 text-xs font-bold cursor-pointer hover:text-primary select-none" onClick={() => setSortBy('material')}>
                      Material {sortBy === 'material' && '▾'}
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold text-right cursor-pointer hover:text-primary select-none bg-amber-50/50" onClick={() => setSortBy('tonelada')}>
                      Ton. Ped. (t) {sortBy === 'tonelada' && '▾'}
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold text-right bg-blue-50/50">
                      P. Chegada (kg)
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold text-right bg-blue-50/50">
                      Ton. Obra (t)
                    </TableHead>
                    <TableHead className="py-2 text-xs font-bold text-right">
                      Dif. (t)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRecords.map((r, i) => (
                    <TableRow key={i} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                      <TableCell className="py-1.5 text-xs text-center text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="py-1.5 text-sm">{r.data || activeDate}</TableCell>
                      <TableCell className="py-1.5 text-sm">{r.hora}</TableCell>
                      <TableCell className="py-1.5 text-sm font-medium">{r.ordem || '—'}</TableCell>
                      <TableCell className="py-1.5 text-sm font-semibold text-orange-700">{r.prefixo}</TableCell>
                      <TableCell className="py-1.5 text-sm">{r.fornecedor}</TableCell>
                      <TableCell className="py-1.5 text-sm">{r.descricao}</TableCell>
                      <TableCell className="py-1.5 text-sm">{r.material}</TableCell>
                      <TableCell className="py-1.5 text-sm text-right font-medium bg-amber-50/20">{fmt(r.tonelada)}</TableCell>
                      <TableCell className="py-1.5 text-sm text-right bg-blue-50/20">{r.pesoChegada && r.pesoChegada > 0 ? r.pesoChegada.toLocaleString('pt-BR') : '—'}</TableCell>
                      <TableCell className="py-1.5 text-sm text-right font-medium bg-blue-50/20">{r.toneladaCalcObra && r.toneladaCalcObra > 0 ? fmt(r.toneladaCalcObra) : '—'}</TableCell>
                      <TableCell className="py-1.5 text-sm text-right">
                        {r.toneladaCalcObra && r.toneladaCalcObra > 0 ? (() => {
                          const dif = r.toneladaCalcObra - r.tonelada;
                          if (Math.abs(dif) < 0.0005) return <span className="text-muted-foreground">—</span>;
                          return <span className={dif > 0 ? 'text-blue-600 font-bold' : 'text-red-600 font-bold'}>
                            {dif > 0 ? '+' : ''}{fmt(dif)}
                          </span>;
                        })() : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="py-2 font-bold text-sm"></TableCell>
                    <TableCell colSpan={2} className="py-2 font-bold text-sm">Total geral</TableCell>
                    <TableCell colSpan={5} className="py-2 font-bold text-sm">{totalViagens} viagens</TableCell>
                    <TableCell className="py-2 text-right font-bold text-sm">{fmt(totalTon)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}