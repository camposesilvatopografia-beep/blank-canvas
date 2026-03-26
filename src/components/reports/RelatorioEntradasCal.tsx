import { useMemo, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Search, X, CalendarIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface Props {
  allMovData: any[][];
  movHeaders: string[];
  obraLogo?: string;
  obraNome?: string;
}

export interface RelatorioEntradasCalRef {
  exportPdf: () => Promise<void>;
  exportExcel: () => void;
}

const parseBR = (val: any): number => {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

const formatNumber = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const RelatorioEntradasCal = forwardRef<RelatorioEntradasCalRef, Props>(function RelatorioEntradasCal({ allMovData, movHeaders, obraLogo, obraNome }, ref) {
  const printRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mesFilter, setMesFilter] = useState<string>('todos');
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || obraLogo || logoApropriapp;

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

  const getIdx = (name: string) => movHeaders.indexOf(name);

  // Parse all entrada records
  const allEntradas = useMemo(() => {
    if (!allMovData || allMovData.length < 2 || !movHeaders.length) return [];

    return allMovData.slice(1)
      .filter(row => {
        const tipo = String(row[getIdx('Tipo')] || '').toLowerCase();
        return tipo === 'entrada';
      })
      .map((row, idx) => ({
        item: idx + 1,
        data: row[getIdx('Data')] || '',
        hora: row[getIdx('Hora')] || '',
        fornecedor: row[getIdx('Fornecedor')] || '',
        nf: row[getIdx('NF')] || '',
        qtd: parseBR(row[getIdx('Qtd')]),
        placa: row[getIdx('Placa')] || '',
        local: row[getIdx('Local')] || '',
        status: row[getIdx('Status')] || 'Finalizado',
      }));
  }, [allMovData, movHeaders]);

  // Available months for filter
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const r of allEntradas) {
      if (r.data) {
        const parts = r.data.split('/');
        if (parts.length === 3) {
          months.add(`${parts[1]}/${parts[2]}`);
        }
      }
    }
    return Array.from(months).sort((a, b) => {
      const [ma, ya] = a.split('/').map(Number);
      const [mb, yb] = b.split('/').map(Number);
      return new Date(yb, mb - 1).getTime() - new Date(ya, ma - 1).getTime();
    });
  }, [allEntradas]);

  // Filtered records
  const filteredEntradas = useMemo(() => {
    let records = allEntradas;

    if (mesFilter !== 'todos') {
      records = records.filter(r => {
        const parts = r.data.split('/');
        if (parts.length === 3) return `${parts[1]}/${parts[2]}` === mesFilter;
        return false;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      records = records.filter(r =>
        r.fornecedor.toLowerCase().includes(q) ||
        r.nf.toLowerCase().includes(q) ||
        r.placa.toLowerCase().includes(q) ||
        r.data.includes(q)
      );
    }

    // Sort by date descending (most recent first)
    records = [...records].sort((a, b) => {
      const [da, ma, ya] = a.data.split('/').map(Number);
      const [db, mb, yb] = b.data.split('/').map(Number);
      const dateA = new Date(ya, ma - 1, da).getTime();
      const dateB = new Date(yb, mb - 1, db).getTime();
      if (dateB !== dateA) return dateB - dateA;
      // Secondary sort by hora descending
      return (b.hora || '').localeCompare(a.hora || '');
    });

    // Re-index items
    return records.map((r, idx) => ({ ...r, item: idx + 1 }));
  }, [allEntradas, mesFilter, searchQuery]);

  // KPIs
  const kpis = useMemo(() => {
    const totalQtd = filteredEntradas.reduce((s, r) => s + r.qtd, 0);
    const totalRegistros = filteredEntradas.length;
    const fornecedores = new Set(filteredEntradas.map(r => r.fornecedor)).size;
    return { totalQtd, totalRegistros, fornecedores };
  }, [filteredEntradas]);

  // Expose export functions via ref
  useImperativeHandle(ref, () => ({
    exportPdf,
    exportExcel,
  }));

  // Export Excel
  const exportExcel = () => {
    const wsData = [
      ['Item', 'Data', 'Hora', 'Fornecedor', 'NF', 'Quantidade (t)', 'Placa', 'Status'],
      ...filteredEntradas.map(r => [r.item, r.data, r.hora, r.fornecedor, r.nf, formatNumber(r.qtd), r.placa, r.status]),
      [],
      ['', '', '', '', 'TOTAL:', formatNumber(kpis.totalQtd), '', ''],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 20 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Entradas CAL');
    XLSX.writeFile(wb, `Relatorio_Entradas_CAL_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export PDF via html2canvas (system standard pattern)
  const exportPdf = async () => {
    if (!printRef.current) return;

    // Show the print headers for PDF capture
    const printHeaders = printRef.current.querySelectorAll('.print-header-cal');
    printHeaders.forEach(el => (el as HTMLElement).style.display = 'flex');

    // Pre-load images as base64 to avoid CORS issues
    const imgs = printRef.current.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(async (img) => {
      try { img.src = await toBase64(img.src); } catch { /* ignore */ }
    }));

    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    // Hide the print headers again
    printHeaders.forEach(el => (el as HTMLElement).style.display = 'none');

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

    const mesLabel = mesFilter !== 'todos' ? `_${mesFilter.replace('/', '-')}` : '';
    pdf.save(`Relatorio_Entradas_CAL${mesLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const getMesLabel = (mes: string) => {
    const [m, y] = mes.split('/');
    const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${meses[parseInt(m)]} ${y}`;
  };

  return (
    <div className="space-y-4">
      {/* Filters & Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Período:</span>
        </div>
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue placeholder="Todos os meses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {availableMonths.map(m => (
              <SelectItem key={m} value={m}>{getMesLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fornecedor, NF, placa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 w-[250px] text-sm"
          />
        </div>
        {(mesFilter !== 'todos' || searchQuery.trim()) && (
          <button
            onClick={() => { setMesFilter('todos'); setSearchQuery(''); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
      </div>


      {/* Table */}
      <div ref={printRef} className="space-y-4">
        {/* Header for PDF - navy blue */}
        <div className="print-header-cal" style={{ background: 'linear-gradient(135deg, #1d3557, #264673)', color: '#fff', padding: '16px 20px', borderRadius: '8px', alignItems: 'center', gap: '14px', display: 'none' }}>
          <img src={activeLogo} alt="Logo" style={{ height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 4 }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>RELATÓRIO DE ENTRADAS — CAL</h2>
            {(obraConfig.nome || obraNome) && <p style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>{obraConfig.nome || obraNome}</p>}
            {obraConfig.local && <p style={{ fontSize: 10, opacity: 0.7 }}>📍 {obraConfig.local}</p>}
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, opacity: 0.85 }}>
            {mesFilter !== 'todos' ? `📅 ${getMesLabel(mesFilter)}` : '📅 Todos os períodos'}
          </div>
        </div>

        {/* KPI for PDF - only total */}
        <div className="print-header-cal" style={{ display: 'none', justifyContent: 'center' }}>
          <div style={{ background: 'linear-gradient(135deg, #065f46, #059669)', color: '#fff', borderRadius: '10px', padding: '14px 40px', textAlign: 'center', minWidth: 280 }}>
            <p style={{ fontSize: 10, opacity: 0.8, fontWeight: 600 }}>Total de Entradas no Período</p>
            <p style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}>{formatNumber(kpis.totalQtd)} t</p>
            <p style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{kpis.totalRegistros} registros • {kpis.fornecedores} fornecedor(es)</p>
          </div>
        </div>

        <Card className="border overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-foreground text-center flex-1">
                Detalhamento de Entradas
                {mesFilter !== 'todos' && <span className="ml-2 text-sm font-normal text-muted-foreground">— {getMesLabel(mesFilter)}</span>}
              </CardTitle>
              <Badge variant="outline">{filteredEntradas.length} registros</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow style={{ background: '#1d3557' }}>
                  <TableHead className="text-white font-bold text-center w-14" style={{ fontSize: 11, padding: '8px 12px' }}>ITEM</TableHead>
                  <TableHead className="text-white font-bold" style={{ fontSize: 11, padding: '8px 12px' }}>DATA</TableHead>
                  <TableHead className="text-white font-bold" style={{ fontSize: 11, padding: '8px 12px' }}>HORA</TableHead>
                  <TableHead className="text-white font-bold" style={{ fontSize: 11, padding: '8px 12px' }}>FORNECEDOR</TableHead>
                  <TableHead className="text-white font-bold" style={{ fontSize: 11, padding: '8px 12px' }}>NF</TableHead>
                  <TableHead className="text-white font-bold text-right" style={{ fontSize: 11, padding: '8px 12px' }}>QUANTIDADE (t)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma entrada encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filteredEntradas.map((r, idx) => (
                      <TableRow key={r.item} className={idx % 2 === 1 ? 'bg-muted/30' : ''} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <TableCell className="text-center font-medium" style={{ fontSize: 11, padding: '6px 12px' }}>{r.item}</TableCell>
                        <TableCell style={{ fontSize: 11, padding: '6px 12px' }}>{r.data}</TableCell>
                        <TableCell style={{ fontSize: 11, padding: '6px 12px' }}>{r.hora}</TableCell>
                        <TableCell className="font-medium" style={{ fontSize: 11, padding: '6px 12px' }}>{r.fornecedor}</TableCell>
                        <TableCell style={{ fontSize: 11, padding: '6px 12px' }}>{r.nf || '—'}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums" style={{ fontSize: 11, padding: '6px 12px' }}>{formatNumber(r.qtd)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow style={{ background: '#1d3557' }}>
                      <TableCell colSpan={5} className="text-right text-white font-bold" style={{ fontSize: 12, padding: '8px 12px' }}>
                        TOTAL
                      </TableCell>
                      <TableCell className="text-right text-white font-bold tabular-nums" style={{ fontSize: 12, padding: '8px 12px' }}>
                        {formatNumber(kpis.totalQtd)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
