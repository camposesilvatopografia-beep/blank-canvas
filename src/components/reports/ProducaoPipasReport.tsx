import { useRef, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Printer, X, MessageCircle, Image, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface PipaReportData {
  prefixo: string;
  empresa: string;
  capacidade: number;
  viagens: number;
}

interface LocalGroup {
  local: string;
  items: PipaReportData[];
  total: number;
}

interface ProducaoPipasReportProps {
  data: LocalGroup[];
  selectedDate: string;
  totalPipas: number;
  totalViagens: number;
  volumeAgua: number;
  onClose?: () => void;
}

type SortField = 'prefixo' | 'empresa' | 'capacidade' | 'viagens';
type SortDirection = 'asc' | 'desc' | null;

const formatLocalTitle = (local: string) => {
  const lower = local.toLowerCase();
  if (lower === 'produção' || lower === 'producao') return 'na Produção';
  if (lower === 'recicladora') return 'na Recicladora';
  return local;
};

export function ProducaoPipasReport({
  data,
  selectedDate,
  totalPipas,
  totalViagens,
  volumeAgua,
  onClose
}: ProducaoPipasReportProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [sortField, setSortField] = useState<SortField>('viagens');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');

  const sortItems = (items: PipaReportData[]) => {
    if (!sortDirection || !sortField) return items;
    
    return [...items].sort((a, b) => {
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
    const contentEl = document.getElementById('pipas-report-content');
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
        <title>Produção de Pipas - ${selectedDate}</title>
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

  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();
    
    const excelData: any[] = [];
    
    data.forEach(localGroup => {
      localGroup.items.forEach((item, idx) => {
        excelData.push({
          'Tipo Local': localGroup.local,
          'Nº': idx + 1,
          'Prefixo': item.prefixo,
          'Empresa': item.empresa,
          'Capacidade (L)': item.capacidade,
          'Nº de Viagens': item.viagens,
        });
      });
      excelData.push({
        'Tipo Local': '',
        'Nº': '',
        'Prefixo': '',
        'Empresa': '',
        'Capacidade (L)': 'Total geral',
        'Nº de Viagens': localGroup.total,
      });
    });
    
    excelData.push({});
    excelData.push({
      'Tipo Local': 'RESUMO',
      'Nº': '',
      'Prefixo': 'Total de Pipas',
      'Empresa': totalPipas,
      'Capacidade (L)': 'Total Viagens',
      'Nº de Viagens': totalViagens,
    });
    
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Pipas');
    XLSX.writeFile(wb, `producao-pipas-${selectedDate.replace(/\//g, '-')}.xlsx`);
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
      link.download = `producao-pipas-${selectedDate.replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Erro ao exportar imagem:', error);
    }
  };

  const handleWhatsAppExport = () => {
    let message = `💧 *PRODUÇÃO DOS PIPAS*\n`;
    message += `📅 Data: ${selectedDate}\n\n`;
    
    message += `*📊 INDICADORES:*\n`;
    message += `• Total de Pipas: *${totalPipas}*\n`;
    message += `• Total de Viagens: *${formatNumber(totalViagens)}*\n`;
    message += `• Volume Estimado: *${formatNumber(volumeAgua)} L*\n\n`;
    
    if (data.length > 0) {
      data.forEach(localGroup => {
        message += `*📍 Pipas ${formatLocalTitle(localGroup.local)}* (${localGroup.total} viagens)\n`;
        localGroup.items.slice(0, 5).forEach((item, idx) => {
          message += `${idx + 1}. ${item.prefixo}: ${item.viagens} viagens\n`;
        });
        if (localGroup.items.length > 5) {
          message += `... e mais ${localGroup.items.length - 5} pipas\n`;
        }
        message += '\n';
      });
    }
    
    message += `_Gerado em ${new Date().toLocaleString('pt-BR')}_`;
    message += `\n_ApropriAPP - Gestão Inteligente_`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  return (
    <>
      {/* Screen Modal */}
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 print:hidden">
        <div 
          ref={reportRef}
          className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-auto"
        >
          {/* Action Buttons - Top */}
          <div className="flex justify-end gap-2 px-5 py-3 border-b bg-gray-50 sticky top-0 z-10">
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
              onClick={handleExportXLSX} 
              className="gap-1.5 h-9 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
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
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 h-9">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Button size="sm" onClick={handleExportPDF} className="gap-1.5 h-9 bg-secondary hover:bg-secondary/90">
              <FileDown className="w-4 h-4" />
              PDF
            </Button>
          </div>

          <div className="p-5" id="pipas-report-content">
            {/* Header with logo and obra data */}
            <div className="bg-primary text-primary-foreground rounded-lg px-6 py-4 mb-5 flex items-center gap-4">
              <img src={activeLogo} alt="Logo" className="h-14 w-auto object-contain bg-white/15 rounded-lg p-1" />
              <div className="flex-1">
                {obraConfig.nome && <p className="text-sm font-semibold opacity-90">{obraConfig.nome}</p>}
                {obraConfig.local && <p className="text-xs opacity-70">📍 {obraConfig.local}</p>}
                <h1 className="text-xl font-bold mt-0.5">💧 Produção dos Pipas</h1>
              </div>
              <div className="text-sm opacity-80 text-right shrink-0">
                📅 {selectedDate}
              </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-[#1e3a5f] text-white rounded-xl px-5 py-4 text-center shadow-md">
                <p className="text-[10px] font-semibold uppercase tracking-widest opacity-85">Total de Pipas</p>
                <p className="text-4xl font-extrabold mt-1">{totalPipas}</p>
              </div>
              <div className="bg-[#16a34a] text-white rounded-xl px-5 py-4 text-center shadow-md">
                <p className="text-[10px] font-semibold uppercase tracking-widest opacity-90">Total de Viagens</p>
                <p className="text-4xl font-extrabold mt-1">{formatNumber(totalViagens)}</p>
              </div>
              <div className="bg-[#f59e0b] text-white rounded-xl px-5 py-4 text-center shadow-md flex flex-col items-center justify-center">
                <p className="text-sm font-bold tracking-wide">Movimentação Diária</p>
              </div>
            </div>

            {/* Tables by Tipo Local */}
            {data.map((localGroup, groupIdx) => (
              <div key={localGroup.local} className={groupIdx > 0 ? 'mt-8' : ''}>
                {/* Section Title - centered text */}
                <h2 className="text-center font-bold text-gray-800 text-base mb-2">
                  Pipas {formatLocalTitle(localGroup.local)}
                </h2>

                {/* Data Table */}
                <div className="border border-gray-400 rounded-md overflow-hidden shadow-sm">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-secondary">
                        <th className="border-r border-secondary/50 px-3 py-3 text-center font-bold text-xs text-secondary-foreground uppercase tracking-wider w-12">Nº</th>
                        <th 
                          className="border-r border-secondary/50 px-3 py-3 text-left font-bold text-xs text-secondary-foreground uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors"
                          onClick={() => handleSort('prefixo')}
                        >
                          <span className="flex items-center">
                            Prefixo {getSortIcon('prefixo')}
                          </span>
                        </th>
                        <th 
                          className="border-r border-secondary/50 px-3 py-3 text-center font-bold text-xs text-secondary-foreground uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors"
                          onClick={() => handleSort('empresa')}
                        >
                          <span className="flex items-center justify-center">
                            Empresa {getSortIcon('empresa')}
                          </span>
                        </th>
                        <th 
                          className="border-r border-secondary/50 px-3 py-3 text-center font-bold text-xs text-secondary-foreground uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors"
                          onClick={() => handleSort('capacidade')}
                        >
                          <span className="flex items-center justify-center">
                            Capacidade (L) {getSortIcon('capacidade')}
                          </span>
                        </th>
                        <th 
                          className="px-3 py-3 text-center font-bold text-xs text-secondary-foreground uppercase tracking-wider cursor-pointer hover:bg-secondary/80 transition-colors"
                          onClick={() => handleSort('viagens')}
                        >
                          <span className="flex items-center justify-center">
                            Nº Viagens {getSortIcon('viagens')}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortItems(localGroup.items).map((item, index) => (
                        <tr 
                          key={`${item.prefixo}-${index}`} 
                          className={`border-b border-gray-200 transition-colors ${
                            index % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100/80'
                          } hover:bg-blue-50/60`}
                        >
                          <td className="border-r border-gray-300 px-3 py-2.5 text-center text-sm font-medium text-gray-500">{index + 1}</td>
                          <td className="border-r border-gray-300 px-3 py-2.5 font-semibold text-sm text-gray-900">{item.prefixo}</td>
                          <td className="border-r border-gray-300 px-3 py-2.5 text-center text-sm text-gray-700">{item.empresa}</td>
                          <td className="border-r border-gray-300 px-3 py-2.5 text-center text-sm text-gray-700 font-medium">{formatNumber(item.capacidade)}</td>
                          <td className="px-3 py-2.5 text-center font-bold text-sm text-gray-900">{item.viagens}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Total Row */}
                  <div className="border-t-2 border-gray-400 bg-gray-200 px-4 py-3">
                    <div className="flex justify-end items-center gap-6 pr-3">
                      <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Total geral</span>
                      <span className="text-xl font-black text-gray-900 min-w-[40px] text-center">{localGroup.total}</span>
                    </div>
                  </div>
                  
                  {/* Pagination info */}
                  <div className="border-t border-gray-300 bg-gray-100 px-3 py-1.5">
                    <div className="flex justify-end items-center gap-2 text-xs text-gray-500">
                      <span>1 - {localGroup.items.length} de {localGroup.items.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Footer */}
            <div className="mt-6 pt-3 border-t border-gray-200 flex justify-between items-center text-xs text-gray-400">
              <span>Data: {selectedDate}</span>
              <span className="font-medium text-gray-500">ApropriAPP - Gestão Inteligente</span>
              <span>Gerado em {new Date().toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}