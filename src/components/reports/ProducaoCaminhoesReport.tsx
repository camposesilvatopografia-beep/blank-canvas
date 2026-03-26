import { useRef, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Printer, X, MessageCircle, Image, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface CaminhaoReportData {
  prefixo: string;
  motorista: string;
  local: string;
  aterro: number;
  areia: number;
  botaFora: number;
  vegetal: number;
  bgs: number;
  total: number;
}

interface InactiveCaminhao {
  prefixo: string;
  motorista: string;
  empresa: string;
}

interface ProducaoCaminhoesReportProps {
  data: CaminhaoReportData[];
  selectedDate: string;
  totalViagens: number;
  totalCaminhoes: number;
  mediaPorCaminhao: number;
  volumeTransportado: number;
  inactiveCaminhoes?: InactiveCaminhao[];
  onClose?: () => void;
}

type SortField = 'prefixo' | 'motorista' | 'local' | 'aterro' | 'areia' | 'botaFora' | 'vegetal' | 'bgs' | 'total';
type SortDirection = 'asc' | 'desc' | null;

export function ProducaoCaminhoesReport({
  data,
  selectedDate,
  totalViagens,
  totalCaminhoes,
  mediaPorCaminhao,
  volumeTransportado,
  inactiveCaminhoes = [],
  onClose
}: ProducaoCaminhoesReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [isPdfExporting] = useState(false);
  const [sortField, setSortField] = useState<SortField>('prefixo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showSettings, setShowSettings] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showColumns, setShowColumns] = useState({
    motorista: true,
    local: true,
    aterro: true,
    areia: true,
    botaFora: true,
    vegetal: true,
    bgs: true,
  });

  // Identify prefixes that appear in multiple locations and count their locations
  const prefixoLocaisCount = useMemo(() => {
    const countMap = new Map<string, Set<string>>();
    data.forEach(row => {
      if (!countMap.has(row.prefixo)) countMap.set(row.prefixo, new Set());
      countMap.get(row.prefixo)!.add(row.local);
    });
    return countMap;
  }, [data]);

  const prefixosMultiplosLocais = useMemo(() => {
    return new Set(
      Array.from(prefixoLocaisCount.entries())
        .filter(([_, locais]) => locais.size > 1)
        .map(([prefixo]) => prefixo)
    );
  }, [prefixoLocaisCount]);

  // Color palette for multi-location prefixes
  const MULTI_LOCATION_COLORS = [
    'bg-blue-100 border-l-4 border-blue-500',
    'bg-green-100 border-l-4 border-green-500',
    'bg-purple-100 border-l-4 border-purple-500',
    'bg-orange-100 border-l-4 border-orange-500',
    'bg-pink-100 border-l-4 border-pink-500',
    'bg-cyan-100 border-l-4 border-cyan-500',
    'bg-yellow-100 border-l-4 border-yellow-500',
    'bg-red-100 border-l-4 border-red-500',
  ];

  const prefixoColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let colorIndex = 0;
    data.forEach(row => {
      if (prefixosMultiplosLocais.has(row.prefixo) && !map.has(row.prefixo)) {
        map.set(row.prefixo, MULTI_LOCATION_COLORS[colorIndex % MULTI_LOCATION_COLORS.length]);
        colorIndex++;
      }
    });
    return map;
  }, [data, prefixosMultiplosLocais]);

  const sortedData = useMemo(() => {
    if (!sortDirection || !sortField) return data;
    
    return [...data].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'pt-BR', { numeric: true });
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
  }, [data, sortField, sortDirection]);

  const getRowClassName = (row: CaminhaoReportData, index: number) => {
    const baseClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    if (prefixosMultiplosLocais.has(row.prefixo)) {
      return prefixoColorMap.get(row.prefixo) || baseClass;
    }
    return baseClass;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="w-3 h-3 ml-1" />;
    if (sortDirection === 'desc') return <ArrowDown className="w-3 h-3 ml-1" />;
    return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper: convert image src to base64 for PDF embedding
  const toBase64 = (src: string): Promise<string> => {
    if (src.startsWith('data:')) return Promise.resolve(src);
    return new Promise<string>((resolve) => {
      const img = document.createElement('img') as HTMLImageElement;
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  };

  const handleExportPDF = async () => {
    const contentEl = document.getElementById('report-content-caminhoes');
    if (!contentEl) return;

    try {
      const canvas = await html2canvas(contentEl, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const reportHtml = `<!DOCTYPE html><html><head>
        <title>Produção dos Caminhões - ${selectedDate}</title>
        <style>
          @page { size: A4 portrait; margin: 6mm; }
          @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
          * { margin:0; padding:0; box-sizing:border-box; }
          body { display:flex; justify-content:center; align-items:flex-start; }
          img { width:100%; height:auto; }
        </style>
      </head><body>
        <img src="${imgData}" />
      </body></html>`;

      printWindow.document.write(reportHtml);
      printWindow.document.close();
      printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 200); };
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    }
  };

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `producao-caminhoes-${selectedDate.replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Erro ao exportar imagem:', error);
    }
  };

  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();
    
    const excelData: Record<string, string | number>[] = sortedData.map((row, idx) => ({
      'Nº': idx + 1,
      'Prefixo': row.prefixo,
      'Motorista': row.motorista,
      'Local': row.local,
      'Aterro': row.aterro || 0,
      'Areia': row.areia || 0,
      'Bota Fora': row.botaFora || 0,
      'Vegetal': row.vegetal || 0,
      'BGS': row.bgs || 0,
      'Total': row.total,
    }));
    
    // Add totals row
    excelData.push({
      'Nº': 'TOTAL' as unknown as number,
      'Prefixo': '',
      'Motorista': '',
      'Local': '',
      'Aterro': sortedData.reduce((s, r) => s + r.aterro, 0),
      'Areia': sortedData.reduce((s, r) => s + r.areia, 0),
      'Bota Fora': sortedData.reduce((s, r) => s + r.botaFora, 0),
      'Vegetal': sortedData.reduce((s, r) => s + r.vegetal, 0),
      'BGS': sortedData.reduce((s, r) => s + r.bgs, 0),
      'Total': totalViagens,
    });
    
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Caminhões');
    XLSX.writeFile(wb, `caminhoes-${selectedDate.replace(/\//g, '-')}.xlsx`);
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');
  const formatRounded = (num: number) => Math.round(num).toLocaleString('pt-BR');

  const handleWhatsAppExport = () => {
    let message = `*🚚 PRODUÇÃO DOS CAMINHÕES*\n`;
    message += `📅 Data: ${selectedDate}\n\n`;
    
    message += `*📊 INDICADORES:*\n`;
    message += `• Total de Viagens: *${formatNumber(totalViagens)}*\n`;
    message += `• Caminhões: *${totalCaminhoes}*\n`;
    message += `• Média p/ Caminhão: *${formatRounded(mediaPorCaminhao)}*\n`;
    message += `• Volume Transportado: *${formatNumber(volumeTransportado)} m³*\n\n`;
    
    if (data.length > 0) {
      message += `*🚚 TOP 10 CAMINHÕES:*\n`;
      data.slice(0, 10).forEach((row, idx) => {
        message += `${idx + 1}. ${row.prefixo} (${row.motorista}): *${row.total}* viagens\n`;
      });
      if (data.length > 10) {
        message += `... e mais ${data.length - 10} caminhões\n`;
      }
    }
    
    message += `\n_Gerado em ${new Date().toLocaleString('pt-BR')}_`;
    message += `\n_ApropriAPP - Gestão Inteligente_`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  return (
    <>
      {/* Print-only content */}
      <div id="print-report-caminhoes" className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999]">
        <div className="p-4">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-[#16a34a] text-white rounded-lg px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-95">Total de Viagens</p>
              <p className="text-3xl font-bold mt-0.5">{formatNumber(totalViagens)}</p>
            </div>
            <div className="bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Caminhões</p>
              <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalCaminhoes}</p>
            </div>
            <div className="bg-[#f59e0b] text-white rounded-lg px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-95">Média p/ Caminhão</p>
              <p className="text-3xl font-bold mt-0.5">{formatRounded(mediaPorCaminhao)}</p>
            </div>
            <div className="bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Volume Transp. (m³)</p>
              <p className="text-3xl font-bold text-gray-800 mt-0.5">{formatNumber(volumeTransportado)}</p>
            </div>
          </div>

          {/* Title Bar */}
          <div className="bg-[#1e3a5f] text-white text-center py-2.5 mb-0">
            <h1 className="text-base font-bold tracking-wide">
              Nº de Viagens por Caminhão
            </h1>
          </div>

          {/* Data Table */}
          <div className="border border-t-0 border-gray-300 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#2d4a6f] text-white">
                  <th className="border-r border-[#3d5a7f] px-3 py-2.5 text-left font-semibold text-sm">Caminhão</th>
                  {showColumns.motorista && <th className="border-r border-[#3d5a7f] px-3 py-2.5 text-center font-semibold text-sm">Motorista</th>}
                  {showColumns.local && <th className="border-r border-[#3d5a7f] px-3 py-2.5 text-center font-semibold text-sm">Local</th>}
                  {showColumns.aterro && <th className="border-r border-[#3d5a7f] px-3 py-2.5 text-center font-semibold text-sm">Aterro</th>}
                  {showColumns.areia && <th className="border-r border-[#3d5a7f] px-3 py-2.5 text-center font-semibold text-sm">Areia</th>}
                  {showColumns.botaFora && <th className="border-r border-[#3d5a7f] px-3 py-2.5 text-center font-semibold text-sm">Bota Fora</th>}
                  {showColumns.vegetal && <th className="border-r border-[#3d5a7f] px-3 py-2.5 text-center font-semibold text-sm">Vegetal</th>}
                  {showColumns.bgs && <th className="border-r border-[#3d5a7f] px-3 py-2.5 text-center font-semibold text-sm">BGS</th>}
                  <th className="px-3 py-2.5 text-center font-semibold text-sm">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row, index) => {
                  const locaisCount = prefixoLocaisCount.get(row.prefixo)?.size || 1;
                  const hasMultipleLocais = locaisCount > 1;
                  return (
                    <tr key={index} className={getRowClassName(row, index)}>
                      <td className="border-r border-gray-200 px-3 py-2 font-medium text-sm text-gray-900">
                        <div className="flex items-center gap-1">
                          {row.prefixo}
                          {hasMultipleLocais && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white">
                              {locaisCount}
                            </span>
                          )}
                        </div>
                      </td>
                      {showColumns.motorista && <td className="border-r border-gray-200 px-3 py-2 text-center text-sm text-gray-700">{row.motorista}</td>}
                      {showColumns.local && <td className="border-r border-gray-200 px-3 py-2 text-center text-sm text-gray-700">{row.local}</td>}
                      {showColumns.aterro && <td className="border-r border-gray-200 px-3 py-2 text-center text-sm text-gray-600">{row.aterro || '-'}</td>}
                      {showColumns.areia && <td className="border-r border-gray-200 px-3 py-2 text-center text-sm text-gray-600">{row.areia || '-'}</td>}
                      {showColumns.botaFora && <td className="border-r border-gray-200 px-3 py-2 text-center text-sm text-gray-600">{row.botaFora || '-'}</td>}
                      {showColumns.vegetal && <td className="border-r border-gray-200 px-3 py-2 text-center text-sm text-gray-600">{row.vegetal || '-'}</td>}
                      {showColumns.bgs && <td className="border-r border-gray-200 px-3 py-2 text-center text-sm text-gray-600">{row.bgs || '-'}</td>}
                      <td className="px-3 py-2 text-center font-bold text-sm text-gray-900 bg-gray-100">{row.total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
            <span>Data: {selectedDate}</span>
            <span className="font-medium">ApropriAPP - Gestão Inteligente</span>
            <span>Gerado em {new Date().toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>

      {/* Screen Modal */}
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 print:hidden">
        <div 
          ref={reportRef}
          className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-auto"
        >
          {/* Action Buttons - Top */}
          <div className="flex justify-between gap-2 px-5 py-3 border-b bg-gray-50">
            {/* Settings Toggle */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSettings(!showSettings)}
              className={`gap-1.5 h-9 ${showSettings ? 'bg-primary/10 border-primary' : ''}`}
            >
              <Settings className="w-4 h-4" />
              Configurar
              {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 h-9">
                <X className="w-4 h-4" />
                Fechar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleWhatsAppExport} 
                className="gap-1.5 h-9 text-green-600 border-green-300 hover:bg-green-50"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportImage} 
                className="gap-1.5 h-9 text-purple-600 border-purple-300 hover:bg-purple-50"
              >
                <Image className="w-4 h-4" />
                Imagem
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportXLSX} 
                className="gap-1.5 h-9 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 h-9">
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
              <Button size="sm" onClick={handleExportPDF} className="gap-1.5 h-9 bg-[#1e3a5f] hover:bg-[#152a47]">
                <FileDown className="w-4 h-4" />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="px-5 py-3 border-b bg-gray-100/50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="show-inactive" 
                    checked={showInactive}
                    onCheckedChange={setShowInactive}
                  />
                  <Label htmlFor="show-inactive" className="text-sm">
                    Mostrar inativos ({inactiveCaminhoes.length})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="col-motorista" 
                    checked={showColumns.motorista}
                    onCheckedChange={(v) => setShowColumns({...showColumns, motorista: v})}
                  />
                  <Label htmlFor="col-motorista" className="text-sm">Motorista</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="col-local" 
                    checked={showColumns.local}
                    onCheckedChange={(v) => setShowColumns({...showColumns, local: v})}
                  />
                  <Label htmlFor="col-local" className="text-sm">Local</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="col-aterro" 
                    checked={showColumns.aterro}
                    onCheckedChange={(v) => setShowColumns({...showColumns, aterro: v})}
                  />
                  <Label htmlFor="col-aterro" className="text-sm">Aterro</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="col-areia" 
                    checked={showColumns.areia}
                    onCheckedChange={(v) => setShowColumns({...showColumns, areia: v})}
                  />
                  <Label htmlFor="col-areia" className="text-sm">Areia</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="col-botafora" 
                    checked={showColumns.botaFora}
                    onCheckedChange={(v) => setShowColumns({...showColumns, botaFora: v})}
                  />
                  <Label htmlFor="col-botafora" className="text-sm">Bota Fora</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="col-vegetal" 
                    checked={showColumns.vegetal}
                    onCheckedChange={(v) => setShowColumns({...showColumns, vegetal: v})}
                  />
                  <Label htmlFor="col-vegetal" className="text-sm">Vegetal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="col-bgs" 
                    checked={showColumns.bgs}
                    onCheckedChange={(v) => setShowColumns({...showColumns, bgs: v})}
                  />
                  <Label htmlFor="col-bgs" className="text-sm">BGS</Label>
                </div>
              </div>
            </div>
          )}

          {/* Report Content for Screen */}
          <div className="p-5" id="report-content-caminhoes">
          {/* PDF-only header — hidden in UI, shown during export */}
          {isPdfExporting ? (
            <div style={{ background: 'linear-gradient(135deg,#1a2e6e,#1d3557)', borderRadius: 10, padding: '18px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
              <img src={activeLogo} alt="Logo" style={{ height: 72, width: 'auto', objectFit: 'contain', background: 'white', borderRadius: 8, padding: 6 }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                {obraConfig.nome && <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{obraConfig.nome}</p>}
                {obraConfig.local && <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginBottom: 6 }}>{obraConfig.local}</p>}
                <p style={{ color: 'white', fontWeight: 800, fontSize: 20, letterSpacing: 1 }}>PRODUÇÃO DOS CAMINHÕES</p>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 4 }}>Data: {selectedDate}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
              <div>
                {obraConfig.nome && <p className="font-bold text-gray-900 text-base">{obraConfig.nome}</p>}
                {obraConfig.local && <p className="text-xs text-gray-500">{obraConfig.local}</p>}
                <p className="font-bold text-gray-800 text-base">PRODUÇÃO DOS CAMINHÕES</p>
                <p className="text-xs text-gray-500">Data: {selectedDate}</p>
              </div>
            </div>
          )}
            {/* KPI Cards Row */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-[#16a34a] text-white rounded-lg px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-95">Total de Viagens</p>
                <p className="text-3xl font-bold mt-0.5">{formatNumber(totalViagens)}</p>
              </div>
              <div className="bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Caminhões</p>
                <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalCaminhoes}</p>
              </div>
              <div className="bg-[#f59e0b] text-white rounded-lg px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-95">Média p/ Caminhão</p>
                <p className="text-3xl font-bold mt-0.5">{formatRounded(mediaPorCaminhao)}</p>
              </div>
              <div className="bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Volume Transp. (m³)</p>
                <p className="text-3xl font-bold text-gray-800 mt-0.5">{formatNumber(volumeTransportado)}</p>
              </div>
            </div>

            {/* Title Bar */}
            <div className="bg-[#1e3a5f] text-white text-center py-2.5 mb-0 rounded-t-md">
              <h1 className="text-base font-bold tracking-wide">
                Nº de Viagens por Caminhão
              </h1>
            </div>

            {/* Data Table */}
            <div className="border border-t-0 border-gray-300 rounded-b-md overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#2d4a6f] text-white">
                    <th 
                      className="border-r border-[#3d5a7f] px-3 py-2 text-left font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('prefixo')}
                    >
                      <span className="flex items-center">
                        Caminhão {getSortIcon('prefixo')}
                      </span>
                    </th>
                    <th 
                      className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('motorista')}
                    >
                      <span className="flex items-center justify-center">
                        Motorista {getSortIcon('motorista')}
                      </span>
                    </th>
                    <th 
                      className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('local')}
                    >
                      <span className="flex items-center justify-center">
                        Local {getSortIcon('local')}
                      </span>
                    </th>
                    <th 
                      className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('aterro')}
                    >
                      <span className="flex items-center justify-center">
                        Aterro {getSortIcon('aterro')}
                      </span>
                    </th>
                    <th 
                      className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('areia')}
                    >
                      <span className="flex items-center justify-center">
                        Areia {getSortIcon('areia')}
                      </span>
                    </th>
                    <th 
                      className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('botaFora')}
                    >
                      <span className="flex items-center justify-center">
                        Bota Fora {getSortIcon('botaFora')}
                      </span>
                    </th>
                    <th 
                      className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('vegetal')}
                    >
                      <span className="flex items-center justify-center">
                        Vegetal {getSortIcon('vegetal')}
                      </span>
                    </th>
                    <th 
                      className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('bgs')}
                    >
                      <span className="flex items-center justify-center">
                        BGS {getSortIcon('bgs')}
                      </span>
                    </th>
                    <th 
                      className="px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('total')}
                    >
                      <span className="flex items-center justify-center">
                        Total {getSortIcon('total')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((row, index) => {
                    const locaisCount = prefixoLocaisCount.get(row.prefixo)?.size || 1;
                    const hasMultipleLocais = locaisCount > 1;
                    return (
                      <tr 
                        key={index} 
                        className={`border-t border-gray-200 ${getRowClassName(row, index)} hover:bg-blue-50/50`}
                      >
                        <td className="border-r border-gray-200 px-3 py-1.5 font-medium text-xs text-gray-900">
                          <div className="flex items-center gap-1">
                            {row.prefixo}
                            {hasMultipleLocais && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white">
                                {locaisCount}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-700">{row.motorista}</td>
                        <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-700">{row.local}</td>
                        <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.aterro || '-'}</td>
                        <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.areia || '-'}</td>
                        <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.botaFora || '-'}</td>
                        <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.vegetal || '-'}</td>
                        <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.bgs || '-'}</td>
                        <td className="px-3 py-1.5 text-center font-bold text-xs text-gray-900 bg-gray-100">{row.total}</td>
                      </tr>
                    );
                  })}
                  {sortedData.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center text-gray-500 py-8 text-xs">
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Inactive Caminhoes Section */}
            {showInactive && inactiveCaminhoes.length > 0 && (
              <div className="mt-4">
                <div className="bg-gray-600 text-white text-center py-2 mb-0 rounded-t-md">
                  <h2 className="text-sm font-bold">
                    🚫 Caminhões Sem Produção ({inactiveCaminhoes.length})
                  </h2>
                </div>
                <div className="border border-t-0 border-gray-300 rounded-b-md overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-500 text-white">
                        <th className="border-r border-gray-400 px-3 py-2 text-left font-semibold text-xs">Prefixo</th>
                        <th className="border-r border-gray-400 px-3 py-2 text-center font-semibold text-xs">Motorista</th>
                        <th className="px-3 py-2 text-center font-semibold text-xs">Empresa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inactiveCaminhoes.map((cam, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="border-r border-gray-200 px-3 py-1.5 font-medium text-xs text-gray-700">{cam.prefixo}</td>
                          <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{cam.motorista || '-'}</td>
                          <td className="px-3 py-1.5 text-center text-xs text-gray-600">{cam.empresa || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
              <span>Data: {selectedDate}</span>
              <span className="font-medium">ApropriAPP - Gestão Inteligente</span>
              <span>Gerado em {new Date().toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          
          /* Hide everything on the page */
          body > * {
            display: none !important;
          }
          
          /* Show only the print report */
          #print-report-caminhoes {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            z-index: 99999 !important;
            background: white !important;
          }
          
          /* Preserve colors */
          .bg-\\[\\#16a34a\\] {
            background-color: #16a34a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .bg-\\[\\#f59e0b\\] {
            background-color: #f59e0b !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .bg-\\[\\#1e3a5f\\] {
            background-color: #1e3a5f !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .bg-\\[\\#2d4a6f\\] {
            background-color: #2d4a6f !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .bg-gray-50 {
            background-color: #f9fafb !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .bg-gray-100 {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .text-white {
            color: white !important;
          }
          
          table {
            page-break-inside: avoid !important;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
}
