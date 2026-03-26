import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  TrendingUp, 
  Truck, 
  HardHat, 
  Loader2, 
  RefreshCw, 
  FlaskConical, 
  Droplets, 
  Mountain,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  AlertTriangle,
  ChevronRight,
  Expand,
  Minimize2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { useNavigate } from 'react-router-dom';

interface OperationSummary {
  carga: {
    viagens: number;
    volume: number;
    escavadeiras: number;
    caminhoes: number;
  };
  descarga: {
    viagens: number;
    volume: number;
    locais: number;
    caminhoes: number;
  };
  pedreira: {
    viagens: number;
    toneladas: number;
    frete: number;
  };
  pipas: {
    viagens: number;
    veiculos: number;
  };
  cal: {
    entradas: number;
    saidas: number;
    estoqueAtual: number;
    saldo: number;
  };
}

interface DailyTrend {
  date: string;
  carga: number;
  descarga: number;
  pedreira: number;
  pipas: number;
  total: number;
}

const COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
const OPERATION_COLORS = {
  carga: '#10b981',
  descarga: '#3b82f6',
  pedreira: '#f59e0b',
  pipas: '#06b6d4',
  cal: '#8b5cf6',
};

export function DashboardConsolidado() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { readSheet, loading } = useGoogleSheets();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [expandedView, setExpandedView] = useState(false);
  
  const [summary, setSummary] = useState<OperationSummary>({
    carga: { viagens: 0, volume: 0, escavadeiras: 0, caminhoes: 0 },
    descarga: { viagens: 0, volume: 0, locais: 0, caminhoes: 0 },
    pedreira: { viagens: 0, toneladas: 0, frete: 0 },
    pipas: { viagens: 0, veiculos: 0 },
    cal: { entradas: 0, saidas: 0, estoqueAtual: 0, saldo: 0 },
  });

  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [operationDistribution, setOperationDistribution] = useState<{name: string; value: number; color: string}[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // Load all sheets in parallel
      const [cargaData, descargaData, pedreiraData, pipaData, calMovData, calEstoqueData] = await Promise.all([
        readSheet('Carga'),
        readSheet('Descarga'),
        readSheet('Apontamento_Pedreira'),
        readSheet('Apontamento_Pipa'),
        readSheet('Mov_Cal'),
        readSheet('Estoque_Cal'),
      ]);

      // Get all dates from all sheets
      const allDates = new Set<string>();
      
      const extractDates = (data: any[][], dateColumnName: string) => {
        if (data.length > 1) {
          const headers = data[0];
          const dateIdx = headers.indexOf(dateColumnName);
          if (dateIdx >= 0) {
            data.slice(1).forEach(row => {
              const date = row[dateIdx];
              if (date && typeof date === 'string' && date.includes('/')) {
                allDates.add(date);
              }
            });
          }
        }
      };

      extractDates(cargaData, 'Data');
      extractDates(descargaData, 'Data');
      extractDates(pedreiraData, 'Data');
      extractDates(pipaData, 'Data');
      extractDates(calMovData, 'Data');

      const sortedDates = Array.from(allDates).sort((a, b) => {
        const [da, ma, ya] = a.split('/').map(Number);
        const [db, mb, yb] = b.split('/').map(Number);
        return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
      });

      setAvailableDates(sortedDates);

      if (sortedDates.length > 0) {
        const latestDate = sortedDates[0];
        setSelectedDate(latestDate);
        processDataForDate(latestDate, { cargaData, descargaData, pedreiraData, pipaData, calMovData, calEstoqueData });
        calculateTrends(sortedDates.slice(0, 7), { cargaData, descargaData, pedreiraData, pipaData });
      }
    } catch (error) {
      console.error('Error loading consolidated data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processDataForDate = (dateStr: string, data: any) => {
    const { cargaData, descargaData, pedreiraData, pipaData, calMovData, calEstoqueData } = data;

    const getTrips = (headers: string[], row: any[]) => {
      const idxNv = headers.indexOf('N_Viagens');
      const idxIv = headers.indexOf('I_Viagens');
      const raw = idxNv !== -1 ? row[idxNv] : idxIv !== -1 ? row[idxIv] : undefined;
      const parsed = parseInt(String(raw ?? '1'), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };

    // Process Carga
    let cargaSummary = { viagens: 0, volume: 0, escavadeiras: new Set<string>(), caminhoes: new Set<string>() };
    if (cargaData.length > 1) {
      const headers = cargaData[0];
      const getIdx = (name: string) => headers.indexOf(name);
      cargaData.slice(1).filter((row: any) => row[getIdx('Data')] === dateStr).forEach((row: any) => {
        cargaSummary.viagens += getTrips(headers, row);
        cargaSummary.volume += parseFloat(String(row[getIdx('Volume_Total')] || 0).replace(',', '.')) || 0;
        if (row[getIdx('Prefixo_Eq')]) cargaSummary.escavadeiras.add(row[getIdx('Prefixo_Eq')]);
        if (row[getIdx('Prefixo_Cb')]) cargaSummary.caminhoes.add(row[getIdx('Prefixo_Cb')]);
      });
    }

    // Process Descarga
    let descargaSummary = { viagens: 0, volume: 0, locais: new Set<string>(), caminhoes: new Set<string>() };
    if (descargaData.length > 1) {
      const headers = descargaData[0];
      const getIdx = (name: string) => headers.indexOf(name);
      descargaData.slice(1).filter((row: any) => row[getIdx('Data')] === dateStr).forEach((row: any) => {
        descargaSummary.viagens += getTrips(headers, row);
        descargaSummary.volume += parseFloat(String(row[getIdx('Volume_Total')] || 0).replace(',', '.')) || 0;
        if (row[getIdx('Local_da_Obra')]) descargaSummary.locais.add(row[getIdx('Local_da_Obra')]);
        if (row[getIdx('Prefixo_Cb')]) descargaSummary.caminhoes.add(row[getIdx('Prefixo_Cb')]);
      });
    }

    // Process Pedreira — only "Finalizado" status counts for viagens and toneladas
    let pedreiraSummary = { viagens: 0, toneladas: 0, frete: 0 };
    if (pedreiraData.length > 1) {
      const headers = pedreiraData[0];
      const getIdx = (name: string) => headers.indexOf(name);
      const statusIdx = headers.indexOf('Status');
      pedreiraData.slice(1)
        .filter((row: any) => {
          if (row[getIdx('Data')] !== dateStr) return false;
          if (statusIdx === -1) return true; // no status column → include all
          const s = String(row[statusIdx] || '').trim().toLowerCase();
          return s === 'finalizado';
        })
        .forEach((row: any) => {
          pedreiraSummary.viagens += getTrips(headers, row);
          pedreiraSummary.toneladas += parseFloat(String(row[getIdx('Tonelada')] || 0).replace('.', '').replace(',', '.')) || 0;
          pedreiraSummary.frete += parseFloat(String(row[getIdx('Frete')] || 0).replace('R$', '').replace('.', '').replace(',', '.').trim()) || 0;
        });
    }

    // Process Pipas
    let pipasSummary = { viagens: 0, veiculos: new Set<string>() };
    if (pipaData.length > 1) {
      const headers = pipaData[0];
      const getIdx = (name: string) => headers.indexOf(name);
      pipaData.slice(1).filter((row: any) => row[getIdx('Data')] === dateStr).forEach((row: any) => {
        pipasSummary.viagens += getTrips(headers, row);
        if (row[getIdx('Prefixo')]) pipasSummary.veiculos.add(row[getIdx('Prefixo')]);
      });
    }

    // Process Cal
    let calSummary = { entradas: 0, saidas: 0, estoqueAtual: 0, saldo: 0 };
    if (calMovData.length > 1) {
      const headers = calMovData[0];
      const getIdx = (name: string) => headers.indexOf(name);
      calMovData.slice(1).filter((row: any) => row[getIdx('Data')] === dateStr).forEach((row: any) => {
        const tipo = String(row[getIdx('Tipo')] || '').toLowerCase();
        const qtd = parseFloat(String(row[getIdx('Qtd')] || 0).replace('.', '').replace(',', '.')) || 0;
        if (tipo === 'entrada') calSummary.entradas += qtd;
        else if (tipo === 'saida' || tipo === 'saída') calSummary.saidas += qtd;
      });
    }

    if (calEstoqueData.length > 1) {
      const headers = calEstoqueData[0];
      const getIdx = (name: string) => headers.indexOf(name);
      const lastRecord = calEstoqueData[calEstoqueData.length - 1];
      calSummary.estoqueAtual = parseFloat(String(lastRecord[getIdx('EstoqueAtual')] || 0).replace('.', '').replace(',', '.')) || 0;
    }

    // Calculate total trips for Cal (entradas + saidas) - aqui é quantidade de movimentações
    const totalCalViagens = calMovData.length > 1 ? calMovData.slice(1).filter((row: any) => row[calMovData[0].indexOf('Data')] === dateStr).length : 0;

    setSummary({
      carga: {
        viagens: cargaSummary.viagens,
        volume: cargaSummary.volume,
        escavadeiras: cargaSummary.escavadeiras.size,
        caminhoes: cargaSummary.caminhoes.size,
      },
      descarga: {
        viagens: descargaSummary.viagens,
        volume: descargaSummary.volume,
        locais: descargaSummary.locais.size,
        caminhoes: descargaSummary.caminhoes.size,
      },
      pedreira: pedreiraSummary,
      pipas: {
        viagens: pipasSummary.viagens,
        veiculos: pipasSummary.veiculos.size,
      },
      cal: calSummary,
    });

    // Calculate operation distribution
    const totalViagens = cargaSummary.viagens + descargaSummary.viagens + pedreiraSummary.viagens + pipasSummary.viagens + totalCalViagens;
    setOperationDistribution([
      { name: 'Carga', value: cargaSummary.viagens, color: OPERATION_COLORS.carga },
      { name: 'Descarga', value: descargaSummary.viagens, color: OPERATION_COLORS.descarga },
      { name: 'Pedreira', value: pedreiraSummary.viagens, color: OPERATION_COLORS.pedreira },
      { name: 'Pipas', value: pipasSummary.viagens, color: OPERATION_COLORS.pipas },
      { name: 'Cal', value: totalCalViagens, color: OPERATION_COLORS.cal },
    ].filter(d => d.value > 0));
  };

  const calculateTrends = (dates: string[], data: any) => {
    const { cargaData, descargaData, pedreiraData, pipaData } = data;

    const sumTripsForDate = (sheet: any[][], dateStr: string, requireFinalizado = false) => {
      if (!sheet || sheet.length < 2) return 0;
      const headers = sheet[0];
      const dateIdx = headers.indexOf('Data');
      const idxNv = headers.indexOf('N_Viagens');
      const idxIv = headers.indexOf('I_Viagens');
      const statusIdx = headers.indexOf('Status');
      return sheet.slice(1).reduce((sum: number, row: any[]) => {
        if (row[dateIdx] !== dateStr) return sum;
        if (requireFinalizado && statusIdx !== -1) {
          const s = String(row[statusIdx] || '').trim().toLowerCase();
          if (s !== 'finalizado') return sum;
        }
        const raw = idxNv !== -1 ? row[idxNv] : idxIv !== -1 ? row[idxIv] : undefined;
        const parsed = parseInt(String(raw ?? '1'), 10);
        const v = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
        return sum + v;
      }, 0);
    };

    const trends = dates.reverse().map(dateStr => {
      const carga = sumTripsForDate(cargaData, dateStr);
      const descarga = sumTripsForDate(descargaData, dateStr);
      const pedreira = sumTripsForDate(pedreiraData, dateStr, true); // only Finalizado
      const pipas = sumTripsForDate(pipaData, dateStr);

      const total = carga + descarga + pedreira + pipas;

      return {
        date: dateStr.split('/').slice(0, 2).join('/'),
        carga,
        descarga,
        pedreira,
        pipas,
        total,
      };
    });

    setDailyTrends(trends);
  };

  const totalViagens = summary.carga.viagens + summary.descarga.viagens + summary.pedreira.viagens + summary.pipas.viagens;
  const totalVolume = summary.carga.volume + summary.descarga.volume;

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');
  const formatCurrency = (num: number) => num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados consolidados...</p>
        </div>
      </div>
    );
  }

  // Mobile Compact View
  if (isMobile && !expandedView) {
    return (
      <div className="space-y-3 px-1">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold">Consolidado</h1>
              <p className="text-[10px] text-muted-foreground">{selectedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setExpandedView(true)} className="h-8 w-8">
              <Expand className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={loadAllData} disabled={loading} className="h-8 w-8">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Compact KPI Grid - 2x2 */}
        <div className="grid grid-cols-2 gap-2">
          {/* Total Viagens */}
          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-[10px] font-medium">Viagens</p>
                  <p className="text-2xl font-bold">{formatNumber(totalViagens)}</p>
                </div>
                <Truck className="w-5 h-5 text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          {/* Volume */}
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-[10px] font-medium">Volume</p>
                  <p className="text-2xl font-bold">{formatNumber(Math.round(totalVolume))}</p>
                  <p className="text-[9px] text-blue-200">m³</p>
                </div>
                <TrendingUp className="w-5 h-5 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          {/* Sem Apontamento */}
          <Card className={`border-0 text-white ${summary.carga.viagens - summary.descarga.viagens > 0 ? 'bg-gradient-to-br from-orange-500 to-orange-600' : 'bg-gradient-to-br from-green-500 to-green-600'}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-[10px] font-medium ${summary.carga.viagens - summary.descarga.viagens > 0 ? 'text-orange-100' : 'text-green-100'}`}>Pendentes</p>
                  <p className="text-2xl font-bold">{formatNumber(Math.abs(summary.carga.viagens - summary.descarga.viagens))}</p>
                </div>
                <AlertTriangle className="w-5 h-5 opacity-60" />
              </div>
            </CardContent>
          </Card>

          {/* Estoque Cal */}
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-[10px] font-medium">Cal</p>
                  <p className="text-2xl font-bold">{formatNumber(Math.round(summary.cal.estoqueAtual))}</p>
                  <p className="text-[9px] text-purple-200">ton</p>
                </div>
                <FlaskConical className="w-5 h-5 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Operations */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground px-1">Operações do dia</p>
          
          {/* Carga */}
          <button 
            onClick={() => navigate('/operacao/carga')}
            className="w-full flex items-center justify-between p-3 bg-card rounded-lg border hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.carga}20` }}>
                <TrendingUp className="w-4 h-4" style={{ color: OPERATION_COLORS.carga }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Carga</p>
                <p className="text-[10px] text-muted-foreground">{formatNumber(Math.round(summary.carga.volume))} m³</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: OPERATION_COLORS.carga }}>{summary.carga.viagens}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>

          {/* Descarga */}
          <button 
            onClick={() => navigate('/operacao/descarga')}
            className="w-full flex items-center justify-between p-3 bg-card rounded-lg border hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.descarga}20` }}>
                <ArrowDownRight className="w-4 h-4" style={{ color: OPERATION_COLORS.descarga }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Descarga</p>
                <p className="text-[10px] text-muted-foreground">{summary.descarga.locais} locais</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: OPERATION_COLORS.descarga }}>{summary.descarga.viagens}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>

          {/* Pedreira */}
          <button 
            onClick={() => navigate('/operacao/pedreira')}
            className="w-full flex items-center justify-between p-3 bg-card rounded-lg border hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.pedreira}20` }}>
                <Mountain className="w-4 h-4" style={{ color: OPERATION_COLORS.pedreira }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Pedreira</p>
                <p className="text-[10px] text-muted-foreground">{formatNumber(Math.round(summary.pedreira.toneladas))} ton</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: OPERATION_COLORS.pedreira }}>{summary.pedreira.viagens}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>

          {/* Pipas */}
          <button 
            onClick={() => navigate('/operacao/pipas')}
            className="w-full flex items-center justify-between p-3 bg-card rounded-lg border hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.pipas}20` }}>
                <Droplets className="w-4 h-4" style={{ color: OPERATION_COLORS.pipas }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Pipas</p>
                <p className="text-[10px] text-muted-foreground">{summary.pipas.veiculos} veículos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: OPERATION_COLORS.pipas }}>{summary.pipas.viagens}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>

          {/* Cal */}
          <button 
            onClick={() => navigate('/operacao/cal')}
            className="w-full flex items-center justify-between p-3 bg-card rounded-lg border hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.cal}20` }}>
                <FlaskConical className="w-4 h-4" style={{ color: OPERATION_COLORS.cal }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Cal</p>
                <div className="flex gap-2 text-[10px]">
                  <span className="text-green-600">+{formatNumber(Math.round(summary.cal.entradas))}</span>
                  <span className="text-red-600">-{formatNumber(Math.round(summary.cal.saidas))}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold" style={{ color: OPERATION_COLORS.cal }}>{formatNumber(Math.round(summary.cal.estoqueAtual))}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* Mini Chart Preview */}
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium">Últimos 7 dias</p>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setExpandedView(true)}>
                Ver detalhes
              </Button>
            </div>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrends}>
                  <Area type="monotone" dataKey="carga" stackId="1" stroke={OPERATION_COLORS.carga} fill={OPERATION_COLORS.carga} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="descarga" stackId="1" stroke={OPERATION_COLORS.descarga} fill={OPERATION_COLORS.descarga} fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Full Desktop/Expanded View
  return (
    <div className="space-y-4 md:space-y-6 px-1 md:px-0">
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold truncate">Dashboard Consolidado</h1>
              <p className="text-xs md:text-sm text-muted-foreground truncate">
                {selectedDate || format(new Date(), "dd/MM/yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isMobile && (
              <Button variant="outline" size="icon" onClick={() => setExpandedView(false)} className="shrink-0">
                <Minimize2 className="w-4 h-4" />
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={loadAllData} disabled={loading} className="shrink-0">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <Badge variant="outline" className="gap-1 px-3 py-1.5 w-fit text-xs">
          <Calendar className="w-3 h-3" />
          {availableDates.length} dias de dados
        </Badge>
      </div>

      {/* Main KPIs - Mobile: 2 cols, scrollable horizontally on very small */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-emerald-100 text-[10px] md:text-sm font-medium truncate">Total de Viagens</p>
                <p className="text-2xl md:text-4xl font-bold mt-0.5 md:mt-1">{formatNumber(totalViagens)}</p>
                <p className="text-emerald-100 text-[10px] md:text-sm mt-0.5 md:mt-1 truncate">{selectedDate}</p>
              </div>
              <div className="p-2 md:p-3 bg-white/20 rounded-lg shrink-0">
                <Truck className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-blue-100 text-[10px] md:text-sm font-medium truncate">Volume Total</p>
                <p className="text-2xl md:text-4xl font-bold mt-0.5 md:mt-1">{formatNumber(Math.round(totalVolume))}</p>
                <p className="text-blue-100 text-[10px] md:text-sm mt-0.5 md:mt-1 truncate">{selectedDate}</p>
              </div>
              <div className="p-2 md:p-3 bg-white/20 rounded-lg shrink-0">
                <TrendingUp className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 text-white ${summary.carga.viagens - summary.descarga.viagens > 0 ? 'bg-gradient-to-br from-orange-500 to-orange-600' : 'bg-gradient-to-br from-green-500 to-green-600'}`}>
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-[10px] md:text-sm font-medium truncate ${summary.carga.viagens - summary.descarga.viagens > 0 ? 'text-orange-100' : 'text-green-100'}`}>Sem Apontamento</p>
                <p className="text-2xl md:text-4xl font-bold mt-0.5 md:mt-1">{formatNumber(Math.abs(summary.carga.viagens - summary.descarga.viagens))}</p>
                <p className={`text-[10px] md:text-sm mt-0.5 md:mt-1 truncate ${summary.carga.viagens - summary.descarga.viagens > 0 ? 'text-orange-100' : 'text-green-100'}`}>{selectedDate}</p>
              </div>
              <div className="p-2 md:p-3 bg-white/20 rounded-lg shrink-0">
                <AlertTriangle className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-amber-100 text-[10px] md:text-sm font-medium truncate">Pedreira</p>
                <p className="text-2xl md:text-4xl font-bold mt-0.5 md:mt-1">{formatNumber(Math.round(summary.pedreira.toneladas))}</p>
                <p className="text-amber-100 text-[10px] md:text-sm mt-0.5 md:mt-1 truncate">{selectedDate}</p>
              </div>
              <div className="p-2 md:p-3 bg-white/20 rounded-lg shrink-0">
                <Mountain className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 col-span-2 md:col-span-1">
          <CardContent className="p-3 md:pt-6 md:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-purple-100 text-[10px] md:text-sm font-medium truncate">Estoque Cal</p>
                <p className="text-2xl md:text-4xl font-bold mt-0.5 md:mt-1">{formatNumber(Math.round(summary.cal.estoqueAtual))}</p>
                <p className="text-purple-100 text-[10px] md:text-sm mt-0.5 md:mt-1 truncate">{selectedDate}</p>
              </div>
              <div className="p-2 md:p-3 bg-white/20 rounded-lg shrink-0">
                <FlaskConical className="w-4 h-4 md:w-6 md:h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations Cards Grid - Mobile: horizontal scroll */}
      <div className="overflow-x-auto -mx-1 md:mx-0 pb-2">
        <div className="flex md:grid md:grid-cols-5 gap-2 md:gap-4 min-w-max md:min-w-0 px-1 md:px-0">
          {/* Carga */}
          <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] w-[140px] md:w-auto shrink-0" onClick={() => navigate('/operacao/carga')}>
            <CardHeader className="p-3 md:pb-2 md:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.carga}20` }}>
                    <TrendingUp className="w-3 h-3 md:w-4 md:h-4" style={{ color: OPERATION_COLORS.carga }} />
                  </div>
                  Carga
                </CardTitle>
                <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <p className="text-xl md:text-3xl font-bold" style={{ color: OPERATION_COLORS.carga }}>{summary.carga.viagens}</p>
              <p className="text-xs md:text-sm text-muted-foreground">viagens</p>
              <div className="mt-2 md:mt-3 space-y-0.5 md:space-y-1 text-[10px] md:text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Volume:</span>
                  <span className="font-medium">{formatNumber(Math.round(summary.carga.volume))} m³</span>
                </div>
                <div className="flex justify-between">
                  <span>Escav.:</span>
                  <span className="font-medium">{summary.carga.escavadeiras}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Descarga */}
          <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] w-[140px] md:w-auto shrink-0" onClick={() => navigate('/operacao/descarga')}>
            <CardHeader className="p-3 md:pb-2 md:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.descarga}20` }}>
                    <ArrowDownRight className="w-3 h-3 md:w-4 md:h-4" style={{ color: OPERATION_COLORS.descarga }} />
                  </div>
                  Descarga
                </CardTitle>
                <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <p className="text-xl md:text-3xl font-bold" style={{ color: OPERATION_COLORS.descarga }}>{summary.descarga.viagens}</p>
              <p className="text-xs md:text-sm text-muted-foreground">viagens</p>
              <div className="mt-2 md:mt-3 space-y-0.5 md:space-y-1 text-[10px] md:text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Volume:</span>
                  <span className="font-medium">{formatNumber(Math.round(summary.descarga.volume))} m³</span>
                </div>
                <div className="flex justify-between">
                  <span>Locais:</span>
                  <span className="font-medium">{summary.descarga.locais}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pedreira */}
          <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] w-[140px] md:w-auto shrink-0" onClick={() => navigate('/operacao/pedreira')}>
            <CardHeader className="p-3 md:pb-2 md:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.pedreira}20` }}>
                    <Mountain className="w-3 h-3 md:w-4 md:h-4" style={{ color: OPERATION_COLORS.pedreira }} />
                  </div>
                  Pedreira
                </CardTitle>
                <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <p className="text-xl md:text-3xl font-bold" style={{ color: OPERATION_COLORS.pedreira }}>{summary.pedreira.viagens}</p>
              <p className="text-xs md:text-sm text-muted-foreground">viagens</p>
              <div className="mt-2 md:mt-3 space-y-0.5 md:space-y-1 text-[10px] md:text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Toneladas:</span>
                  <span className="font-medium">{formatNumber(Math.round(summary.pedreira.toneladas))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frete:</span>
                  <span className="font-medium">{formatCurrency(summary.pedreira.frete)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipas */}
          <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] w-[140px] md:w-auto shrink-0" onClick={() => navigate('/operacao/pipas')}>
            <CardHeader className="p-3 md:pb-2 md:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.pipas}20` }}>
                    <Droplets className="w-3 h-3 md:w-4 md:h-4" style={{ color: OPERATION_COLORS.pipas }} />
                  </div>
                  Pipas
                </CardTitle>
                <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <p className="text-xl md:text-3xl font-bold" style={{ color: OPERATION_COLORS.pipas }}>{summary.pipas.viagens}</p>
              <p className="text-xs md:text-sm text-muted-foreground">viagens</p>
              <div className="mt-2 md:mt-3 space-y-0.5 md:space-y-1 text-[10px] md:text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Veículos:</span>
                  <span className="font-medium">{summary.pipas.veiculos}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cal */}
          <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] w-[140px] md:w-auto shrink-0" onClick={() => navigate('/operacao/cal')}>
            <CardHeader className="p-3 md:pb-2 md:p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm md:text-base flex items-center gap-1.5 md:gap-2">
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OPERATION_COLORS.cal}20` }}>
                    <FlaskConical className="w-3 h-3 md:w-4 md:h-4" style={{ color: OPERATION_COLORS.cal }} />
                  </div>
                  Cal
                </CardTitle>
                <ArrowUpRight className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <p className="text-xl md:text-3xl font-bold" style={{ color: OPERATION_COLORS.cal }}>{formatNumber(Math.round(summary.cal.estoqueAtual))}</p>
              <p className="text-xs md:text-sm text-muted-foreground">ton estoque</p>
              <div className="mt-2 md:mt-3 space-y-0.5 md:space-y-1 text-[10px] md:text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span className="text-green-600">Ent:</span>
                  <span className="font-medium text-green-600">+{formatNumber(Math.round(summary.cal.entradas))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-600">Saí:</span>
                  <span className="font-medium text-red-600">-{formatNumber(Math.round(summary.cal.saidas))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts Row - Stack on mobile */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Trends Chart - Navy Blue Bar Chart */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Activity className="w-4 h-4 md:w-5 md:h-5" />
              Produção dos Últimos Dias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div className="h-[200px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrends} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    className="text-[10px] md:text-xs" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis 
                    className="text-[10px] md:text-xs" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                    width={35}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value} viagens`, 'Total']}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Bar 
                    dataKey="total" 
                    fill="#7f1d1d" 
                    radius={[4, 4, 0, 0]}
                    name="Total Viagens"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribution Chart */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <PieChartIcon className="w-4 h-4 md:w-5 md:h-5" />
              Distribuição ({selectedDate?.split('/').slice(0, 2).join('/')})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0">
            <div className="h-[200px] md:h-[300px]">
              {operationDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={operationDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {operationDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Nenhum dado para exibir
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-2 md:gap-4 mt-2 md:mt-4">
              {operationDistribution.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs md:text-sm">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators - Compact on mobile */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <Target className="w-4 h-4 md:w-5 md:h-5" />
            Performance do Dia
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Comparativo para {selectedDate}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="space-y-4 md:space-y-6">
            {/* Carga Progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: OPERATION_COLORS.carga }} />
                  <span className="font-medium text-xs md:text-sm">Carga</span>
                </div>
                <span className="text-xs md:text-sm text-muted-foreground">{summary.carga.viagens} viagens</span>
              </div>
              <Progress value={totalViagens > 0 ? (summary.carga.viagens / totalViagens) * 100 : 0} className="h-1.5 md:h-2" style={{ '--progress-background': OPERATION_COLORS.carga } as any} />
            </div>

            {/* Descarga Progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: OPERATION_COLORS.descarga }} />
                  <span className="font-medium text-xs md:text-sm">Descarga</span>
                </div>
                <span className="text-xs md:text-sm text-muted-foreground">{summary.descarga.viagens} viagens</span>
              </div>
              <Progress value={totalViagens > 0 ? (summary.descarga.viagens / totalViagens) * 100 : 0} className="h-1.5 md:h-2" />
            </div>

            {/* Pedreira Progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: OPERATION_COLORS.pedreira }} />
                  <span className="font-medium text-xs md:text-sm">Pedreira</span>
                </div>
                <span className="text-xs md:text-sm text-muted-foreground">{summary.pedreira.viagens} viagens</span>
              </div>
              <Progress value={totalViagens > 0 ? (summary.pedreira.viagens / totalViagens) * 100 : 0} className="h-1.5 md:h-2" />
            </div>

            {/* Pipas Progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full" style={{ backgroundColor: OPERATION_COLORS.pipas }} />
                  <span className="font-medium text-xs md:text-sm">Pipas</span>
                </div>
                <span className="text-xs md:text-sm text-muted-foreground">{summary.pipas.viagens} viagens</span>
              </div>
              <Progress value={totalViagens > 0 ? (summary.pipas.viagens / totalViagens) * 100 : 0} className="h-1.5 md:h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
