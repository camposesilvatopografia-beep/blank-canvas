import { useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileDown, Scale, CalendarDays, MessageCircle, Camera, AlertTriangle, Truck, Image as ImageIcon } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PedreiraFilterBar } from '@/components/reports/PedreiraFilterBar';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface WeightRecord {
  data?: string;
  hora: string;
  prefixo: string;
  material: string;
  empresa: string;
  fornecedor: string;
  pesoVazio?: number;
  pesoFinal?: number;
  pesoLiquido?: number;
  pesoChegada?: number;
  fotoChegada?: string;
}

interface RelatorioControlePesoPedreiraProps {
  records: WeightRecord[];
  selectedDate: string;
  allRecords?: WeightRecord[];
  availableDates?: string[];
}

export function RelatorioControlePesoPedreira({
  records,
  selectedDate,
  allRecords,
  availableDates = [],
}: RelatorioControlePesoPedreiraProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [internalDate, setInternalDate] = useState<string>('');
  const [showOnlyDivergent, setShowOnlyDivergent] = useState(false);
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
  const fmtTon = (n: number) => (n / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3 });

  const weightRecords = useMemo(() => {
    let recs = activeRecords.filter(r => (r.pesoChegada || 0) > 0 && (r.pesoFinal || 0) > 0);
    if (showOnlyDivergent) {
      recs = recs.filter(r => Math.abs((r.pesoFinal || 0) - (r.pesoChegada || 0)) > 0);
    }
    return recs.map(r => {
      const pesoLiq = r.pesoLiquido || ((r.pesoFinal || 0) - (r.pesoVazio || 0));
      return { ...r, pesoLiqCalc: pesoLiq > 0 ? pesoLiq : 0, diferenca: (r.pesoFinal || 0) - (r.pesoChegada || 0) };
    });
  }, [activeRecords, showOnlyDivergent]);

  const ctrlSort = useTableSort(weightRecords);

  const totalDiferenca = weightRecords.reduce((s, r) => s + r.diferenca, 0);
  const totalPesoFinal = weightRecords.reduce((s, r) => s + (r.pesoFinal || 0), 0);
  const totalPesoChegada = weightRecords.reduce((s, r) => s + (r.pesoChegada || 0), 0);
  const totalPesoLiq = weightRecords.reduce((s, r) => s + r.pesoLiqCalc, 0);
  const totalRegistros = weightRecords.length;
  const totalComFoto = weightRecords.filter(r => !!r.fotoChegada).length;

  // html2canvas PDF export (WYSIWYG standard)
  const handleExportPDF = async () => {
    if (!reportRef.current) return;

    const printHeader = reportRef.current.querySelector('.print-header-peso');
    if (printHeader) printHeader.classList.remove('hidden');

    const logoImgs = reportRef.current.querySelectorAll('img');
    const logoPromises = Array.from(logoImgs).map(async (img) => {
      try { const b64 = await toBase64(img.src); img.src = b64; } catch { /* ignore */ }
    });
    await Promise.all(logoPromises);

    const canvas = await html2canvas(reportRef.current, {
      scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
    });

    if (printHeader) printHeader.classList.add('hidden');

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const usableWidth = pdfWidth - margin * 2;
    const scaledHeight = (canvas.height * usableWidth) / canvas.width;

    if (scaledHeight <= pdfHeight - margin * 2) {
      pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, scaledHeight);
    } else {
      let yOffset = 0;
      const pageContentHeight = pdfHeight - margin * 2;
      const sourcePageHeight = (pageContentHeight * canvas.width) / usableWidth;
      while (yOffset < canvas.height) {
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = canvas.width;
        cropCanvas.height = Math.min(sourcePageHeight, canvas.height - yOffset);
        const ctx = cropCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, -yOffset);
        const pageImg = cropCanvas.toDataURL('image/png');
        const cropScaledHeight = (cropCanvas.height * usableWidth) / canvas.width;
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(pageImg, 'PNG', margin, margin, usableWidth, cropScaledHeight);
        yOffset += sourcePageHeight;
      }
    }
    pdf.save(`Controle_Peso_Pedreira_${activeDate.replace(/\//g, '-')}.pdf`);
  };

  const shareWhatsApp = () => {
    const lines = weightRecords.map(r => {
      const dif = (r.pesoFinal || 0) - (r.pesoChegada || 0);
      return `🚛 *${r.prefixo}* ${r.hora} — ${r.material}\n   Saída: ${fmt(r.pesoFinal || 0)} → Chegada: ${fmt(r.pesoChegada || 0)} → *Dif: ${dif > 0 ? '-' : '+'}${fmt(Math.abs(dif))}*`;
    }).join('\n');
    const text = `⚖️ *CONTROLE DE PESO — PEDREIRA*\n📅 ${activeDate}\n\n${lines}\n\n🔴 *Total Diferença: ${totalDiferenca > 0 ? '-' : '+'}${fmt(Math.abs(totalDiferenca))} kg*\n📷 ${totalComFoto}/${totalRegistros} com foto\n\n_ApropriAPP_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (records.length === 0 && !internalDate) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Scale className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-base font-medium">Controle de Peso — Diferença Saída × Chegada</CardTitle>
            {totalRegistros > 0 && (
              <>
                <Badge variant="secondary">{totalRegistros} registros</Badge>
                <Badge variant={totalDiferenca > 0 ? 'destructive' : 'secondary'} className="font-bold">
                  {totalDiferenca > 0 ? '-' : '+'}{fmt(Math.abs(totalDiferenca))} kg
                </Badge>
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

            <div className="flex items-center gap-1.5">
              <Switch id="only-div" checked={showOnlyDivergent} onCheckedChange={setShowOnlyDivergent} />
              <Label htmlFor="only-div" className="text-xs cursor-pointer">Só divergentes</Label>
            </div>

            <Button onClick={shareWhatsApp} size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50">
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

      {weightRecords.length === 0 ? (
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Scale className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhum registro com peso de chegada para esta data.</p>
          </div>
        </CardContent>
      ) : (
        <CardContent ref={reportRef} className="space-y-2">
          {/* Print-only header */}
          <div className="hidden print-header-peso" style={{ background: 'linear-gradient(135deg, #c2410c, #f97316)', color: '#fff', padding: '10px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={activeLogo} alt="Logo" style={{ height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: 3 }} />
            <div style={{ flex: 1 }}>
              {obraConfig.nome && <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.9 }}>{obraConfig.nome}</p>}
              {obraConfig.local && <p style={{ fontSize: 8, opacity: 0.7 }}>📍 {obraConfig.local}</p>}
              <h2 style={{ fontSize: 13, fontWeight: 800, marginTop: 1 }}>⚖️ Controle de Peso — Diferença Saída × Chegada</h2>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, opacity: 0.85 }}>📅 {activeDate}</div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-1.5">
            <Card className="text-center py-1.5 px-2 border-orange-200 bg-orange-50 dark:bg-orange-950/30">
              <Truck className="w-3.5 h-3.5 text-orange-600 mx-auto" />
              <p className="text-base font-bold text-orange-700 leading-tight">{totalRegistros}</p>
              <p className="text-[9px] text-orange-600/70 leading-tight">Registros</p>
            </Card>
            <Card className="text-center py-1.5 px-2 border-blue-200 bg-blue-50 dark:bg-blue-950/30">
              <Scale className="w-3.5 h-3.5 text-blue-600 mx-auto" />
              <p className="text-sm font-bold text-blue-700 leading-tight">{fmtTon(totalPesoFinal)}</p>
              <p className="text-[9px] text-blue-600/70 leading-tight">Peso Final Total (t)</p>
            </Card>
            <Card className="text-center py-1.5 px-2 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
              <Scale className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-emerald-700 leading-tight">{fmtTon(totalPesoChegada)}</p>
              <p className="text-[9px] text-emerald-600/70 leading-tight">Peso Chegada Total (t)</p>
            </Card>
            <Card className={`text-center py-1.5 px-2 ${totalDiferenca > 0 ? 'border-red-300 bg-red-50 dark:bg-red-950/30' : 'border-green-300 bg-green-50 dark:bg-green-950/30'}`}>
              <AlertTriangle className={`w-3.5 h-3.5 mx-auto ${totalDiferenca > 0 ? 'text-red-600' : 'text-green-600'}`} />
              <p className={`text-sm font-bold leading-tight ${totalDiferenca > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totalDiferenca > 0 ? '-' : '+'}{fmt(Math.abs(totalDiferenca))}
              </p>
              <p className="text-[9px] text-muted-foreground leading-tight">Diferença Total (kg)</p>
            </Card>
          </div>

          {/* Alert banner */}
          {totalDiferenca > 500 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded p-1.5 text-xs text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Perda total de <strong>{fmt(totalDiferenca)} kg</strong> detectada neste dia.</span>
            </div>
          )}

          {/* Table */}
          <Card className="border overflow-hidden">
            <CardHeader className="py-1.5 px-4" style={{ background: 'linear-gradient(135deg, #c2410c, #f97316)' }}>
              <CardTitle className="text-xs flex items-center gap-1.5 text-white">
                <Scale className="w-3.5 h-3.5" />
                Detalhamento por Viagem — {activeDate}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50 dark:bg-amber-950/30">
                     <SortableTableHead sortKey="prefixo" sortConfig={ctrlSort.sortConfig} onSort={ctrlSort.requestSort} className="py-1.5 text-xs font-bold text-amber-900">Prefixo</SortableTableHead>
                    <SortableTableHead sortKey="hora" sortConfig={ctrlSort.sortConfig} onSort={ctrlSort.requestSort} className="py-1.5 text-xs font-bold text-amber-900">Hora</SortableTableHead>
                    <SortableTableHead sortKey="material" sortConfig={ctrlSort.sortConfig} onSort={ctrlSort.requestSort} className="py-1.5 text-xs font-bold text-amber-900">Material</SortableTableHead>
                    <SortableTableHead sortKey="pesoVazio" sortConfig={ctrlSort.sortConfig} onSort={ctrlSort.requestSort} className="py-1.5 text-xs font-bold text-amber-900 text-right">Peso Vazio (t)</SortableTableHead>
                    <SortableTableHead sortKey="pesoFinal" sortConfig={ctrlSort.sortConfig} onSort={ctrlSort.requestSort} className="py-1.5 text-xs font-bold text-amber-900 text-right">Peso Carregado (t)</SortableTableHead>
                    <SortableTableHead sortKey="pesoLiqCalc" sortConfig={ctrlSort.sortConfig} onSort={ctrlSort.requestSort} className="py-1.5 text-xs font-bold text-amber-900 text-right">Peso Líquido (t)</SortableTableHead>
                    <SortableTableHead sortKey="pesoChegada" sortConfig={ctrlSort.sortConfig} onSort={ctrlSort.requestSort} className="py-1.5 text-xs font-bold text-amber-900 text-right">Peso Chegada (t)</SortableTableHead>
                    <SortableTableHead sortKey="diferenca" sortConfig={ctrlSort.sortConfig} onSort={ctrlSort.requestSort} className="py-1.5 text-xs font-bold text-amber-900 text-right">Diferença (kg)</SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ctrlSort.sortedData.map((r, i) => {
                        const dif = r.diferenca;
                        return (
                      <TableRow key={i} className={i % 2 === 1 ? 'bg-muted/30' : ''}>
                        <TableCell className="py-1 font-semibold text-xs">{r.prefixo}</TableCell>
                        <TableCell className="py-1 text-xs">{r.hora}</TableCell>
                        <TableCell className="py-1 text-xs">{r.material}</TableCell>
                        <TableCell className="py-1 text-right text-xs font-medium">{fmtTon(r.pesoVazio || 0)}</TableCell>
                        <TableCell className="py-1 text-right text-xs font-medium">{fmtTon(r.pesoFinal || 0)}</TableCell>
                        <TableCell className="py-1 text-right text-xs font-medium text-blue-700">{fmtTon(r.pesoLiqCalc)}</TableCell>
                        <TableCell className="py-1 text-right text-xs font-medium">{fmtTon(r.pesoChegada || 0)}</TableCell>
                        <TableCell className={`py-1 text-right text-xs font-bold ${dif > 0 ? 'text-red-600' : dif < 0 ? 'text-green-600' : ''}`}>
                          {dif > 0 ? '-' : dif < 0 ? '+' : ''}{fmt(Math.abs(dif))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-amber-50 dark:bg-amber-950/30">
                    <TableCell colSpan={3} className="py-1.5 font-bold text-xs">TOTAL</TableCell>
                    <TableCell className="py-1.5 text-right font-bold text-xs">{fmtTon(weightRecords.reduce((s, r) => s + (r.pesoVazio || 0), 0))}</TableCell>
                    <TableCell className="py-1.5 text-right font-bold text-xs">{fmtTon(totalPesoFinal)}</TableCell>
                    <TableCell className="py-1.5 text-right font-bold text-xs text-blue-700">{fmtTon(totalPesoLiq)}</TableCell>
                    <TableCell className="py-1.5 text-right font-bold text-xs">{fmtTon(totalPesoChegada)}</TableCell>
                    <TableCell className={`py-1.5 text-right font-bold text-xs ${totalDiferenca > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {totalDiferenca > 0 ? '-' : '+'}{fmt(Math.abs(totalDiferenca))}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-[10px] text-muted-foreground pt-1 border-t">
            ApropriAPP — Gestão Inteligente • {new Date().toLocaleString('pt-BR')}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
