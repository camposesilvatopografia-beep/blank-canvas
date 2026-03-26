import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Download, Truck, MapPin, History, FileDown, Loader2, Plus, AlertTriangle, RefreshCw, Database, ChevronRight, Edit3, ArrowUp, ArrowDown, Minus, BarChart2, Settings2 } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Badge } from '@/components/ui/badge';
import { ResumoPorLocal } from '@/components/reports/ResumoPorLocal';
import { ProducaoCaminhoesReport } from '@/components/reports/ProducaoCaminhoesReport';
import { DetalheProducaoModal } from '@/components/reports/DetalheProducaoModal';
import { BatchEditModal } from '@/components/operations/BatchEditModal';
import { ApontamentoLancamentoModal } from '@/components/operations/ApontamentoLancamentoModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { ColumnConfigModal } from '@/components/crud/ColumnConfigModal';
import { usePageLayout, BlockDefinition } from '@/hooks/usePageLayout';

const DESCARGA_LAYOUT_BLOCKS: BlockDefinition[] = [
  { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
  { key: 'date_filter', defaultLabel: 'Filtro de Data' },
  { key: 'stats_cards', defaultLabel: 'Cards de Resumo por Local' },
  { key: 'table', defaultLabel: 'Tabela de Registros' },
  { key: 'batch_actions', defaultLabel: 'Ações em Lote' },
  { key: 'reports', defaultLabel: 'Relatórios' },
];

const DESCARGA_CAMINHAO_COLUMNS: ColumnDefinition[] = [
  { key: 'caminhao', defaultLabel: 'CAMINHÃO' },
  { key: 'motorista', defaultLabel: 'MOTORISTA' },
  { key: 'areia', defaultLabel: 'AREIA' },
  { key: 'aterro', defaultLabel: 'ATERRO' },
  { key: 'bgs', defaultLabel: 'BGS' },
  { key: 'bota_fora', defaultLabel: 'BOTA FORA' },
  { key: 'total', defaultLabel: 'TOTAL' },
  { key: 'acoes', defaultLabel: '' },
];

interface LocalStats {
  local: string;
  aterro: number;
  areia: number;
  botaFora: number;
  vegetal: number;
  bgs: number;
  total: number;
}

interface CaminhaoStats {
  prefixo: string;
  motorista: string;
  local: string;
  areia: number;
  aterro: number;
  bgs: number;
  botaFora: number;
  vegetal: number;
  total: number;
}

interface DetalheModalState {
  open: boolean;
  tipo: 'escavadeira' | 'caminhao';
  titulo: string;
  subtitulo: string;
  prefixo: string;
}

export default function Descarga() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [allData, setAllData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [materialStats, setMaterialStats] = useState<any[]>([]);
  const [lancamentoLocalStats, setLancamentoLocalStats] = useState<LocalStats[]>([]);
  const [caminhaoStats, setCaminhaoStats] = useState<CaminhaoStats[]>([]);
  const [showCaminhaoReport, setShowCaminhaoReport] = useState(false);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [showApontamentoRapido, setShowApontamentoRapido] = useState(false);
  const [detalheModal, setDetalheModal] = useState<DetalheModalState>({
    open: false,
    tipo: 'caminhao',
    titulo: '',
    subtitulo: '',
    prefixo: '',
  });
  const { readSheet, loading } = useGoogleSheets();
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const { isBlockVisible } = usePageLayout('operacao_descarga', DESCARGA_LAYOUT_BLOCKS);
  const { configs: descConfigs, getLabel: dGetLabel, isVisible: dIsVisible, getStyle: dGetStyle, getHeaderStyle: dGetHeaderStyle, saveConfigs: dSaveConfigs } = useColumnConfig('descarga_caminhoes', DESCARGA_CAMINHAO_COLUMNS);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const descargaSort = useTableSort(caminhaoStats);
  const descargaMatSort = useTableSort(materialStats);

  const [stats, setStats] = useState({
    totalViagens: 0,
    viagensSemApontamento: 0,
    totalViagensCarga: 0,
    totalViagensDescarga: 0,
    volumeTotal: 0,
    locaisAtivos: 0,
    totalCaminhoes: 0,
    mediaCaminhao: 0,
  });
  
  const [showViagensSemApontamentoModal, setShowViagensSemApontamentoModal] = useState(false);

  const [cargaData, setCargaData] = useState<any[][]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      // Load both Carga and Descarga data
      const [descargaResult, cargaResult] = await Promise.all([
        readSheet('Descarga'),
        readSheet('Carga')
      ]);
      
      if (descargaResult.length > 1) {
        const hdrs = descargaResult[0];
        setHeaders(hdrs);
        setAllData(descargaResult);
        
        const dateIdx = hdrs.indexOf('Data');
        const dates = [...new Set(descargaResult.slice(1).map(row => row[dateIdx]).filter(Boolean))];
        
        // Sort dates in descending order
        const sortedDates = dates.sort((a, b) => {
          const [da, ma, ya] = a.split('/').map(Number);
          const [db, mb, yb] = b.split('/').map(Number);
          return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });
        
        setAvailableDates(sortedDates);
        
        if (sortedDates.length > 0 && !selectedDate) {
          setSelectedDate(sortedDates[0]);
        }
      }
      
      // Store Carga data for calculating viagens sem apontamento
      if (cargaResult.length > 1) {
        setCargaData(cargaResult);
      }
    } catch (error) {
      console.error('Error loading descarga data:', error);
    }
  };

  const processDataForDate = useCallback((dateStr: string) => {
    if (!allData.length || !headers.length || !dateStr) return;
    
    const getIdx = (name: string) => headers.indexOf(name);
    
    // Helper para parsear viagens com fallback seguro
    const parseViagens = (value: any): number => {
      const parsed = parseInt(String(value ?? '1'), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };

    // Helper para normalizar local (trim e uppercase para comparação consistente)
    const normalizeLocal = (local: string): string => {
      return (local || '').trim().toUpperCase();
    };

    const todayRecords = allData.slice(1)
      .filter(row => row[getIdx('Data')] === dateStr)
      .map(row => {
        const rawLocal = row[getIdx('Local_da_Obra')] || '';
        return {
          data: row[getIdx('Data')] || '',
          hora: row[getIdx('Hora')] || '',
          prefixoCb: row[getIdx('Prefixo_Cb')] || '',
          empresaCb: row[getIdx('Empresa_Cb')] || '',
          motorista: row[getIdx('Motorista')] || '',
          volume: parseFloat(String(row[getIdx('Volume')] || 0).replace(',', '.')),
          viagens: parseViagens(row[getIdx('N_Viagens')]),
          volumeTotal: parseFloat(String(row[getIdx('Volume_Total')] || 0).replace(',', '.')),
          local: rawLocal.trim(), // Manter original para exibição
          localNormalized: normalizeLocal(rawLocal), // Normalizado para comparação
          estaca: row[getIdx('Estaca')] || '',
          material: row[getIdx('Material')] || '',
        };
      });

    setRecords(todayRecords);

    // Calculate total viagens from Carga for the same date
    let totalViagensCarga = 0;
    if (cargaData.length > 1) {
      const cargaHeaders = cargaData[0];
      const cargaDateIdx = cargaHeaders.indexOf('Data');
      const cargaViagensIdx = cargaHeaders.indexOf('N_Viagens');
      const cargaViagensIdxAlt = cargaHeaders.indexOf('I_Viagens');
      
      cargaData.slice(1)
        .filter(row => row[cargaDateIdx] === dateStr)
        .forEach(row => {
          const raw = cargaViagensIdx !== -1 ? row[cargaViagensIdx] : cargaViagensIdxAlt !== -1 ? row[cargaViagensIdxAlt] : undefined;
          totalViagensCarga += parseViagens(raw);
        });
    }

    const locais = new Set(todayRecords.map(r => r.localNormalized));
    const caminhoes = new Set(todayRecords.map(r => r.prefixoCb));
    const totalViagensDescarga = todayRecords.reduce((sum, r) => sum + r.viagens, 0);
    
    // Viagens sem apontamento = Carga - Descarga
    const viagensSemApontamento = Math.max(0, totalViagensCarga - totalViagensDescarga);
    
    // Calcular volume total corretamente: viagens * volume (capacidade)
    const volumeTotalCalculado = todayRecords.reduce((sum, r) => {
      // Se volumeTotal já está preenchido, usar ele; senão calcular viagens * volume
      const vol = r.volumeTotal > 0 ? r.volumeTotal : (r.viagens * r.volume);
      return sum + vol;
    }, 0);
    
    setStats({
      totalViagens: totalViagensDescarga,
      viagensSemApontamento,
      totalViagensCarga,
      totalViagensDescarga,
      volumeTotal: volumeTotalCalculado,
      locaisAtivos: locais.size,
      totalCaminhoes: caminhoes.size,
      mediaCaminhao: caminhoes.size > 0 ? Math.round((totalViagensDescarga / caminhoes.size) * 10) / 10 : 0,
    });

    const matMap = new Map<string, { viagens: number; volume: number }>();
    todayRecords.forEach(r => {
      const key = r.material || 'Outros';
      if (!matMap.has(key)) matMap.set(key, { viagens: 0, volume: 0 });
      const s = matMap.get(key)!;
      s.viagens += r.viagens;
      s.volume += r.volumeTotal;
    });
    setMaterialStats(Array.from(matMap.entries()).map(([material, data]) => ({
      material,
      ...data,
    })).sort((a, b) => b.viagens - a.viagens));

    // Calculate local stats for Resumo de Lançamento
    const localMap = new Map<string, LocalStats>();
    todayRecords.forEach(r => {
      const localKey = r.local || 'Sem Local';
      if (!localMap.has(localKey)) {
        localMap.set(localKey, {
          local: localKey,
          aterro: 0, areia: 0, botaFora: 0, vegetal: 0, bgs: 0, total: 0,
        });
      }
      const s = localMap.get(localKey)!;
      const mat = r.material.toLowerCase();
      if (mat.includes('areia')) s.areia += r.viagens;
      else if (mat.includes('aterro')) s.aterro += r.viagens;
      else if (mat.includes('bgs')) s.bgs += r.viagens;
      else if (mat.includes('bota')) s.botaFora += r.viagens;
      else if (mat.includes('vegetal')) s.vegetal += r.viagens;
      s.total += r.viagens;
    });
    setLancamentoLocalStats(Array.from(localMap.values()).sort((a, b) => a.local.localeCompare(b.local)));

    // Calculate caminhao stats - Separar por Prefixo + Local (usando localNormalized para agrupar)
    const camMap = new Map<string, CaminhaoStats>();
    todayRecords.forEach(r => {
      const key = `${r.prefixoCb}|${r.localNormalized || 'SEM LOCAL'}`;
      if (!camMap.has(key)) {
        camMap.set(key, {
          prefixo: r.prefixoCb,
          motorista: r.motorista,
          local: r.local || 'Sem Local', // Manter original para exibição
          areia: 0, aterro: 0, bgs: 0, botaFora: 0, vegetal: 0, total: 0,
        });
      }
      const s = camMap.get(key)!;
      const mat = r.material.toLowerCase();
      if (mat.includes('areia')) s.areia += r.viagens;
      else if (mat.includes('aterro')) s.aterro += r.viagens;
      else if (mat.includes('bgs')) s.bgs += r.viagens;
      else if (mat.includes('bota')) s.botaFora += r.viagens;
      else if (mat.includes('vegetal')) s.vegetal += r.viagens;
      s.total += r.viagens;
    });
    setCaminhaoStats(Array.from(camMap.values()).sort((a, b) => {
      const prefixoCompare = a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true });
      if (prefixoCompare !== 0) return prefixoCompare;
      return a.local.localeCompare(b.local, 'pt-BR');
    }));
  }, [allData, headers, cargaData]);

  useEffect(() => {
    if (selectedDate) {
      processDataForDate(selectedDate);
    }
  }, [selectedDate, processDataForDate]);

  const handleDateChange = (value: string) => {
    setSelectedDate(value);
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');

  // Helper: count unique locations per prefix
  const getLocaisCountByPrefixo = (stats: { prefixo: string; local: string }[]) => {
    const countMap = new Map<string, Set<string>>();
    stats.forEach(s => {
      if (!countMap.has(s.prefixo)) countMap.set(s.prefixo, new Set());
      countMap.get(s.prefixo)!.add(s.local);
    });
    return countMap;
  };

  const caminhaoLocaisCount = getLocaisCountByPrefixo(caminhaoStats);

  const getDisplayDate = () => {
    if (!selectedDate) return format(new Date(), "dd 'de' MMMM", { locale: ptBR });
    const [day, month, year] = selectedDate.split('/').map(Number);
    return format(new Date(year, month - 1, day), "dd 'de' MMMM", { locale: ptBR });
  };

  const handleCaminhaoClick = (cam: CaminhaoStats) => {
    setDetalheModal({
      open: true,
      tipo: 'caminhao',
      titulo: cam.prefixo,
      subtitulo: cam.motorista,
      prefixo: cam.prefixo,
    });
  };

  const getDetalheRegistros = () => {
    return records
      .filter(r => r.prefixoCb === detalheModal.prefixo)
      .map(r => ({
        hora: r.hora,
        prefixoCb: r.prefixoCb,
        prefixoEq: '',
        motorista: r.motorista,
        operador: '',
        local: r.local,
        material: r.material,
        volume: r.volumeTotal,
        viagens: r.viagens,
      }));
  };

  const getDetalheTotalViagens = () => {
    const registros = getDetalheRegistros();
    return registros.reduce((sum, r) => sum + r.viagens, 0);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      {isBlockVisible('header_actions') && <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <Download className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Registro de Lançamento</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhamento de lançamentos • {getDisplayDate()}
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
          <Button variant="outline" size="icon" onClick={loadAllData} disabled={loading} className="h-9 w-9">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => setShowBatchEdit(true)}
          >
            <Edit3 className="w-4 h-4 mr-1" />
            Editar Lote
          </Button>
          <Button
            size="sm"
            className="h-9 bg-primary hover:bg-primary/90"
            onClick={() => setShowApontamentoRapido(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo Lançamento
          </Button>
        </div>
      </div>}

      {/* Modals */}
      <ApontamentoLancamentoModal
        open={showApontamentoRapido}
        onOpenChange={setShowApontamentoRapido}
        onSuccess={loadAllData}
      />
      <BatchEditModal
        open={showBatchEdit}
        onOpenChange={setShowBatchEdit}
        sheetName="Descarga"
        onSuccess={loadAllData}
      />

      {/* Tabs */}
      <Tabs defaultValue="operacao" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="operacao">
            <Download className="w-4 h-4 mr-2" />
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
              {isBlockVisible('stats_cards') && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-secondary text-secondary-foreground">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-80">Total Viagens</p>
                        <p className="text-3xl font-bold">{formatNumber(stats.totalViagens)}</p>
                        <p className="text-sm opacity-70">{selectedDate || 'Selecione uma data'}</p>
                      </div>
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Truck className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600 transition-colors"
                  onClick={() => setShowViagensSemApontamentoModal(true)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-80">Viagens sem Apontamento</p>
                        <p className="text-3xl font-bold">{stats.viagensSemApontamento}</p>
                        <p className="text-sm opacity-70">Clique para detalhes</p>
                      </div>
                      <div className="p-2 bg-white/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Volume Total</p>
                        <p className="text-3xl font-bold">{formatNumber(stats.volumeTotal)} m³</p>
                        <p className="text-sm text-muted-foreground">Descarregado</p>
                      </div>
                      <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                        <Download className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Locais Ativos</p>
                        <p className="text-3xl font-bold">{stats.locaisAtivos}</p>
                        <p className="text-sm text-muted-foreground">{stats.totalCaminhoes} caminhões</p>
                      </div>
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <MapPin className="w-5 h-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>}

              {/* Production by Truck */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Produção por Caminhão</CardTitle>
                  <div className="flex items-center gap-2">
                    {isMainAdmin && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowColumnConfig(true)} title="Configurar colunas">
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground">{caminhaoStats.length} caminhões</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {dIsVisible('caminhao') && <SortableTableHead sortKey="prefixo" sortConfig={descargaSort.sortConfig} onSort={descargaSort.requestSort} style={dGetHeaderStyle('caminhao')}>{dGetLabel('caminhao')}</SortableTableHead>}
                        {dIsVisible('motorista') && <SortableTableHead sortKey="motorista" sortConfig={descargaSort.sortConfig} onSort={descargaSort.requestSort} style={dGetHeaderStyle('motorista')}>{dGetLabel('motorista')}</SortableTableHead>}
                        {dIsVisible('areia') && <SortableTableHead sortKey="areia" sortConfig={descargaSort.sortConfig} onSort={descargaSort.requestSort} style={dGetHeaderStyle('areia')}>{dGetLabel('areia')}</SortableTableHead>}
                        {dIsVisible('aterro') && <SortableTableHead sortKey="aterro" sortConfig={descargaSort.sortConfig} onSort={descargaSort.requestSort} style={dGetHeaderStyle('aterro')}>{dGetLabel('aterro')}</SortableTableHead>}
                        {dIsVisible('bgs') && <SortableTableHead sortKey="bgs" sortConfig={descargaSort.sortConfig} onSort={descargaSort.requestSort} style={dGetHeaderStyle('bgs')}>{dGetLabel('bgs')}</SortableTableHead>}
                        {dIsVisible('bota_fora') && <SortableTableHead sortKey="botaFora" sortConfig={descargaSort.sortConfig} onSort={descargaSort.requestSort} style={dGetHeaderStyle('bota_fora')}>{dGetLabel('bota_fora')}</SortableTableHead>}
                        {dIsVisible('total') && <SortableTableHead sortKey="total" sortConfig={descargaSort.sortConfig} onSort={descargaSort.requestSort} style={dGetHeaderStyle('total')}>{dGetLabel('total')}</SortableTableHead>}
                        {dIsVisible('acoes') && <TableHead></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {descargaSort.sortedData.slice(0, 8).map((cam, idx) => {
                        const locaisCount = caminhaoLocaisCount.get(cam.prefixo)?.size || 1;
                        const hasMultipleLocais = locaisCount > 1;
                        return (
                          <TableRow
                            key={`${cam.prefixo}-${cam.local}-${idx}`}
                            className={`cursor-pointer hover:bg-muted/50 ${hasMultipleLocais ? 'border-l-4 border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                            onClick={() => handleCaminhaoClick(cam)}
                          >
                            {dIsVisible('caminhao') && <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-medium text-primary">{cam.prefixo}</p>
                                  <p className="text-[10px] text-muted-foreground">{cam.local}</p>
                                </div>
                                {hasMultipleLocais && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-blue-300">
                                    {locaisCount} locais
                                  </Badge>
                                )}
                              </div>
                            </TableCell>}
                            {dIsVisible('motorista') && <TableCell style={dGetStyle('motorista', cam.motorista)}>{cam.motorista}</TableCell>}
                            {dIsVisible('areia') && <TableCell style={dGetStyle('areia', String(cam.areia || ''))}>{cam.areia || '-'}</TableCell>}
                            {dIsVisible('aterro') && <TableCell style={dGetStyle('aterro', String(cam.aterro || ''))}>{cam.aterro || '-'}</TableCell>}
                            {dIsVisible('bgs') && <TableCell style={dGetStyle('bgs', String(cam.bgs || ''))}>{cam.bgs || '-'}</TableCell>}
                            {dIsVisible('bota_fora') && <TableCell style={dGetStyle('bota_fora', String(cam.botaFora || ''))}>{cam.botaFora || '-'}</TableCell>}
                            {dIsVisible('total') && <TableCell style={{ ...dGetStyle('total', String(cam.total)), fontWeight: dGetStyle('total').fontWeight || 'bold' }}>{cam.total}</TableCell>}
                            {dIsVisible('acoes') && <TableCell>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </TableCell>}
                          </TableRow>
                        );
                      })}
                      {caminhaoStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum registro encontrado para esta data
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Material Summary */}
              <Card>
                <CardHeader><CardTitle>Resumo por Material</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead sortKey="material" sortConfig={descargaMatSort.sortConfig} onSort={descargaMatSort.requestSort}>MATERIAL</SortableTableHead>
                        <SortableTableHead sortKey="viagens" sortConfig={descargaMatSort.sortConfig} onSort={descargaMatSort.requestSort} className="text-center">VIAGENS</SortableTableHead>
                        <SortableTableHead sortKey="volume" sortConfig={descargaMatSort.sortConfig} onSort={descargaMatSort.requestSort} className="text-right">VOLUME TOTAL</SortableTableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {descargaMatSort.sortedData.map((mat) => (
                        <TableRow key={mat.material}>
                          <TableCell className="font-medium">{mat.material}</TableCell>
                          <TableCell className="text-center">{mat.viagens}</TableCell>
                          <TableCell className="text-right">{formatNumber(mat.volume)} m³</TableCell>
                        </TableRow>
                      ))}
                      {materialStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            Nenhum registro encontrado para esta data
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Resumo por Local */}
              <ResumoPorLocal title="Resumo de Lançamento" data={lancamentoLocalStats} className="mt-6" />
            </>
          )}
        </TabsContent>

        {/* ── Relatórios ── */}
        <TabsContent value="relatorios" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Relatório Caminhões */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-blue-200 hover:border-blue-400"
              onClick={() => setShowCaminhaoReport(true)}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Produção Caminhões</h3>
                  <p className="text-sm text-muted-foreground mt-1">Detalhamento por caminhão e motorista</p>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {stats.totalCaminhoes} caminhões
                </Badge>
              </CardContent>
            </Card>

            {/* Resumo por Local */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-green-200 hover:border-green-400"
              onClick={() => {}}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Resumo por Local</h3>
                  <p className="text-sm text-muted-foreground mt-1">Viagens e volumes por local de descarga</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {stats.locaisAtivos} locais
                </Badge>
              </CardContent>
            </Card>

            {/* Viagens sem Apontamento */}
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-amber-200 hover:border-amber-400"
              onClick={() => setShowViagensSemApontamentoModal(true)}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Divergência Carga/Lançamento</h3>
                  <p className="text-sm text-muted-foreground mt-1">Viagens de carga sem lançamento correspondente</p>
                </div>
                <Badge variant="secondary" className={stats.viagensSemApontamento > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
                  {stats.viagensSemApontamento} pendentes
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Report Modal */}
      {showCaminhaoReport && (
        <ProducaoCaminhoesReport
          data={caminhaoStats.map(c => ({
            prefixo: c.prefixo,
            motorista: c.motorista,
            local: c.local || '-',
            aterro: c.aterro,
            areia: c.areia,
            botaFora: c.botaFora,
            vegetal: c.vegetal,
            bgs: c.bgs,
            total: c.total,
          }))}
          selectedDate={selectedDate}
          totalViagens={stats.totalViagens}
          totalCaminhoes={stats.totalCaminhoes}
          mediaPorCaminhao={stats.mediaCaminhao}
          volumeTransportado={stats.volumeTotal}
          onClose={() => setShowCaminhaoReport(false)}
        />
      )}

      {/* Detalhe Modal */}
      <DetalheProducaoModal
        open={detalheModal.open}
        onOpenChange={(open) => setDetalheModal(prev => ({ ...prev, open }))}
        tipo={detalheModal.tipo}
        titulo={detalheModal.titulo}
        subtitulo={detalheModal.subtitulo}
        registros={getDetalheRegistros()}
        totalViagens={getDetalheTotalViagens()}
      />

      {/* Modal Viagens sem Apontamento */}
      <Dialog open={showViagensSemApontamentoModal} onOpenChange={setShowViagensSemApontamentoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Detalhamento de Viagens
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Comparativo entre viagens de Carga e Lançamento para <strong>{selectedDate}</strong>
            </p>
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500 text-white rounded-lg">
                    <ArrowUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-700">Viagens de Carga</p>
                    <p className="text-xs text-blue-600">Carregamentos registrados</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-blue-700">{stats.totalViagensCarga}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500 text-white rounded-lg">
                    <ArrowDown className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-700">Viagens de Lançamento</p>
                    <p className="text-xs text-green-600">Descargas apontadas</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-green-700">{stats.totalViagensDescarga}</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500 text-white rounded-lg">
                    <Minus className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-700">Viagens sem Apontamento</p>
                    <p className="text-xs text-amber-600">Carga − Lançamento</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-700">{stats.viagensSemApontamento}</span>
              </div>
            </div>
            {stats.viagensSemApontamento > 0 ? (
              <div className="p-3 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 text-sm">
                <strong>Atenção:</strong> Existem {stats.viagensSemApontamento} viagem(ns) de carga ainda não lançada(s).
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-green-100 border border-green-300 text-green-800 text-sm">
                <strong>Tudo certo!</strong> Todas as viagens de carga foram lançadas.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ColumnConfigModal
        open={showColumnConfig}
        onOpenChange={setShowColumnConfig}
        tableLabel="Caminhões Descarga"
        defaultColumns={DESCARGA_CAMINHAO_COLUMNS}
        currentConfigs={descConfigs}
        onSave={dSaveConfigs}
      />
    </div>
  );
}
