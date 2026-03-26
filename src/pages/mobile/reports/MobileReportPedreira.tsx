import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mountain, RefreshCw, Share2, Truck, Scale, FileDown, Loader2, Search, ChevronLeft, ChevronRight, CalendarIcon, Pencil } from 'lucide-react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useObraConfig } from '@/hooks/useObraConfig';
import { getApontadorHomeRoute } from '@/utils/navigationHelpers';
import { PedreiraEditModal } from '@/components/crud/PedreiraEditModal';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import jsPDF from 'jspdf';

interface GroupSummary {
  nome: string;
  viagens: number;
  tonelagem: number;
}

export default function MobileReportPedreira() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { readSheet, loading } = useGoogleSheets();
  const { obraConfig } = useObraConfig();
  const [data, setData] = useState<any[][]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  const parseDateBR = (dateStr: string): Date => {
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
  };

  const formatDateBR = (date: Date): string => {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const navigateDate = (direction: -1 | 1) => {
    const current = parseDateBR(selectedDate || todayStr);
    current.setDate(current.getDate() + direction);
    setSelectedDate(formatDateBR(current));
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; // yyyy-MM-dd
    if (val) {
      const [y, m, d] = val.split('-');
      setSelectedDate(`${d}/${m}/${y}`);
    }
  };

  const selectedDateISO = (() => {
    if (!selectedDate) return '';
    const [d, m, y] = selectedDate.split('/');
    return `${y}-${m}-${d}`;
  })();

  useEffect(() => {
    setSelectedDate(todayStr);
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const result = await readSheet('Apontamento_Pedreira').catch(() => []);
      setData(result || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filterByDateAndUser = (data: any[][], dateStr: string): { row: any[]; sheetRowIndex: number }[] => {
    if (!data || data.length < 2) return [];
    const headers = data[0];
    const dateIdx = headers.indexOf('Data');
    const userIdx = headers.indexOf('Usuario');
    if (dateIdx === -1) return [];
    
    const userName = effectiveName;
    
    const statusIdx = headers.indexOf('Status');
    return data.slice(1).map((row, idx) => ({ row, sheetRowIndex: idx + 2 })).filter(({ row }) => {
      const matchDate = (row[dateIdx] || '').split('/').map((p: string) => p.padStart(2, '0')).join('/') === dateStr;
      const status = (row[statusIdx] || '').toLowerCase();
      const isFinalized = status === 'finalizado' || status === 'lançado' || status === 'lancado';
      if (!isFinalized) return false;
      if (userIdx !== -1 && userName) {
        const recordUser = row[userIdx] || '';
        return matchDate && recordUser === userName;
      }
      return matchDate;
    });
  };

  const filteredDataWithIdx = filterByDateAndUser(data, selectedDate);
  const filteredData = filteredDataWithIdx.map(d => d.row);
  const headers = data[0] || [];

  const materialIdx = headers.indexOf('Material');
  const empresaIdx = headers.indexOf('Empresa_Eq') !== -1 ? headers.indexOf('Empresa_Eq') : headers.indexOf('Empresa');
  const tonelagemIdx = headers.indexOf('Tonelada') !== -1 ? headers.indexOf('Tonelada') : headers.indexOf('Tonelagem');
  const freteIdx = headers.indexOf('Frete');
  const viagensIdx = headers.indexOf('N_Viagens');
  const prefixoIdx = headers.indexOf('Prefixo_Eq') !== -1 ? headers.indexOf('Prefixo_Eq') : headers.indexOf('Prefixo');
  const motoristaIdx = headers.indexOf('Motorista');
  const horaIdx = headers.indexOf('Hora');
  const pesoLiqIdx = headers.indexOf('Peso_Liquido');
  const fornecedorIdx = headers.indexOf('Fornecedor');
  const statusIdx = headers.indexOf('Status');
  const pesoFinalIdx = headers.indexOf('Peso_Final');
  const pesoVazioIdx = headers.indexOf('Peso_Vazio');

  const getViagens = (row: any[]) => {
    if (viagensIdx === -1) return 1;
    const parsed = parseInt(String(row[viagensIdx] ?? '1'), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };

  const parseBR = (val: any): number => {
    if (val == null || val === '') return 0;
    const s = String(val).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  // Get tonelada from row, with fallback to Peso_Liquido/1000
  const getTonelada = (row: any[]): number => {
    const ton = parseBR(row[tonelagemIdx]);
    if (ton > 0) return ton;
    // Fallback: try Peso_Liquido / 1000
    const pesoLiq = parseBR(row[pesoLiqIdx]);
    if (pesoLiq > 0) return pesoLiq / 1000;
    // Fallback: try (Peso_Final - Peso_Vazio) / 1000
    if (pesoFinalIdx !== -1 && pesoVazioIdx !== -1) {
      const pf = parseBR(row[pesoFinalIdx]);
      const pv = parseBR(row[pesoVazioIdx]);
      if (pf > 0 && pv > 0) return (pf - pv) / 1000;
    }
    return 0;
  };

  const summarizeByField = (fieldIdx: number): GroupSummary[] => {
    if (fieldIdx === -1) return [];
    const summary: { [key: string]: GroupSummary } = {};
    filteredData.forEach(row => {
      const nome = (row[fieldIdx] || '').trim() || 'N/A';
      const tonelagem = getTonelada(row);
      const v = getViagens(row);
      if (!summary[nome]) summary[nome] = { nome, viagens: 0, tonelagem: 0 };
      summary[nome].viagens += v;
      summary[nome].tonelagem += tonelagem;
    });
    return Object.values(summary).sort((a, b) => b.viagens - a.viagens);
  };

  const byMaterial = summarizeByField(materialIdx);
  // Use Empresa_Eq, fallback to Fornecedor
  const empresaFieldIdx = empresaIdx !== -1 ? empresaIdx : fornecedorIdx;
  const byEmpresa = summarizeByField(empresaFieldIdx);
  const byFornecedor = fornecedorIdx !== -1 ? summarizeByField(fornecedorIdx) : [];

  const totalViagens = filteredData.reduce((sum, row) => sum + getViagens(row), 0);
  const totalTonelagem = filteredData.reduce((acc, row) => acc + getTonelada(row), 0);
  const totalFrete = filteredData.reduce((acc, row) => acc + parseBR(row[freteIdx]), 0);

  const shareViaWhatsApp = () => {
    const message = `📊 *RELATÓRIO PEDREIRA - ${selectedDate}*

👷 Apontador: ${effectiveName || 'N/A'}

📋 *Resumo do Dia:*
• Total Viagens: ${totalViagens}
• Tonelagem Total: ${totalTonelagem.toLocaleString('pt-BR')} ton
• Frete Total: R$ ${totalFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

📦 *Por Material:*
${byMaterial.map(m => `• ${m.nome}: ${m.viagens} viagens (${m.tonelagem.toLocaleString('pt-BR')} ton)`).join('\n') || 'Nenhum registro'}

🏢 *Por Empresa:*
${byEmpresa.map(e => `• ${e.nome}: ${e.viagens} viagens`).join('\n') || 'Nenhum registro'}

---
_Enviado via ApropriAPP_`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentW = pageW - 2 * margin;
      let y = margin;
      const now = new Date();
      const emitidoEm = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      // === HEADER ===
      // Orange bar at top
      doc.setFillColor(234, 88, 12);
      doc.rect(0, 0, pageW, 28, 'F');

      // Logo
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = obraConfig.logo || logoApropriapp;
        });
        if (img.complete && img.naturalWidth > 0) {
          const logoH = 14;
          const logoW = (img.naturalWidth / img.naturalHeight) * logoH;
          doc.addImage(img, 'PNG', margin, 7, logoW, logoH);
        }
      } catch { /* skip logo */ }

      // Title on orange bar
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255);
      doc.text('RELATÓRIO PEDREIRA', pageW - margin, 13, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${obraConfig.nome || 'ApropriAPP'} • ${obraConfig.local || ''}`, pageW - margin, 19, { align: 'right' });
      doc.setFontSize(8);
      doc.text(`Data: ${selectedDate}`, pageW - margin, 24, { align: 'right' });

      y = 34;

      // Info bar - Apontador + Emissão
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, contentW, 12, 'F');
      doc.setDrawColor(229, 231, 235);
      doc.rect(margin, y, contentW, 12, 'S');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60);
      doc.text(`Apontador: ${effectiveName || 'N/A'}`, margin + 3, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(`Emitido via App Mobile em ${emitidoEm}`, margin + 3, y + 10);
      doc.text(`Somente registros finalizados`, pageW - margin - 3, y + 5, { align: 'right' });
      y += 18;

      // === KPIs ===
      const kpiW = (contentW - 8) / 3;
      const drawKpiBox = (x: number, label: string, value: string, borderColor: [number, number, number]) => {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, kpiW, 18, 2, 2, 'F');
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.setLineWidth(0.8);
        doc.roundedRect(x, y, kpiW, 18, 2, 2, 'S');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40);
        doc.text(value, x + kpiW / 2, y + 8, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120);
        doc.text(label, x + kpiW / 2, y + 14, { align: 'center' });
      };

      drawKpiBox(margin, 'Viagens', String(totalViagens), [234, 88, 12]);
      drawKpiBox(margin + kpiW + 4, 'Toneladas', totalTonelagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), [71, 85, 105]);
      drawKpiBox(margin + 2 * (kpiW + 4), 'Frete (R$)', totalFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), [22, 163, 74]);
      y += 24;

      // === Helper: Section header ===
      const sectionHeader = (title: string, color: [number, number, number]) => {
        if (y > 260) { doc.addPage(); y = margin; }
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255);
        doc.text(title, margin + 3, y + 5);
        y += 7;
      };

      // === Helper: Table with 3 cols ===
      const drawSummaryTable = (items: GroupSummary[], headerColor: [number, number, number], col1Label: string) => {
        sectionHeader(col1Label, headerColor);
        // Column sub-headers
        const cw = [contentW * 0.5, contentW * 0.25, contentW * 0.25];
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, contentW, 6, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100);
        doc.text(col1Label.replace('Por ', ''), margin + 2, y + 4);
        doc.text('Viagens', margin + cw[0] + 2, y + 4);
        doc.text('Tonelagem (t)', margin + cw[0] + cw[1] + 2, y + 4);
        y += 6;

        if (items.length === 0) {
          doc.setFontSize(8); doc.setTextColor(150);
          doc.text('Nenhum registro', margin + 3, y + 4);
          y += 8;
          return;
        }

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        items.forEach((item, idx) => {
          if (y > 272) { doc.addPage(); y = margin; }
          if (idx % 2 === 0) {
            doc.setFillColor(252, 252, 252);
            doc.rect(margin, y, contentW, 6, 'F');
          }
          doc.setFontSize(8);
          doc.text(item.nome.substring(0, 40), margin + 2, y + 4);
          doc.text(String(item.viagens), margin + cw[0] + 2, y + 4);
          doc.text(item.tonelagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), margin + cw[0] + cw[1] + 2, y + 4);
          y += 6;
        });
        // Bottom line
        doc.setDrawColor(220);
        doc.setLineWidth(0.3);
        doc.line(margin, y, margin + contentW, y);
        y += 4;
      };

      drawSummaryTable(byMaterial, [234, 88, 12], 'Por Material');
      drawSummaryTable(byEmpresa, [71, 85, 105], empresaIdx !== -1 ? 'Por Empresa' : 'Por Fornecedor');

      // === DETALHAMENTO ===
      if (filteredData.length > 0) {
        if (y > 240) { doc.addPage(); y = margin; }
        sectionHeader(`Detalhamento de Viagens (${filteredData.length})`, [234, 88, 12]);

        const detCW = [contentW * 0.2, contentW * 0.3, contentW * 0.3, contentW * 0.2];
        // Sub-header
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y, contentW, 6, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100);
        doc.text('Veículo', margin + 2, y + 4);
        doc.text('Motorista', margin + detCW[0] + 2, y + 4);
        doc.text('Material', margin + detCW[0] + detCW[1] + 2, y + 4);
        doc.text('Tonelada', margin + detCW[0] + detCW[1] + detCW[2] + 2, y + 4);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50);
        [...filteredData].reverse().forEach((row, idx) => {
          if (y > 275) { doc.addPage(); y = margin; }
          if (idx % 2 === 0) {
            doc.setFillColor(252, 252, 252);
            doc.rect(margin, y, contentW, 5.5, 'F');
          }
          doc.setFontSize(7.5);
          doc.text((row[prefixoIdx] || '—').substring(0, 15), margin + 2, y + 4);
          doc.text((row[motoristaIdx] || '—').substring(0, 25), margin + detCW[0] + 2, y + 4);
          doc.text((row[materialIdx] || '—').substring(0, 25), margin + detCW[0] + detCW[1] + 2, y + 4);
          const ton = getTonelada(row);
          doc.text(ton > 0 ? ton.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—', margin + detCW[0] + detCW[1] + detCW[2] + 2, y + 4);
          y += 5.5;
        });
      }

      // === FOOTER on all pages ===
      const pageCount = doc.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        // Footer line
        doc.setDrawColor(234, 88, 12);
        doc.setLineWidth(0.5);
        doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
        // Footer text
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150);
        doc.text(`ApropriAPP • Emitido via App Mobile por ${effectiveName || 'N/A'} em ${emitidoEm}`, margin, pageH - 8);
        doc.text(`Página ${p}/${pageCount}`, pageW - margin, pageH - 8, { align: 'right' });
      }

      doc.save(`Relatorio_Pedreira_${selectedDate.replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleEditRow = (row: any[], sheetRowIndex: number) => {
    const ordemIdx = headers.indexOf('Ordem_Carregamento') !== -1 ? headers.indexOf('Ordem_Carregamento') : (headers.indexOf('OS') !== -1 ? headers.indexOf('OS') : headers.indexOf('Ordem'));
    const descricaoIdx = headers.indexOf('Descricao_Eq');
    const placaIdx = headers.indexOf('Placa');
    const dataIdx = headers.indexOf('Data');

    setEditData({
      rowIndex: sheetRowIndex,
      data: row[dataIdx] || '',
      hora: row[horaIdx] || '',
      ordem: row[ordemIdx] || '',
      fornecedor: row[fornecedorIdx] || '',
      prefixo: row[prefixoIdx] || '',
      descricao: row[descricaoIdx] || '',
      empresa: row[empresaIdx] || '',
      motorista: row[motoristaIdx] || '',
      placa: row[placaIdx] || '',
      material: row[materialIdx] || '',
      pesoVazio: parseBR(row[pesoVazioIdx]),
      pesoFinal: parseBR(row[pesoFinalIdx]),
      pesoLiquido: parseBR(row[pesoLiqIdx]),
      tonelada: getTonelada(row),
      originalRow: row,
    });
    setEditModalOpen(true);
  };

  const handleBack = () => {
    navigate(getApontadorHomeRoute());
  };

  return (
    <div className="min-h-screen bg-muted/50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={handleBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img src={obraConfig.logo || logoApropriapp} alt="Logo" className="w-8 h-8 rounded" />
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate">{obraConfig.nome || 'Relatório Pedreira'}</h1>
              <p className="text-xs text-white/80 truncate">{obraConfig.local ? `${obraConfig.local} • ${selectedDate}` : selectedDate}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-9 w-9" onClick={fetchData} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-9 w-9" onClick={exportPdf} disabled={exportingPdf || filteredData.length === 0}>
              {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-9 w-9" onClick={shareViaWhatsApp}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Date Selector */}
        <div className="flex items-center justify-between gap-2 bg-background rounded-xl p-2 border">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 justify-center">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDateISO}
              onChange={handleDateInputChange}
              className="bg-transparent border-none text-sm font-medium text-foreground text-center focus:outline-none"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigateDate(1)}
            disabled={selectedDate === todayStr}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          {selectedDate !== todayStr && (
            <Button variant="outline" size="sm" className="text-xs h-7 px-2" onClick={() => setSelectedDate(todayStr)}>
              Hoje
            </Button>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="bg-orange-50 border-0 p-2.5 rounded-xl">
            <div className="text-center">
              <Truck className="w-4 h-4 text-orange-600 mx-auto mb-0.5" />
              <p className="text-base font-bold text-orange-700 leading-tight">{totalViagens}</p>
              <p className="text-[10px] text-orange-600 leading-tight">Viagens</p>
            </div>
          </Card>
          <Card className="bg-muted border-0 p-2.5 rounded-xl">
            <div className="text-center">
              <Scale className="w-4 h-4 text-muted-foreground mx-auto mb-0.5" />
              <p className="text-base font-bold text-foreground leading-tight">{totalTonelagem.toLocaleString('pt-BR')}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Toneladas</p>
            </div>
          </Card>
          <Card className="bg-emerald-50 border-0 p-2.5 rounded-xl">
            <div className="text-center">
              <span className="text-sm text-emerald-600">R$</span>
              <p className="text-base font-bold text-emerald-700 leading-tight">{(totalFrete / 1000).toFixed(1)}k</p>
              <p className="text-[10px] text-emerald-600 leading-tight">Frete</p>
            </div>
          </Card>
        </div>

        {/* Por Material */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
            <Mountain className="w-4 h-4 text-orange-600" />
            Por Material
          </h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : byMaterial.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-1.5">
              {byMaterial.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 gap-2">
                  <span className="text-xs text-foreground flex-1 truncate">{item.nome}</span>
                  <div className="flex gap-1 shrink-0">
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5">
                      {item.viagens}v
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                      {item.tonelagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ton
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Por Empresa / Fornecedor */}
        <Card className="border-0 p-3">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
            <Truck className="w-4 h-4 text-muted-foreground" />
            {empresaIdx !== -1 ? 'Por Empresa' : 'Por Fornecedor'}
          </h3>
          {loading || isRefreshing ? (
            <div className="flex justify-center py-4">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : byEmpresa.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro hoje</p>
          ) : (
            <div className="space-y-1.5">
              {byEmpresa.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 gap-2">
                  <span className="text-xs text-foreground flex-1 truncate">{item.nome}</span>
                  <div className="flex gap-1 shrink-0">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                      {item.viagens}v
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                      {item.tonelagem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ton
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Detalhamento */}
        {filteredData.length > 0 && (
          <Card className="border-0 p-3">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2 text-sm">
              <Scale className="w-4 h-4 text-orange-600" />
              Detalhamento ({filteredData.length} viagens)
            </h3>
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pesquisar veículo, motorista, material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1.5">
              {[...filteredDataWithIdx]
                .reverse()
                .filter(({ row }) => {
                  if (!searchTerm.trim()) return true;
                  const term = searchTerm.toLowerCase();
                  return (
                    (row[prefixoIdx] || '').toLowerCase().includes(term) ||
                    (row[motoristaIdx] || '').toLowerCase().includes(term) ||
                    (row[materialIdx] || '').toLowerCase().includes(term)
                  );
                })
                .map(({ row, sheetRowIndex }, idx) => (
                <div key={idx} className={`flex items-center gap-2 py-2 px-1 rounded-lg ${idx % 2 === 0 ? 'bg-muted/30' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground truncate">{row[prefixoIdx] || '—'}</span>
                      <span className="text-[10px] text-muted-foreground">•</span>
                      <span className="text-[11px] text-muted-foreground truncate">{row[motoristaIdx] || '—'}</span>
                    </div>
                    <span className="text-[11px] text-foreground/70">{row[materialIdx] || '—'}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-foreground">
                      {getTonelada(row) > 0 ? getTonelada(row).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-0.5">ton</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-orange-600"
                    onClick={() => handleEditRow(row, sheetRowIndex)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Export Button */}
        <Button
          className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white"
          onClick={exportPdf}
          disabled={exportingPdf || filteredData.length === 0}
        >
          {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Exportar PDF
        </Button>
      </div>

      {/* Edit Modal */}
      <PedreiraEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={() => {
          setEditModalOpen(false);
          fetchData();
        }}
        editData={editData}
        headers={headers}
      />
    </div>
  );
}
