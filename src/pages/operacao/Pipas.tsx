import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Droplets, Truck, FileDown, Plus, Loader2, RefreshCw, Database, Edit2, MapPin, MessageCircle, BarChart3, FileSpreadsheet, Trash2, BarChart2, Settings2 } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { PipaModal } from '@/components/crud/PipaModal';
import { PipasWhatsAppModal } from '@/components/reports/PipasWhatsAppModal';
import { ProducaoPipasReport } from '@/components/reports/ProducaoPipasReport';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { useColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { ColumnConfigModal } from '@/components/crud/ColumnConfigModal';
import { usePageLayout, BlockDefinition } from '@/hooks/usePageLayout';

const PIPAS_LAYOUT_BLOCKS: BlockDefinition[] = [
  { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
  { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
  { key: 'date_filter', defaultLabel: 'Filtro de Data' },
  { key: 'table', defaultLabel: 'Tabela de Registros' },
  { key: 'reports', defaultLabel: 'Relatórios' },
];

const PIPAS_COLUMNS: ColumnDefinition[] = [
  { key: 'data', defaultLabel: 'DATA' },
  { key: 'prefixo', defaultLabel: 'PREFIXO' },
  { key: 'empresa', defaultLabel: 'EMPRESA' },
  { key: 'motorista', defaultLabel: 'MOTORISTA' },
  { key: 'capacidade', defaultLabel: 'CAPACIDADE' },
  { key: 'local', defaultLabel: 'LOCAL' },
  { key: 'viagens', defaultLabel: 'VIAGENS' },
  { key: 'acoes', defaultLabel: 'AÇÕES' },
];

interface PipaRecord {
  id: string;
  data: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  capacidade: number;
  horaChegada: string;
  horaSaida: string;
  viagens: number;
  localTrabalho: string;
  tipoLocal: string;
  rowIndex: number;
}

export default function Pipas() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTipoLocal, setSelectedTipoLocal] = useState<string>('todos');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [allData, setAllData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<PipaRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [showPipasReport, setShowPipasReport] = useState(false);
  const [editRecord, setEditRecord] = useState<PipaRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<PipaRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { readSheet, deleteRow, loading } = useGoogleSheets();
  const { toast } = useToast();
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const { isBlockVisible } = usePageLayout('operacao_pipas', PIPAS_LAYOUT_BLOCKS);
  const { configs: pipasConfigs, getLabel: piGetLabel, isVisible: piIsVisible, getStyle: piGetStyle, getHeaderStyle: piGetHeaderStyle, saveConfigs: piSaveConfigs } = useColumnConfig('pipas_registros', PIPAS_COLUMNS);
  const [showColumnConfig, setShowColumnConfig] = useState(false);

  const [stats, setStats] = useState({
    totalViagens: 0,
    pipasAtivas: 0,
    volumeAgua: 0,
  });

  // Get unique tipo local values
  const availableTipoLocais = useMemo(() => {
    const tipos = new Set<string>();
    records.forEach(rec => {
      if (rec.tipoLocal) tipos.add(rec.tipoLocal);
    });
    return Array.from(tipos).sort();
  }, [records]);

  // Filter records by selected tipo local
  const filteredRecords = useMemo(() => {
    let result = records;
    if (selectedTipoLocal !== 'todos') {
      result = result.filter(rec => rec.tipoLocal === selectedTipoLocal);
    }
    return result;
  }, [records, selectedTipoLocal]);
  const pipasSort = useTableSort(filteredRecords);

  // Calculate stats based on filtered records
  const filteredStats = useMemo(() => {
    const pipas = new Set(filteredRecords.map(r => r.prefixo));
    const totalViagens = filteredRecords.reduce((sum, r) => sum + r.viagens, 0);
    const volumeAgua = filteredRecords.reduce((sum, r) => sum + (r.capacidade * r.viagens), 0);
    return { totalViagens, pipasAtivas: pipas.size, volumeAgua };
  }, [filteredRecords]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const data = await readSheet('Apontamento_Pipa');
      if (data.length > 1) {
        const hdrs = data[0];
        setHeaders(hdrs);
        setAllData(data);
        
        const dateIdx = hdrs.indexOf('Data');
        const dates = [...new Set(data.slice(1).map(row => row[dateIdx]).filter(Boolean))];
        
        // Sort dates in descending order
        const sortedDates = dates.sort((a, b) => {
          const [da, ma, ya] = a.split('/').map(Number);
          const [db, mb, yb] = b.split('/').map(Number);
          return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });
        
        setAvailableDates(sortedDates);
        
        // Select most recent date or today if available
        const today = format(new Date(), 'dd/MM/yyyy');
        if (sortedDates.includes(today)) {
          setSelectedDate(today);
        } else if (sortedDates.length > 0 && !selectedDate) {
          setSelectedDate(sortedDates[0]);
        }
      }
    } catch (error) {
      console.error('Error loading pipas data:', error);
    }
  };

  const processDataForDate = useCallback((dateStr: string) => {
    if (!allData.length || !headers.length || !dateStr) return;
    
    const getIdx = (name: string) => {
      const idx = headers.indexOf(name);
      if (idx !== -1) return idx;
      return headers.findIndex((h: string) => h?.toLowerCase() === name.toLowerCase());
    };
    
    // Find the local de trabalho column - try multiple possible header names
    const localIdx = (() => {
      let idx = getIdx('Local de Trabalho');
      if (idx === -1) idx = getIdx('Tipo_Local');
      if (idx === -1) idx = getIdx('Local_Trabalho');
      if (idx === -1) idx = getIdx('Local');
      return idx;
    })();
    
    console.log('[Pipas] Header indices:', { 
      headers,
      localIdx,
    });
    
    const todayRecords = allData.slice(1)
      .map((row, idx) => ({ row, rowIndex: idx + 1 }))
      .filter(({ row }) => row[getIdx('Data')] === dateStr)
      .map(({ row, rowIndex }) => {
        const tipoLocal = localIdx !== -1 ? (row[localIdx] || '') : '';
        
        return {
          id: row[getIdx('ID_Pipa')] || '',
          data: row[getIdx('Data')] || '',
          prefixo: row[getIdx('Prefixo')] || '',
          descricao: row[getIdx('Descricao')] || '',
          empresa: row[getIdx('Empresa')] || '',
          motorista: row[getIdx('Motorista')] || '',
          capacidade: parseFloat(String(row[getIdx('Capacidade')] || 0).replace('.', '').replace(',', '.')),
          horaChegada: '',
          horaSaida: '',
          viagens: parseInt(row[getIdx('N_Viagens')] || '1'),
          localTrabalho: tipoLocal,
          tipoLocal,
          rowIndex,
        };
      });

    setRecords(todayRecords);

    const pipas = new Set(todayRecords.map(r => r.prefixo));
    const totalViagens = todayRecords.reduce((sum, r) => sum + r.viagens, 0);
    const volumeAgua = todayRecords.reduce((sum, r) => sum + (r.capacidade * r.viagens), 0);

    setStats({
      totalViagens,
      pipasAtivas: pipas.size,
      volumeAgua,
    });
    
    // Reset filter when date changes
    setSelectedTipoLocal('todos');
  }, [allData, headers]);

  useEffect(() => {
    if (selectedDate) {
      processDataForDate(selectedDate);
    }
  }, [selectedDate, processDataForDate]);

  const handleDateChange = (value: string) => {
    setSelectedDate(value);
  };

  const handleTipoLocalChange = (value: string) => {
    setSelectedTipoLocal(value);
  };

  const handleNewRecord = () => {
    setEditRecord(null);
    setModalOpen(true);
  };

  const handleEditRecord = (record: PipaRecord) => {
    setEditRecord(record);
    setModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRecord) return;
    setIsDeleting(true);
    try {
      const success = await deleteRow('Apontamento_Pipa', deleteRecord.rowIndex);
      if (success) {
        toast({ title: 'Excluído!', description: 'Registro removido com sucesso.' });
        setDeleteRecord(null);
        await loadAllData();
      } else {
        throw new Error('Falha ao excluir');
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir registro', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');

  const getDisplayDate = () => {
    if (!selectedDate) return format(new Date(), "dd 'de' MMMM", { locale: ptBR });
    const [day, month, year] = selectedDate.split('/').map(Number);
    return format(new Date(year, month - 1, day), "dd 'de' MMMM", { locale: ptBR });
  };

  // Aggregate data by vehicle for each tipo local (Produção/Recicladora)
  const getAggregatedDataByTipoLocal = () => {
    const byTipoLocal = new Map<string, Map<string, { prefixo: string; empresa: string; capacidade: number; viagens: number }>>();
    
    filteredRecords.forEach(rec => {
      const tipoLocal = rec.tipoLocal || 'Sem Tipo';
      if (!byTipoLocal.has(tipoLocal)) {
        byTipoLocal.set(tipoLocal, new Map());
      }
      
      const tipoMap = byTipoLocal.get(tipoLocal)!;
      const key = rec.prefixo;
      
      if (tipoMap.has(key)) {
        const existing = tipoMap.get(key)!;
        existing.viagens += rec.viagens;
      } else {
        tipoMap.set(key, {
          prefixo: rec.prefixo,
          empresa: rec.empresa || rec.motorista,
          capacidade: rec.capacidade,
          viagens: rec.viagens,
        });
      }
    });
    
    // Convert to array and sort
    const result: { local: string; items: { prefixo: string; empresa: string; capacidade: number; viagens: number }[]; total: number }[] = [];
    
    byTipoLocal.forEach((items, tipoLocal) => {
      const itemsArray = Array.from(items.values()).sort((a, b) => b.viagens - a.viagens);
      const total = itemsArray.reduce((sum, item) => sum + item.viagens, 0);
      result.push({ local: tipoLocal, items: itemsArray, total });
    });
    
    return result.sort((a, b) => b.total - a.total);
  };

  // Exportar para XLSX
  const handleExportXLSX = () => {
    const dataByLocal = getAggregatedDataByTipoLocal();
    const wb = XLSX.utils.book_new();
    
    const excelData: any[] = [];
    
    dataByLocal.forEach(localGroup => {
      localGroup.items.forEach((item, idx) => {
        excelData.push({
          'Local': localGroup.local,
          'Nº': idx + 1,
          'Prefixo': item.prefixo,
          'Empresa': item.empresa,
          'Capacidade (L)': item.capacidade,
          'Nº de Viagens': item.viagens,
        });
      });
      excelData.push({
        'Local': '',
        'Nº': '',
        'Prefixo': '',
        'Empresa': '',
        'Capacidade (L)': 'Total',
        'Nº de Viagens': localGroup.total,
      });
    });
    
    excelData.push({});
    excelData.push({
      'Local': 'RESUMO',
      'Nº': '',
      'Prefixo': `${stats.pipasAtivas} pipas`,
      'Empresa': '',
      'Capacidade (L)': `${stats.volumeAgua.toLocaleString('pt-BR')} L`,
      'Nº de Viagens': stats.totalViagens,
    });
    
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Pipas');
    XLSX.writeFile(wb, `pipas-${selectedDate.replace(/\//g, '-')}.xlsx`);
    
    toast({
      title: 'Exportado!',
      description: 'Arquivo Excel gerado com sucesso.',
    });
  };

  // Export to PDF - separated by tipo local, fits on one page
  const handleExportPDF = () => {
    const dataByLocal = getAggregatedDataByTipoLocal();
    const totalPipas = new Set(filteredRecords.map(r => r.prefixo)).size;
    const totalViagens = filteredRecords.reduce((sum, r) => sum + r.viagens, 0);
    
    // Calculate optimal layout - side by side if 2 locals, otherwise stacked compact
    const numLocals = dataByLocal.length;
    const useSideBySide = numLocals === 2;
    
    const generateLocalSection = (localData: { local: string; items: any[]; total: number }, compact: boolean = false) => `
      <div class="local-section ${compact ? 'compact' : ''}">
        <div class="section-title">Pipas ${localData.local}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px;"></th>
              <th>Prefixo</th>
              <th>Empresa</th>
              <th>Cap. (L)</th>
              <th>Viagens</th>
            </tr>
          </thead>
          <tbody>
            ${localData.items.map((item, idx) => `
              <tr>
                <td>${idx + 1}.</td>
                <td><strong>${item.prefixo}</strong></td>
                <td>${item.empresa}</td>
                <td>${formatNumber(item.capacidade)}</td>
                <td><strong>${item.viagens}</strong></td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"></td>
              <td><strong>Total</strong></td>
              <td><strong>${localData.total}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Produção dos Pipas - ${selectedDate}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 10px; font-size: 10px; max-height: 100vh; overflow: hidden; }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #1d3557; padding-bottom: 8px; }
          .header h1 { color: #1d3557; font-size: 18px; margin-bottom: 2px; }
          .stats-row { display: flex; gap: 15px; margin-bottom: 12px; justify-content: center; align-items: center; }
          .stat-box { border: 1px solid #ddd; border-radius: 6px; padding: 6px 16px; text-align: center; background: #fafafa; }
          .stat-box .value { font-size: 18px; font-weight: bold; color: #1d3557; }
          .stat-box .label { font-size: 9px; color: #666; }
          .movement-badge { 
            display: inline-block; 
            padding: 6px 16px; 
            background: linear-gradient(135deg, #fbbf24, #f59e0b); 
            color: #000; 
            font-weight: bold; 
            border-radius: 4px;
            font-size: 11px;
          }
          .locals-container { 
            display: ${useSideBySide ? 'flex' : 'block'}; 
            gap: 15px; 
            ${useSideBySide ? '' : 'columns: 2; column-gap: 15px;'}
          }
          .local-section { 
            ${useSideBySide ? 'flex: 1;' : 'break-inside: avoid; margin-bottom: 10px;'} 
          }
          .section-title { 
            font-size: 12px; 
            font-weight: bold; 
            margin-bottom: 5px; 
            color: #ffffff; 
            text-align: center;
            padding: 5px;
            background: #1d3557;
            border-radius: 4px;
          }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th { background: #1d3557; color: white; padding: 4px 3px; text-align: center; font-size: 8px; }
          td { border: 1px solid #ddd; padding: 3px 2px; text-align: center; font-size: 9px; }
          tr:nth-child(even) { background: #f9f9f9; }
          .total-row { font-weight: bold; background: #e5e7eb !important; }
          .footer { margin-top: 10px; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
          @media print { 
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Produção dos Pipas</h1>
        </div>

        <div class="stats-row">
          <div class="stat-box">
            <div class="value">${totalPipas}</div>
            <div class="label">Total de Pipas</div>
          </div>
          <div class="stat-box">
            <div class="value">${totalViagens}</div>
            <div class="label">Total de Viagens</div>
          </div>
          <div class="movement-badge">Movimentação Diária</div>
        </div>

        <div class="locals-container">
          ${dataByLocal.map(localData => generateLocalSection(localData, numLocals > 2)).join('')}
        </div>

        <div class="footer">
          <p>ApropriAPP - Gestão Inteligente • ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • Data: ${selectedDate}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      {isBlockVisible('header_actions') && <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <Droplets className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Apontamento Pipas</h1>
            <p className="text-sm text-muted-foreground">
              Controle de caminhões pipa • {getDisplayDate()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedDate} onValueChange={handleDateChange}>
            <SelectTrigger className="w-[140px] h-9">
              <CalendarIcon className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Data" />
            </SelectTrigger>
            <SelectContent>
              {availableDates.map((date) => (
                <SelectItem key={date} value={date}>{date}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedTipoLocal} onValueChange={handleTipoLocalChange}>
            <SelectTrigger className="w-[160px] h-9">
              <MapPin className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Local" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Locais</SelectItem>
              <SelectItem value="Produção">Produção</SelectItem>
              <SelectItem value="Recicladora">Recicladora</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadAllData} disabled={loading} className="h-9 w-9">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button className="h-9 gap-2" onClick={handleNewRecord}>
            <Plus className="w-4 h-4" />
            Novo Apontamento
          </Button>
        </div>
      </div>}

      {/* Tabs */}
      <Tabs defaultValue="operacao" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="operacao">
            <Droplets className="w-4 h-4 mr-2" />
            Operação
          </TabsTrigger>
          <TabsTrigger value="relatorios">
            <BarChart2 className="w-4 h-4 mr-2" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        {/* ── Operação ── */}
        <TabsContent value="operacao" className="space-y-4">
          {loading && availableDates.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              {isBlockVisible('stats_cards') && <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-secondary text-secondary-foreground">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-80">Total Viagens</p>
                        <p className="text-3xl font-bold">{formatNumber(filteredStats.totalViagens)}</p>
                        <p className="text-sm opacity-70">
                          {selectedTipoLocal !== 'todos' ? selectedTipoLocal : selectedDate || 'Selecione uma data'}
                        </p>
                      </div>
                      <div className="p-2 bg-white/20 rounded-lg"><Truck className="w-5 h-5" /></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Pipas</p>
                        <p className="text-3xl font-bold">{filteredStats.pipasAtivas}</p>
                        <p className="text-sm text-muted-foreground">Utilizadas</p>
                      </div>
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Truck className="w-5 h-5" /></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Volume Água</p>
                        <p className="text-3xl font-bold">{formatNumber(filteredStats.volumeAgua)} L</p>
                        <p className="text-sm text-muted-foreground">Estimado</p>
                      </div>
                      <div className="p-2 bg-cyan-100 text-cyan-600 rounded-lg"><Droplets className="w-5 h-5" /></div>
                    </div>
                  </CardContent>
                </Card>
              </div>}

              {/* Records Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    Carregamentos do Dia
                    {selectedTipoLocal !== 'todos' && (
                      <Badge variant="secondary" className="gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedTipoLocal}
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isMainAdmin && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowColumnConfig(true)} title="Configurar colunas">
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground">{filteredRecords.length} registros</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {piIsVisible('data') && <SortableTableHead sortKey="data" sortConfig={pipasSort.sortConfig} onSort={pipasSort.requestSort} style={piGetHeaderStyle('data')}>{piGetLabel('data')}</SortableTableHead>}
                        {piIsVisible('prefixo') && <SortableTableHead sortKey="prefixo" sortConfig={pipasSort.sortConfig} onSort={pipasSort.requestSort} style={piGetHeaderStyle('prefixo')}>{piGetLabel('prefixo')}</SortableTableHead>}
                        {piIsVisible('empresa') && <SortableTableHead sortKey="empresa" sortConfig={pipasSort.sortConfig} onSort={pipasSort.requestSort} style={piGetHeaderStyle('empresa')}>{piGetLabel('empresa')}</SortableTableHead>}
                        {piIsVisible('motorista') && <SortableTableHead sortKey="motorista" sortConfig={pipasSort.sortConfig} onSort={pipasSort.requestSort} style={piGetHeaderStyle('motorista')}>{piGetLabel('motorista')}</SortableTableHead>}
                        {piIsVisible('capacidade') && <SortableTableHead sortKey="capacidade" sortConfig={pipasSort.sortConfig} onSort={pipasSort.requestSort} style={piGetHeaderStyle('capacidade')}>{piGetLabel('capacidade')}</SortableTableHead>}
                        {piIsVisible('local') && <SortableTableHead sortKey="tipoLocal" sortConfig={pipasSort.sortConfig} onSort={pipasSort.requestSort} style={piGetHeaderStyle('local')}>{piGetLabel('local')}</SortableTableHead>}
                        {piIsVisible('viagens') && <SortableTableHead sortKey="viagens" sortConfig={pipasSort.sortConfig} onSort={pipasSort.requestSort} style={piGetHeaderStyle('viagens')}>{piGetLabel('viagens')}</SortableTableHead>}
                        {piIsVisible('acoes') && <SortableTableHead sortKey="acoes" sortConfig={pipasSort.sortConfig} onSort={pipasSort.requestSort} style={piGetHeaderStyle('acoes')} sortable={false}>{piGetLabel('acoes')}</SortableTableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipasSort.sortedData.map((rec, idx) => (
                        <TableRow key={idx}>
                          {piIsVisible('data') && <TableCell style={piGetStyle('data', rec.data)}>{rec.data}</TableCell>}
                          {piIsVisible('prefixo') && <TableCell style={{ ...piGetStyle('prefixo', rec.prefixo), fontWeight: piGetStyle('prefixo').fontWeight || 500 }} className="text-primary">{rec.prefixo}</TableCell>}
                          {piIsVisible('empresa') && <TableCell style={piGetStyle('empresa', rec.empresa)}>{rec.empresa}</TableCell>}
                          {piIsVisible('motorista') && <TableCell style={piGetStyle('motorista', rec.motorista)}>{rec.motorista}</TableCell>}
                          {piIsVisible('capacidade') && <TableCell style={piGetStyle('capacidade', String(rec.capacidade))}>{formatNumber(rec.capacidade)}</TableCell>}
                          {piIsVisible('local') && <TableCell style={piGetStyle('local', rec.tipoLocal)}>
                            {rec.tipoLocal ? (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  rec.tipoLocal.toLowerCase().includes('recicladora') 
                                    ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700' 
                                    : rec.tipoLocal.toLowerCase().includes('produ') 
                                      ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700'
                                      : ''
                                }`}
                              >
                                {rec.tipoLocal}
                              </Badge>
                            ) : '-'}
                          </TableCell>}
                          {piIsVisible('viagens') && <TableCell style={piGetStyle('viagens', String(rec.viagens))}>{rec.viagens}</TableCell>}
                          {piIsVisible('acoes') && <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEditRecord(rec)} title="Editar">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteRecord(rec)} title="Excluir">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>}
                        </TableRow>
                      ))}
                      {filteredRecords.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum registro encontrado {selectedTipoLocal !== 'todos' ? `para ${selectedTipoLocal}` : 'para esta data'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Relatórios ── */}
        <TabsContent value="relatorios" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Relatório Visual */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-blue-200 hover:border-blue-400"
              onClick={() => setShowPipasReport(true)}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Relatório de Pipas</h3>
                  <p className="text-sm text-muted-foreground mt-1">Produção agrupada por local de trabalho</p>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {filteredStats.pipasAtivas} pipas
                </Badge>
              </CardContent>
            </Card>


            {/* Excel */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-green-200 hover:border-green-400"
              onClick={handleExportXLSX}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Exportar Excel</h3>
                  <p className="text-sm text-muted-foreground mt-1">Planilha com todos os registros do dia</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {records.length} registros
                </Badge>
              </CardContent>
            </Card>

            {/* WhatsApp */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-emerald-200 hover:border-emerald-400"
              onClick={() => setWhatsappModalOpen(true)}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Enviar WhatsApp</h3>
                  <p className="text-sm text-muted-foreground mt-1">Resumo do dia via mensagem</p>
                </div>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  {filteredStats.totalViagens} viagens
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <PipaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={loadAllData}
        editData={editRecord ? {
          id: editRecord.id,
          data: editRecord.data,
          prefixo: editRecord.prefixo,
          descricao: editRecord.descricao,
          empresa: editRecord.empresa,
          motorista: editRecord.motorista,
          capacidade: String(editRecord.capacidade),
          viagens: editRecord.viagens,
          tipoLocal: editRecord.tipoLocal,
          rowIndex: editRecord.rowIndex,
        } : null}
      />

      <AlertDialog open={!!deleteRecord} onOpenChange={(open) => !open && setDeleteRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o apontamento da pipa <strong>{deleteRecord?.prefixo}</strong> do dia <strong>{deleteRecord?.data}</strong>?
              <br />Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PipasWhatsAppModal
        open={whatsappModalOpen}
        onOpenChange={setWhatsappModalOpen}
        data={{
          date: selectedDate,
          totalPipas: stats.pipasAtivas,
          totalViagens: stats.totalViagens,
          volumeAgua: stats.volumeAgua,
          locais: getAggregatedDataByTipoLocal(),
        }}
      />

      {showPipasReport && (
        <ProducaoPipasReport
          data={getAggregatedDataByTipoLocal()}
          selectedDate={selectedDate}
          totalPipas={filteredStats.pipasAtivas}
          totalViagens={filteredStats.totalViagens}
          volumeAgua={filteredStats.volumeAgua}
          onClose={() => setShowPipasReport(false)}
        />
      )}

      <ColumnConfigModal
        open={showColumnConfig}
        onOpenChange={setShowColumnConfig}
        tableLabel="Registros Pipas"
        defaultColumns={PIPAS_COLUMNS}
        currentConfigs={pipasConfigs}
        onSave={piSaveConfigs}
      />
    </div>
  );
}

