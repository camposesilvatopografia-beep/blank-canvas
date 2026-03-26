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

interface EscavadeiraReportData {
  codigo: string;
  potencia: string;
  operador: string;
  local: string;
  aterro: number;
  areia: number;
  botaFora: number;
  vegetal: number;
  bgs: number;
  total: number;
}

interface InactiveEscavadeira {
  codigo: string;
  operador: string;
  empresa: string;
}

interface ProducaoEscavadeirasReportProps {
  data: EscavadeiraReportData[];
  selectedDate: string;
  totalViagens: number;
  totalEquipamentos: number;
  totalCaminhoes: number;
  mediaPorCaminhao: number;
  inactiveEscavadeiras?: InactiveEscavadeira[];
  onClose?: () => void;
}

type SortField = 'codigo' | 'potencia' | 'operador' | 'local' | 'aterro' | 'areia' | 'botaFora' | 'vegetal' | 'bgs' | 'total';
type SortDirection = 'asc' | 'desc' | null;

export function ProducaoEscavadeirasReport({
  data,
  selectedDate,
  totalViagens,
  totalEquipamentos,
  totalCaminhoes,
  mediaPorCaminhao,
  inactiveEscavadeiras = [],
  onClose
}: ProducaoEscavadeirasReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [sortField, setSortField] = useState<SortField>('codigo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showSettings, setShowSettings] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [showColumns, setShowColumns] = useState({
    potencia: true,
    operador: true,
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
      if (!countMap.has(row.codigo)) countMap.set(row.codigo, new Set());
      countMap.get(row.codigo)!.add(row.local);
    });
    return countMap;
  }, [data]);

  const prefixosMultiplosLocais = useMemo(() => {
    return new Set(
      Array.from(prefixoLocaisCount.entries())
        .filter(([_, locais]) => locais.size > 1)
        .map(([codigo]) => codigo)
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
      if (prefixosMultiplosLocais.has(row.codigo) && !map.has(row.codigo)) {
        map.set(row.codigo, MULTI_LOCATION_COLORS[colorIndex % MULTI_LOCATION_COLORS.length]);
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

  const getRowClassName = (row: EscavadeiraReportData, index: number) => {
    const baseClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    if (prefixosMultiplosLocais.has(row.codigo)) {
      return prefixoColorMap.get(row.codigo) || baseClass;
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

  const handlePrint = async () => {
    const contentElement = document.getElementById('report-content');
    if (!contentElement) return;

    try {
      setIsPdfExporting(true);
      const logoBase64 = await toBase64(activeLogo);
      await new Promise(resolve => setTimeout(resolve, 300));
      const logoEl = document.getElementById('pdf-logo-img') as HTMLImageElement;
      if (logoEl) logoEl.src = logoBase64;

      const canvas = await html2canvas(contentElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      setIsPdfExporting(false);
      const imgData = canvas.toDataURL('image/png');

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Produção das Escavadeiras - ${selectedDate}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { padding: 0; }
            img { max-width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <img src="${imgData}" alt="Relatório" />
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 100); };
    } catch (error) {
      setIsPdfExporting(false);
      console.error('Erro ao imprimir:', error);
    }
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
    const contentElement = document.getElementById('report-content');
    if (!contentElement) return;

    try {
      setIsPdfExporting(true);
      const logoBase64 = await toBase64(activeLogo);
      // Wait for state to render, then inject base64 logo
      await new Promise(resolve => setTimeout(resolve, 300));
      const logoEl = document.getElementById('pdf-logo-img') as HTMLImageElement;
      if (logoEl) logoEl.src = logoBase64;

      const canvas = await html2canvas(contentElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      setIsPdfExporting(false);
      
      const imgData = canvas.toDataURL('image/png');
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Produção das Escavadeiras - ${selectedDate}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
            body { padding: 0; }
            .report-img { max-width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <img class="report-img" src="${imgData}" alt="Relatório de Produção" />
        </body>
        </html>
      `;
      
      printWindow.document.write(reportHtml);
      printWindow.document.close();
      printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 100); };
    } catch (error) {
      setIsPdfExporting(false);
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
      link.download = `producao-escavadeiras-${selectedDate.replace(/\//g, '-')}.png`;
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
      'Código': row.codigo,
      'Potência': row.potencia,
      'Operador': row.operador,
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
      'Código': '',
      'Potência': '',
      'Operador': '',
      'Local': '',
      'Aterro': sortedData.reduce((s, r) => s + r.aterro, 0),
      'Areia': sortedData.reduce((s, r) => s + r.areia, 0),
      'Bota Fora': sortedData.reduce((s, r) => s + r.botaFora, 0),
      'Vegetal': sortedData.reduce((s, r) => s + r.vegetal, 0),
      'BGS': sortedData.reduce((s, r) => s + r.bgs, 0),
      'Total': totalViagens,
    });
    
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Escavadeiras');
    XLSX.writeFile(wb, `escavadeiras-${selectedDate.replace(/\//g, '-')}.xlsx`);
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');
  const formatRounded = (num: number) => Math.round(num).toLocaleString('pt-BR');

  const handleWhatsAppExport = () => {
    let message = `*🚜 PRODUÇÃO DAS ESCAVADEIRAS*\n`;
    message += `📅 Data: ${selectedDate}\n\n`;
    
    message += `*📊 INDICADORES:*\n`;
    message += `• Total de Viagens: *${formatNumber(totalViagens)}*\n`;
    message += `• Equipamentos: *${totalEquipamentos}*\n`;
    message += `• Caminhões: *${totalCaminhoes}*\n`;
    message += `• Média p/ Caminhão: *${formatRounded(mediaPorCaminhao)}*\n\n`;
    
    if (data.length > 0) {
      message += `*🚜 VIAGENS POR ESCAVADEIRA:*\n`;
      data.slice(0, 10).forEach((row, idx) => {
        message += `${idx + 1}. ${row.codigo} (${row.operador}): *${row.total}* viagens\n`;
      });
      if (data.length > 10) {
        message += `... e mais ${data.length - 10} equipamentos\n`;
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
      <div id="print-report-escavadeiras" className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999]">
        <div className="p-4">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-[#16a34a] text-white rounded-lg px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-95">Total de Viagens</p>
              <p className="text-3xl font-bold mt-0.5">{formatNumber(totalViagens)}</p>
            </div>
            <div className="bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Equipamentos</p>
              <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalEquipamentos}</p>
            </div>
            <div className="bg-[#16a34a] text-white rounded-lg px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-95">Caminhões</p>
              <p className="text-3xl font-bold mt-0.5">{totalCaminhoes}</p>
            </div>
            <div className="bg-[#dc2626] text-white rounded-lg px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-95">Média p/ Caminhão</p>
              <p className="text-3xl font-bold mt-0.5">{formatRounded(mediaPorCaminhao)}</p>
            </div>
          </div>

          {/* Title Bar */}
          <div className="bg-[#1e3a5f] text-white text-center py-2.5 mb-0">
            <h1 className="text-base font-bold tracking-wide">
              Nº de Viagens por Escavadeira
            </h1>
          </div>

          {/* Data Table */}
          <div className="border border-t-0 border-gray-300 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#2d4a6f] text-white">
                  <th className="border-r border-[#3d5a7f] px-3 py-2 text-left font-semibold text-xs">
                    Código {sortField === 'codigo' && sortDirection === 'asc' ? '▲' : sortField === 'codigo' && sortDirection === 'desc' ? '▼' : ''}
                  </th>
                  <th className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs">Potência</th>
                  <th className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs">Operador</th>
                  <th className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs">Local</th>
                  <th className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs">Aterro</th>
                  <th className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs">Areia</th>
                  <th className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs">Bota Fora</th>
                  <th className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs">Vegetal</th>
                  <th className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs">BGS</th>
                  <th className="px-3 py-2 text-center font-semibold text-xs">
                    Total {sortField === 'total' && sortDirection === 'asc' ? '▲' : sortField === 'total' && sortDirection === 'desc' ? '▼' : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row, index) => {
                  const locaisCount = prefixoLocaisCount.get(row.codigo)?.size || 1;
                  const hasMultipleLocais = locaisCount > 1;
                  return (
                    <tr key={index} className={getRowClassName(row, index)}>
                      <td className="border-r border-gray-200 px-3 py-1.5 font-medium text-xs text-gray-900">
                        <div className="flex items-center gap-1">
                          {row.codigo}
                          {hasMultipleLocais && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-600 text-white">
                              {locaisCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-700">{row.potencia}</td>
                      <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-700">{row.operador}</td>
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
          <div className="flex justify-end gap-2 px-5 py-3 border-b bg-gray-50">
            <Button 
              variant={showSettings ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowSettings(!showSettings)} 
              className="gap-1.5 h-9"
            >
              <Settings className="w-4 h-4" />
              Configurar
            </Button>
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

          {/* Settings Panel */}
          {showSettings && (
            <div className="px-5 py-4 border-b bg-blue-50/50">
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 w-full">
                  <ChevronDown className="w-4 h-4" />
                  Configurações do Relatório
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Toggle Inactive Equipment */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Dados Adicionais</h4>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="show-inactive-esc"
                          checked={showInactive}
                          onCheckedChange={setShowInactive}
                        />
                        <Label htmlFor="show-inactive-esc" className="text-sm cursor-pointer">
                          Mostrar equipamentos inativos ({inactiveEscavadeiras.length})
                        </Label>
                      </div>
                    </div>
                    
                    {/* Toggle Columns */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Colunas Visíveis</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(showColumns).map(([key, value]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Switch
                              id={`col-${key}`}
                              checked={value}
                              onCheckedChange={(checked) => setShowColumns(prev => ({ ...prev, [key]: checked }))}
                            />
                            <Label htmlFor={`col-${key}`} className="text-xs cursor-pointer capitalize">
                              {key === 'botaFora' ? 'Bota Fora' : key}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Report Content for Screen */}
          <div className="p-5" id="report-content">
          {/* Header with logo and obra info */}
          {isPdfExporting ? (
            <div style={{ background: 'linear-gradient(135deg,#1a2e6e,#1d3557)', borderRadius: 10, padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <img id="pdf-logo-img" src={activeLogo} alt="Logo" style={{ height: 56, width: 'auto', objectFit: 'contain', background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 4 }} />
              <div style={{ flex: 1 }}>
                {obraConfig.nome && <p style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 13, marginBottom: 1 }}>{obraConfig.nome}</p>}
                {obraConfig.local && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginBottom: 4 }}>📍 {obraConfig.local}</p>}
                <p style={{ color: 'white', fontWeight: 800, fontSize: 16, letterSpacing: 1 }}>PRODUÇÃO DAS ESCAVADEIRAS</p>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, textAlign: 'right' }}>📅 {selectedDate}</div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-200">
              <img src={activeLogo} alt="Logo" className="h-11 w-auto object-contain bg-gray-100 rounded-lg p-1" />
              <div className="flex-1 min-w-0">
                {obraConfig.nome && <p className="font-bold text-gray-900 text-sm leading-tight">{obraConfig.nome}</p>}
                {obraConfig.local && <p className="text-[11px] text-gray-500 leading-tight">📍 {obraConfig.local}</p>}
                <p className="font-bold text-[#1e3a5f] text-sm mt-0.5">PRODUÇÃO DAS ESCAVADEIRAS</p>
              </div>
              <span className="text-xs text-gray-500 shrink-0">📅 {selectedDate}</span>
            </div>
          )}
            {/* KPI Cards Row */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-[#16a34a] text-white rounded-lg px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-95">Total de Viagens</p>
                <p className="text-3xl font-bold mt-0.5">{formatNumber(totalViagens)}</p>
              </div>
              <div className="bg-white border-2 border-gray-300 rounded-lg px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Equipamentos</p>
                <p className="text-3xl font-bold text-gray-800 mt-0.5">{totalEquipamentos}</p>
              </div>
              <div className="bg-[#16a34a] text-white rounded-lg px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-95">Caminhões</p>
                <p className="text-3xl font-bold mt-0.5">{totalCaminhoes}</p>
              </div>
              <div className="bg-[#dc2626] text-white rounded-lg px-4 py-3 text-center shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-95">Média p/ Caminhão</p>
                <p className="text-3xl font-bold mt-0.5">{formatRounded(mediaPorCaminhao)}</p>
              </div>
            </div>

            {/* Title Bar */}
            <div className="bg-[#1e3a5f] text-white text-center py-2.5 mb-0 rounded-t-md">
              <h1 className="text-base font-bold tracking-wide">
                Nº de Viagens por Escavadeira
              </h1>
            </div>

            {/* Data Table */}
            <div className="border border-t-0 border-gray-300 rounded-b-md overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#2d4a6f] text-white">
                    <th 
                      className="border-r border-[#3d5a7f] px-3 py-2 text-left font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                      onClick={() => handleSort('codigo')}
                    >
                      <span className="flex items-center">
                        Código {getSortIcon('codigo')}
                      </span>
                    </th>
                    {showColumns.potencia && (
                      <th 
                        className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                        onClick={() => handleSort('potencia')}
                      >
                        <span className="flex items-center justify-center">
                          Potência {getSortIcon('potencia')}
                        </span>
                      </th>
                    )}
                    {showColumns.operador && (
                      <th 
                        className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                        onClick={() => handleSort('operador')}
                      >
                        <span className="flex items-center justify-center">
                          Operador {getSortIcon('operador')}
                        </span>
                      </th>
                    )}
                    {showColumns.local && (
                      <th 
                        className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                        onClick={() => handleSort('local')}
                      >
                        <span className="flex items-center justify-center">
                          Local {getSortIcon('local')}
                        </span>
                      </th>
                    )}
                    {showColumns.aterro && (
                      <th 
                        className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                        onClick={() => handleSort('aterro')}
                      >
                        <span className="flex items-center justify-center">
                          Aterro {getSortIcon('aterro')}
                        </span>
                      </th>
                    )}
                    {showColumns.areia && (
                      <th 
                        className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                        onClick={() => handleSort('areia')}
                      >
                        <span className="flex items-center justify-center">
                          Areia {getSortIcon('areia')}
                        </span>
                      </th>
                    )}
                    {showColumns.botaFora && (
                      <th 
                        className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                        onClick={() => handleSort('botaFora')}
                      >
                        <span className="flex items-center justify-center">
                          Bota Fora {getSortIcon('botaFora')}
                        </span>
                      </th>
                    )}
                    {showColumns.vegetal && (
                      <th 
                        className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                        onClick={() => handleSort('vegetal')}
                      >
                        <span className="flex items-center justify-center">
                          Vegetal {getSortIcon('vegetal')}
                        </span>
                      </th>
                    )}
                    {showColumns.bgs && (
                      <th 
                        className="border-r border-[#3d5a7f] px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#3d5a7f] transition-colors"
                        onClick={() => handleSort('bgs')}
                      >
                        <span className="flex items-center justify-center">
                          BGS {getSortIcon('bgs')}
                        </span>
                      </th>
                    )}
                    <th 
                      className="px-3 py-2 text-center font-semibold text-xs cursor-pointer hover:bg-[#1a3a5f] transition-colors bg-[#1b4332] text-white"
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
                    const locaisCount = prefixoLocaisCount.get(row.codigo)?.size || 1;
                    const hasMultipleLocais = locaisCount > 1;
                    return (
                      <tr 
                        key={index} 
                        className={`border-t border-gray-200 ${getRowClassName(row, index)} hover:bg-blue-50/50`}
                      >
                        <td className="border-r border-gray-200 px-3 py-1.5 font-medium text-xs text-gray-900">
                          <div className="flex items-center gap-1">
                            {row.codigo}
                            {hasMultipleLocais && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-600 text-white">
                                {locaisCount}
                              </span>
                            )}
                          </div>
                        </td>
                        {showColumns.potencia && <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-700">{row.potencia}</td>}
                        {showColumns.operador && <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-700">{row.operador}</td>}
                        {showColumns.local && <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-700">{row.local}</td>}
                        {showColumns.aterro && <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.aterro || '-'}</td>}
                        {showColumns.areia && <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.areia || '-'}</td>}
                        {showColumns.botaFora && <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.botaFora || '-'}</td>}
                        {showColumns.vegetal && <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.vegetal || '-'}</td>}
                        {showColumns.bgs && <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-600">{row.bgs || '-'}</td>}
                        <td className="px-3 py-1.5 text-center font-bold text-xs text-white bg-[#1b4332]">{row.total}</td>
                      </tr>
                    );
                  })}
                  {sortedData.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center text-gray-500 py-8 text-xs">
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Inactive Equipment Section */}
            {showInactive && inactiveEscavadeiras.length > 0 && (
              <div className="mt-4">
                <div className="bg-gray-700 text-white text-center py-2 rounded-t-md">
                  <h2 className="text-sm font-semibold">Equipamentos sem Produção ({inactiveEscavadeiras.length})</h2>
                </div>
                <div className="border border-t-0 border-gray-300 rounded-b-md overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-500 text-white">
                        <th className="border-r border-gray-400 px-3 py-2 text-left font-semibold text-xs">Código</th>
                        <th className="border-r border-gray-400 px-3 py-2 text-center font-semibold text-xs">Operador</th>
                        <th className="px-3 py-2 text-center font-semibold text-xs">Empresa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inactiveEscavadeiras.map((item, idx) => (
                        <tr key={idx} className={`border-t border-gray-200 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                          <td className="border-r border-gray-200 px-3 py-1.5 font-medium text-xs text-gray-500">{item.codigo}</td>
                          <td className="border-r border-gray-200 px-3 py-1.5 text-center text-xs text-gray-500">{item.operador || '-'}</td>
                          <td className="px-3 py-1.5 text-center text-xs text-gray-500">{item.empresa || '-'}</td>
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
          #print-report-escavadeiras {
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
          
          .bg-\\[\\#dc2626\\] {
            background-color: #dc2626 !important;
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
