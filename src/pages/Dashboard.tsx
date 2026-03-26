import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format, parse, subDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, TrendingUp, Truck, HardHat, Filter, Loader2, BarChart3, AlertCircle, RefreshCw, MessageCircle, FileDown, Send, Droplets, Fuel, Wrench, CloudRain, LayoutGrid } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, Label, LabelList } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DashboardCalTab } from '@/components/dashboard/DashboardCalTab';
import { DashboardPedreiraTab } from '@/components/dashboard/DashboardPedreiraTab';
import { DashboardPipasTab } from '@/components/dashboard/DashboardPipasTab';
import { DashboardAbastecimentoTab } from '@/components/dashboard/DashboardAbastecimentoTab';
import { DashboardFrotaGeralTab } from '@/components/dashboard/DashboardFrotaGeralTab';
import { DashboardEvolucaoTab } from '@/components/dashboard/DashboardEvolucaoTab';
import { useAuth } from '@/contexts/AuthContext';
import { usePageLayout, BlockDefinition } from '@/hooks/usePageLayout';
import { PageLayoutConfigModal } from '@/components/crud/PageLayoutConfigModal';

const DASHBOARD_CARGA_BLOCKS: BlockDefinition[] = [
  { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
  { key: 'stats_cards', defaultLabel: 'Cards de Indicadores Diários' },
  { key: 'charts_caminhoes_escavadeiras', defaultLabel: 'Gráficos Top 10 (Caminhões/Escavadeiras)' },
  { key: 'material_distribution', defaultLabel: 'Materiais + Pluviometria + Atividades' },
  { key: 'period_stats', defaultLabel: 'Produção do Mês (Gráfico)' },
  { key: 'monthly_consolidation', defaultLabel: 'Consolidado Geral do Período' },
];


interface DashboardStats {
  viagens: number;
  volumeTransportado: number;
  escavadeirasAtivas: number;
  totalEscavadeiras: number;
  caminhoesAtivos: number;
  totalCaminhoes: number;
  mediaCaminhao: number;
}

interface PeriodStats {
  totalViagens: number;
  totalVolumeTransportado: number;
  totalVolumeEscavado: number;
  diasComDados: number;
}

interface ChartData {
  escavadeirasProd: { name: string; viagens: number; volume: number }[];
  caminhoesProd: { name: string; viagens: number; volume: number }[];
  locaisProd: { name: string; volume: number }[];
  materiaisDist: { name: string; value: number }[];
  atividadesRecentes: { id: string; hora: string; escavadeira: string; caminhao: string; material: string; volume: string }[];
  producaoDiaria: { date: string; viagens: number; volume: number }[];
  producaoMensalPorLocal: { local: string; viagens: number; volume: number }[];
  producaoMensalPorMaterial: { material: string; viagens: number; volume: number }[];
}

interface LocalSearchResult {
  local: string;
  viagens: number;
  volume: number;
  escavadeiras: string[];
  caminhoes: string[];
  materiais: { [key: string]: number };
}

interface RawData {
  headers: string[];
  rows: any[][];
  availableDates: string[];
}

const CAMINHAO_COLORS = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b', '#10b981', '#14b8a6', '#6366f1', '#8b5cf6'];
const ESCAVADEIRA_COLORS = ['#f97316', '#22c55e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#a855f7'];

const COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4', '#84cc16'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const { configs: layoutConfigs, isBlockVisible, saveConfigs: saveLayoutConfigs } = usePageLayout('dashboard_carga', DASHBOARD_CARGA_BLOCKS);
  const [showLayoutConfig, setShowLayoutConfig] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [rawData, setRawData] = useState<RawData>({ headers: [], rows: [], availableDates: [] });
  const [descargaRawData, setDescargaRawData] = useState<any[][]>([]);
  
  const [stats, setStats] = useState<DashboardStats>({
    viagens: 0,
    volumeTransportado: 0,
    escavadeirasAtivas: 0,
    totalEscavadeiras: 19,
    caminhoesAtivos: 0,
    totalCaminhoes: 36,
    mediaCaminhao: 0,
  });
  const [chartData, setChartData] = useState<ChartData>({
    escavadeirasProd: [],
    caminhoesProd: [],
    locaisProd: [],
    materiaisDist: [],
    atividadesRecentes: [],
    producaoDiaria: [],
    producaoMensalPorLocal: [],
    producaoMensalPorMaterial: [],
  });
  const { readSheet, loading } = useGoogleSheets();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodStats, setPeriodStats] = useState<PeriodStats>({ totalViagens: 0, totalVolumeTransportado: 0, totalVolumeEscavado: 0, diasComDados: 0 });
  const [localSearchResults, setLocalSearchResults] = useState<LocalSearchResult[]>([]);
  const [allLocais, setAllLocais] = useState<string[]>([]);
  const [selectedSearchLocal, setSelectedSearchLocal] = useState<string>('todos');
  const [searchDateStart, setSearchDateStart] = useState<string>('');
  const [searchDateEnd, setSearchDateEnd] = useState<string>('');
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [showWhatsAppExport, setShowWhatsAppExport] = useState(false);
  const [pluvioData, setPluvioData] = useState<{ data: string; quantidade: number; dia: number; mes: number; ano: number }[]>([]);
  const { toast } = useToast();

  // Tab swipe navigation
  const TAB_ORDER = ['carga', 'cal', 'pedreira', 'pipas', 'abastecimento', 'frota-geral', 'evolucao'] as const;
  const [activeTab, setActiveTab] = useState<string>('carga');
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    setActiveTab(prev => {
      const idx = TAB_ORDER.indexOf(prev as any);
      if (direction === 'left' && idx < TAB_ORDER.length - 1) return TAB_ORDER[idx + 1];
      if (direction === 'right' && idx > 0) return TAB_ORDER[idx - 1];
      return prev;
    });
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Only trigger if horizontal swipe is dominant and > 60px
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      handleSwipe(dx < 0 ? 'left' : 'right');
    }
  }, [handleSwipe]);

  // Load all data once
  useEffect(() => {
    loadAllData();
  }, []);


  // Process data when date changes - using a separate handler
  const handleDateChange = (newDate: string) => {
    console.log('Date changed to:', newDate);
    setSelectedDate(newDate);
  };

  // Trigger processing when rawData or selectedDate changes
  useEffect(() => {
    if (selectedDate && rawData.rows.length > 0 && rawData.headers.length > 0) {
      console.log('Processing data for date:', selectedDate, 'with', rawData.rows.length, 'rows');
      processDataForDate(selectedDate);
    }
  }, [selectedDate, rawData.rows.length]);

  const loadAllData = async () => {
    try {
      const [cargaData, descargaData, pluvioRaw] = await Promise.all([
        readSheet('Carga'),
        readSheet('Descarga').catch(() => []),
        readSheet('Pluviometria').catch(() => [])
      ]);
      
      // Parse pluviometria
      if (pluvioRaw && pluvioRaw.length > 1) {
        const parsed = pluvioRaw.slice(1).map((r: any[]) => {
          const dateStr = r[0] || '';
          const parts = dateStr.split('/');
          return {
            data: dateStr,
            quantidade: parseFloat(r[1]) || 0,
            dia: parts.length === 3 ? parseInt(parts[0]) : 0,
            mes: parts.length === 3 ? parseInt(parts[1]) : 0,
            ano: parts.length === 3 ? parseInt(parts[2]) : 0,
          };
        }).filter((r: any) => r.data);
        setPluvioData(parsed);
      }
      
      // Store descarga data for divergence report
      setDescargaRawData(descargaData || []);
      
      if (cargaData.length > 1) {
        const headers = cargaData[0];
        const rows = cargaData.slice(1);
        const dateIndex = headers.indexOf('Data');
        
        // Get unique dates and sort them (most recent first)
        const datesSet = new Set<string>();
        rows.forEach(row => {
          const dateVal = row[dateIndex];
          if (dateVal && typeof dateVal === 'string' && dateVal.includes('/')) {
            datesSet.add(dateVal);
          }
        });
        
        const availableDates = Array.from(datesSet).sort((a, b) => {
          const dateA = parse(a, 'dd/MM/yyyy', new Date());
          const dateB = parse(b, 'dd/MM/yyyy', new Date());
          return dateB.getTime() - dateA.getTime();
        });

        console.log('Available dates:', availableDates.slice(0, 10));
        
        setRawData({ headers, rows, availableDates });
        
        // Calculate period totals
        const volumeTotalIdx = headers.indexOf('Volume_Total');
        const volumeIdx = headers.indexOf('Volume');
        const viagensIdx = headers.indexOf('N_Viagens');
        const viagensIdxAlt = headers.indexOf('I_Viagens');
        const prefixoEqIdx = headers.indexOf('Prefixo_Eq');

        let pTotalViagens = 0;
        let pTotalVolTransp = 0;
        const escavadeiraVolumeMap = new Map<string, number>();

        rows.forEach(row => {
          const rawV = viagensIdx !== -1 ? row[viagensIdx] : viagensIdxAlt !== -1 ? row[viagensIdxAlt] : undefined;
          const v = Math.max(1, parseInt(String(rawV ?? '1'), 10) || 1);
          pTotalViagens += v;

          const volTotal = parseFloat(String(row[volumeTotalIdx] || 0).replace(',', '.'));
          const volUnit = parseFloat(String(row[volumeIdx] || 0).replace(',', '.'));
          const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (v * (isNaN(volUnit) ? 0 : volUnit));
          pTotalVolTransp += vol;

          const eq = row[prefixoEqIdx];
          if (eq) {
            escavadeiraVolumeMap.set(eq, (escavadeiraVolumeMap.get(eq) || 0) + vol);
          }
        });

        const pTotalVolEscavado = Array.from(escavadeiraVolumeMap.values()).reduce((s, v) => s + v, 0);

        setPeriodStats({
          totalViagens: pTotalViagens,
          totalVolumeTransportado: Math.round(pTotalVolTransp * 100) / 100,
          totalVolumeEscavado: Math.round(pTotalVolEscavado * 100) / 100,
          diasComDados: availableDates.length,
        });

        // Auto-select the most recent date
        if (availableDates.length > 0 && !selectedDate) {
          setSelectedDate(availableDates[0]);
        }
        
        setDataLoaded(true);
      } else {
        setDataLoaded(true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setDataLoaded(true);
    }
  };

  const processDataForDate = (dateStr: string) => {
    const { headers, rows } = rawData;
    
    const getIdx = (name: string) => headers.indexOf(name);
    const dateIndex = getIdx('Data');
    const volumeTotalIndex = getIdx('Volume_Total');
    const volumeIndex = getIdx('Volume');
    const prefixoEqIndex = getIdx('Prefixo_Eq');
    const descricaoEqIndex = getIdx('Descricao_Eq');
    const prefixoCbIndex = getIdx('Prefixo_Cb');
    const localIndex = getIdx('Local_da_Obra');
    const materialIndex = getIdx('Material');
    const horaIndex = getIdx('Hora_Carga');
    const idIndex = getIdx('ID');

    // Trip count columns (some sheets use different names)
    const viagensIndex = getIdx('N_Viagens');
    const viagensIndexAlt = getIdx('I_Viagens');

    const getViagensFromRow = (row: any[]) => {
      const raw = viagensIndex !== -1 ? row[viagensIndex] : viagensIndexAlt !== -1 ? row[viagensIndexAlt] : undefined;
      const parsed = parseInt(String(raw ?? '1'), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };

    // Filter data for selected date
    const todayData = rows.filter(row => row[dateIndex] === dateStr);

    console.log(`Processing ${todayData.length} rows for date ${dateStr}`);

    // Calculate stats (Total de viagens = soma de N_Viagens/I_Viagens)
    const viagens = todayData.reduce((sum, row) => sum + getViagensFromRow(row), 0);
    
    // Calcular volume transportado corretamente: viagens * volume (capacidade) quando Volume_Total não está preenchido
    const volumeTransportado = todayData.reduce((sum, row) => {
      const volTotal = parseFloat(String(row[volumeTotalIndex] || 0).replace(',', '.'));
      const volUnitario = parseFloat(String(row[volumeIndex] || 0).replace(',', '.'));
      const numViagens = getViagensFromRow(row);
      
      // Se Volume_Total já está preenchido, usar ele; senão calcular viagens * volume
      const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (numViagens * (isNaN(volUnitario) ? 0 : volUnitario));
      return sum + vol;
    }, 0);

    const escavadeirasSet = new Set(todayData.map(row => row[prefixoEqIndex]).filter(Boolean));
    const caminhoesSet = new Set(todayData.map(row => row[prefixoCbIndex]).filter(Boolean));
    const escavadeirasAtivas = escavadeirasSet.size;
    const caminhoesAtivos = caminhoesSet.size;
    const mediaCaminhao = caminhoesAtivos > 0 ? viagens / caminhoesAtivos : 0;

    setStats({
      viagens,
      volumeTransportado: Math.round(volumeTransportado * 100) / 100,
      escavadeirasAtivas,
      totalEscavadeiras: 19,
      caminhoesAtivos,
      totalCaminhoes: 36,
      mediaCaminhao: Math.round(mediaCaminhao),
    });

    // Production by excavator (somando viagens por registro)
    const escavadeiraProdMap = new Map<string, { viagens: number; volume: number; descricao: string }>();
    todayData.forEach(row => {
      const eq = row[prefixoEqIndex];
      if (eq) {
        const current = escavadeiraProdMap.get(eq) || { viagens: 0, volume: 0, descricao: '' };
        const volTotal = parseFloat(String(row[volumeTotalIndex] || 0).replace(',', '.'));
        const volUnitario = parseFloat(String(row[volumeIndex] || 0).replace(',', '.'));
        const v = getViagensFromRow(row);
        const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (v * (isNaN(volUnitario) ? 0 : volUnitario));
        const desc = descricaoEqIndex !== -1 ? (row[descricaoEqIndex] || '') : '';
        escavadeiraProdMap.set(eq, {
          viagens: current.viagens + v,
          volume: current.volume + vol,
          descricao: current.descricao || desc,
        });
      }
    });
    const escavadeirasProd = Array.from(escavadeiraProdMap.entries())
      .map(([prefixo, data]) => {
        const potMatch = (data.descricao || '').match(/(\d{3,4})/);
        const name = potMatch ? `${prefixo} (Pot. ${potMatch[1]})` : prefixo;
        return { name, viagens: data.viagens, volume: Math.round(data.volume) };
      })
      .sort((a, b) => b.viagens - a.viagens)
      .slice(0, 10);

    // Production by truck (somando viagens por registro)
    const caminhaoProdMap = new Map<string, { viagens: number; volume: number }>();
    todayData.forEach(row => {
      const cb = row[prefixoCbIndex];
      if (cb) {
        const current = caminhaoProdMap.get(cb) || { viagens: 0, volume: 0 };
        const volTotal = parseFloat(String(row[volumeTotalIndex] || 0).replace(',', '.'));
        const volUnitario = parseFloat(String(row[volumeIndex] || 0).replace(',', '.'));
        const v = getViagensFromRow(row);
        const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (v * (isNaN(volUnitario) ? 0 : volUnitario));
        caminhaoProdMap.set(cb, {
          viagens: current.viagens + v,
          volume: current.volume + vol,
        });
      }
    });
    const caminhoesProd = Array.from(caminhaoProdMap.entries())
      .map(([name, data]) => ({ name, viagens: data.viagens, volume: Math.round(data.volume) }))
      .sort((a, b) => b.viagens - a.viagens)
      .slice(0, 10);

    // Production by location
    const localProdMap = new Map<string, number>();
    todayData.forEach(row => {
      const local = row[localIndex];
      if (local) {
        const current = localProdMap.get(local) || 0;
        const vol = parseFloat(String(row[volumeIndex] || 0).replace(',', '.'));
        localProdMap.set(local, current + (isNaN(vol) ? 0 : vol));
      }
    });
    const locaisProd = Array.from(localProdMap.entries())
      .map(([name, volume]) => ({ name, volume: Math.round(volume) }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 8);

    // Material distribution (somando viagens)
    const materialMap = new Map<string, number>();
    todayData.forEach(row => {
      const material = row[materialIndex] || 'Não especificado';
      const v = getViagensFromRow(row);
      materialMap.set(material, (materialMap.get(material) || 0) + v);
    });
    const materiaisDist = Array.from(materialMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Recent activities
    const atividadesRecentes = todayData
      .slice(-10)
      .reverse()
      .map(row => ({
        id: row[idIndex] || '',
        hora: row[horaIndex] || '',
        escavadeira: row[prefixoEqIndex] || '',
        caminhao: row[prefixoCbIndex] || '',
        material: row[materialIndex] || '',
        volume: row[volumeIndex] || '',
      }));

    // Monthly production - all days of the current month
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const monthDates = rawData.availableDates.filter(d => {
      const parts = d.split('/').map(Number);
      return parts.length >= 3 && parts[1] - 1 === curMonth && parts[2] === curYear;
    }).reverse(); // chronological order

    const producaoDiaria = monthDates.map(date => {
      const dayData = rows.filter(row => row[dateIndex] === date);
      const dayViagens = dayData.reduce((sum, row) => sum + getViagensFromRow(row), 0);
      const dayVolume = dayData.reduce((sum, row) => {
        const vol = parseFloat(String(row[volumeIndex] || 0).replace(',', '.'));
        return sum + (isNaN(vol) ? 0 : vol);
      }, 0);
      return {
        date: date.substring(0, 5),
        viagens: dayViagens,
        volume: Math.round(dayVolume),
      };
    });

    // Monthly volume by local
    const monthRows = rows.filter(row => {
      const d = row[dateIndex];
      if (!d || typeof d !== 'string') return false;
      const parts = d.split('/').map(Number);
      return parts.length >= 3 && parts[1] - 1 === curMonth && parts[2] === curYear;
    });
    const localMonthMap = new Map<string, { viagens: number; volume: number }>();
    monthRows.forEach(row => {
      const local = row[localIndex] || 'Sem local';
      const cur = localMonthMap.get(local) || { viagens: 0, volume: 0 };
      const v = getViagensFromRow(row);
      const volTotal = parseFloat(String(row[volumeTotalIndex] || 0).replace(',', '.'));
      const volUnit = parseFloat(String(row[volumeIndex] || 0).replace(',', '.'));
      const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (v * (isNaN(volUnit) ? 0 : volUnit));
      localMonthMap.set(local, { viagens: cur.viagens + v, volume: cur.volume + vol });
    });
    const producaoMensalPorLocal = Array.from(localMonthMap.entries())
      .map(([local, data]) => ({ local, viagens: data.viagens, volume: Math.round(data.volume) }))
      .sort((a, b) => b.volume - a.volume);

    // Monthly volume by material
    const materialMonthMap = new Map<string, { viagens: number; volume: number }>();
    monthRows.forEach(row => {
      const mat = row[materialIndex] || 'Não especificado';
      const cur = materialMonthMap.get(mat) || { viagens: 0, volume: 0 };
      const v = getViagensFromRow(row);
      const volTotal = parseFloat(String(row[volumeTotalIndex] || 0).replace(',', '.'));
      const volUnit = parseFloat(String(row[volumeIndex] || 0).replace(',', '.'));
      const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (v * (isNaN(volUnit) ? 0 : volUnit));
      materialMonthMap.set(mat, { viagens: cur.viagens + v, volume: cur.volume + vol });
    });
    const producaoMensalPorMaterial = Array.from(materialMonthMap.entries())
      .map(([material, data]) => ({ material, viagens: data.viagens, volume: Math.round(data.volume) }))
      .sort((a, b) => b.volume - a.volume);

    setChartData({
      escavadeirasProd,
      caminhoesProd,
      locaisProd,
      materiaisDist,
      atividadesRecentes,
      producaoDiaria,
      producaoMensalPorLocal,
      producaoMensalPorMaterial,
    });

    // Extract unique locations for the search tab
    const uniqueLocais = [...new Set(rows.map(row => row[localIndex]).filter(Boolean))].sort();
    setAllLocais(uniqueLocais);
  };

  // Search by local/location
  const searchByLocal = useMemo(() => {
    if (!rawData.rows.length || !rawData.headers.length) return [];
    
    const { headers, rows } = rawData;
    const getIdx = (name: string) => headers.indexOf(name);
    const localIndex = getIdx('Local_da_Obra');
    const volumeIndex = getIdx('Volume_Total');
    const prefixoEqIndex = getIdx('Prefixo_Eq');
    const prefixoCbIndex = getIdx('Prefixo_Cb');
    const materialIndex = getIdx('Material');
    const dateIndex = getIdx('Data');

    // Parse date helper function
    const parseDate = (dateStr: string) => {
      if (!dateStr) return null;
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    };

    // Filter by date range or selected date
    let filteredRows = rows;
    if (useCustomPeriod && (searchDateStart || searchDateEnd)) {
      const startDate = searchDateStart ? parseDate(searchDateStart) : null;
      const endDate = searchDateEnd ? parseDate(searchDateEnd) : null;
      
      filteredRows = rows.filter(row => {
        const rowDate = parseDate(row[dateIndex]);
        if (!rowDate) return false;
        
        if (startDate && endDate) {
          return rowDate >= startDate && rowDate <= endDate;
        } else if (startDate) {
          return rowDate >= startDate;
        } else if (endDate) {
          return rowDate <= endDate;
        }
        return true;
      });
    } else if (selectedDate) {
      filteredRows = rows.filter(row => row[dateIndex] === selectedDate);
    }

    // Group data by local
    const localMap = new Map<string, LocalSearchResult>();

    const viagensIndex = getIdx('N_Viagens');
    const viagensIndexAlt = getIdx('I_Viagens');
    const getViagensFromRow = (row: any[]) => {
      const raw = viagensIndex !== -1 ? row[viagensIndex] : viagensIndexAlt !== -1 ? row[viagensIndexAlt] : undefined;
      const parsed = parseInt(String(raw ?? '1'), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };
    
    filteredRows.forEach(row => {
      const local = row[localIndex];
      if (!local) return;
      
      // Apply search filter
      if (searchTerm && !local.toLowerCase().includes(searchTerm.toLowerCase())) return;
      
      // Apply local selection filter
      if (selectedSearchLocal !== 'todos' && local !== selectedSearchLocal) return;
      
      const vol = parseFloat(String(row[volumeIndex] || 0).replace(',', '.'));
      const escavadeira = row[prefixoEqIndex];
      const caminhao = row[prefixoCbIndex];
      const material = row[materialIndex] || 'Não especificado';
      const v = getViagensFromRow(row);
      
      if (!localMap.has(local)) {
        localMap.set(local, {
          local,
          viagens: 0,
          volume: 0,
          escavadeiras: [],
          caminhoes: [],
          materiais: {},
        });
      }
      
      const current = localMap.get(local)!;
      current.viagens += v;
      current.volume += isNaN(vol) ? 0 : vol;
      
      if (escavadeira && !current.escavadeiras.includes(escavadeira)) {
        current.escavadeiras.push(escavadeira);
      }
      if (caminhao && !current.caminhoes.includes(caminhao)) {
        current.caminhoes.push(caminhao);
      }
      current.materiais[material] = (current.materiais[material] || 0) + v;
    });
    
    return Array.from(localMap.values()).sort((a, b) => b.viagens - a.viagens);
  }, [rawData, selectedDate, searchTerm, selectedSearchLocal, useCustomPeriod, searchDateStart, searchDateEnd]);

  const formatNumber = (num: number) => {
    return num.toLocaleString('pt-BR');
  };

  // Pivot table helper: rows=Locals, cols=Materials, values=volume
  const buildPivotTable = (filterFn?: (row: any[], dateIdx: number) => boolean) => {
    if (!rawData.rows.length || !rawData.headers.length) return { locals: [], materials: [], data: new Map<string, Map<string, number>>() };
    const { headers, rows } = rawData;
    const localIdx = headers.indexOf('Local_da_Obra');
    const materialIdx = headers.indexOf('Material');
    const volumeTotalIdx = headers.indexOf('Volume_Total');
    const volumeIdx = headers.indexOf('Volume');
    const viagensIdx = headers.indexOf('N_Viagens');
    const viagensIdxAlt = headers.indexOf('I_Viagens');
    const dateIdx = headers.indexOf('Data');
    if (localIdx === -1 || materialIdx === -1) return { locals: [], materials: [], data: new Map() };

    const data = new Map<string, Map<string, number>>();
    const materialsSet = new Set<string>();

    rows.forEach(row => {
      if (filterFn && !filterFn(row, dateIdx)) return;
      const loc = row[localIdx] || 'N/A';
      const mat = row[materialIdx] || 'Não especificado';
      const rawV = viagensIdx !== -1 ? row[viagensIdx] : viagensIdxAlt !== -1 ? row[viagensIdxAlt] : undefined;
      const v = Math.max(1, parseInt(String(rawV ?? '1'), 10) || 1);
      const volTotal = parseFloat(String(row[volumeTotalIdx] || 0).replace(',', '.'));
      const volUnit = parseFloat(String(row[volumeIdx] || 0).replace(',', '.'));
      const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (v * (isNaN(volUnit) ? 0 : volUnit));

      materialsSet.add(mat);
      if (!data.has(loc)) data.set(loc, new Map());
      const locMap = data.get(loc)!;
      locMap.set(mat, (locMap.get(mat) || 0) + vol);
    });

    // Sort materials by total volume desc
    const materials = Array.from(materialsSet);
    const matTotals = materials.map(m => {
      let total = 0;
      data.forEach(locMap => { total += locMap.get(m) || 0; });
      return { name: m, total };
    }).sort((a, b) => b.total - a.total);

    // Sort locals by total volume desc
    const locals = Array.from(data.keys()).map(loc => {
      let total = 0;
      data.get(loc)!.forEach(v => { total += v; });
      return { name: loc, total };
    }).sort((a, b) => b.total - a.total);

    return { locals, materials: matTotals.map(m => m.name), data };
  };

  // Period total pivot
  const periodPivot = useMemo(() => buildPivotTable(), [rawData]);

  // Current month pivot
  const currentMonthLabel = useMemo(() => {
    const now = new Date();
    return format(now, "MMMM/yyyy", { locale: ptBR });
  }, []);

  const monthPivot = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    return buildPivotTable((row, dateIdx) => {
      const dateStr = row[dateIdx];
      if (!dateStr) return false;
      const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
      return isValid(parsed) && parsed.getMonth() === curMonth && parsed.getFullYear() === curYear;
    });
  }, [rawData]);

  // Monthly summary: rows=months, cols=Escavado, Transportado, + top materials
  const monthlySummary = useMemo(() => {
    if (!rawData.rows.length || !rawData.headers.length) return { months: [] as any[], materials: [] as string[], excludedMaterials: [] as string[], totals: { escavado: 0, transportado: 0, byMaterial: new Map<string, number>() } };
    const { headers, rows } = rawData;
    const dateIdx = headers.indexOf('Data');
    const volumeTotalIdx = headers.indexOf('Volume_Total');
    const volumeIdx = headers.indexOf('Volume');
    const viagensIdx = headers.indexOf('N_Viagens');
    const viagensIdxAlt = headers.indexOf('I_Viagens');
    const materialIdx = headers.indexOf('Material');
    if (dateIdx === -1) return { months: [], materials: [], excludedMaterials: [], totals: { escavado: 0, transportado: 0, byMaterial: new Map() } };

    const EXCLUDED_FROM_TOTALS = ['bgs', 'pedra ração', 'pedra racao', 'pedra rachão', 'pedra rachao'];
    const isExcluded = (mat: string) => EXCLUDED_FROM_TOTALS.includes(mat.toLowerCase());

    const monthMap = new Map<string, { label: string; sortKey: string; escavado: number; transportado: number; byMaterial: Map<string, number> }>();
    const allMaterials = new Set<string>();

    rows.forEach(row => {
      const dateStr = row[dateIdx];
      if (!dateStr) return;
      const parsed = parse(dateStr, 'dd/MM/yyyy', new Date());
      if (!isValid(parsed)) return;
      const monthKey = format(parsed, 'yyyy-MM');
      const monthLabel = format(parsed, 'MMMM/yyyy', { locale: ptBR });

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { label: monthLabel, sortKey: monthKey, escavado: 0, transportado: 0, byMaterial: new Map() });
      }
      const entry = monthMap.get(monthKey)!;

      const rawV = viagensIdx !== -1 ? row[viagensIdx] : viagensIdxAlt !== -1 ? row[viagensIdxAlt] : undefined;
      const v = Math.max(1, parseInt(String(rawV ?? '1'), 10) || 1);
      const volTotal = parseFloat(String(row[volumeTotalIdx] || 0).replace(',', '.'));
      const volUnit = parseFloat(String(row[volumeIdx] || 0).replace(',', '.'));
      const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (v * (isNaN(volUnit) ? 0 : volUnit));

      const mat = (row[materialIdx] || 'Não especificado').toString().trim();
      allMaterials.add(mat);
      entry.byMaterial.set(mat, (entry.byMaterial.get(mat) || 0) + vol);

      // Only count non-excluded materials in transportado/escavado
      if (!isExcluded(mat)) {
        entry.transportado += vol;
      }
    });

    // Calculate escavado per month (transportado / 1.217)
    monthMap.forEach(entry => {
      entry.escavado = entry.transportado / 1.217;
    });

    // Separate materials into included and excluded
    const matTotals = Array.from(allMaterials).map(m => {
      let total = 0;
      monthMap.forEach(entry => { total += entry.byMaterial.get(m) || 0; });
      return { name: m, total };
    }).sort((a, b) => b.total - a.total);

    const includedMaterials = matTotals.filter(m => !isExcluded(m.name)).map(m => m.name);
    const excludedMaterials = matTotals.filter(m => isExcluded(m.name)).map(m => m.name);

    const months = Array.from(monthMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const totals = {
      escavado: months.reduce((s, m) => s + m.escavado, 0),
      transportado: months.reduce((s, m) => s + m.transportado, 0),
      byMaterial: new Map<string, number>(),
    };
    [...includedMaterials, ...excludedMaterials].forEach(mat => {
      totals.byMaterial.set(mat, months.reduce((s, m) => s + (m.byMaterial.get(mat) || 0), 0));
    });

    return { months, materials: includedMaterials, excludedMaterials, totals };
  }, [rawData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const parsed = parse(selectedDate, 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) {
        return format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      }
    } catch {
      return selectedDate;
    }
    return selectedDate;
  }, [selectedDate]);

  // Generate WhatsApp message for daily summary
  const generateWhatsAppMessage = () => {
    const now = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    
    let message = `*📊 Resumo Diário de Carga*\n`;
    message += `_${formattedSelectedDate || selectedDate}_\n\n`;
    
    message += `*📈 INDICADORES GERAIS:*\n`;
    message += `• Total de Viagens: *${formatNumber(stats.viagens)}*\n`;
    message += `• Volume Transportado: *${formatNumber(stats.volumeTransportado)} m³*\n`;
    message += `• Escavadeiras Ativas: *${stats.escavadeirasAtivas}*\n`;
    message += `• Caminhões Ativos: *${stats.caminhoesAtivos}*\n`;
    message += `• Média por Caminhão: *${stats.mediaCaminhao} viagens*\n\n`;
    
    if (chartData.escavadeirasProd.length > 0) {
      message += `*🚜 TOP 5 ESCAVADEIRAS:*\n`;
      chartData.escavadeirasProd.slice(0, 5).forEach((eq, idx) => {
        message += `${idx + 1}. ${eq.name}: ${eq.viagens} viagens (${formatNumber(eq.volume)} m³)\n`;
      });
      message += '\n';
    }
    
    if (chartData.locaisProd.length > 0) {
      message += `*📍 PRODUÇÃO POR LOCAL:*\n`;
      chartData.locaisProd.slice(0, 5).forEach((loc) => {
        message += `• ${loc.name}: ${formatNumber(loc.volume)} m³\n`;
      });
      message += '\n';
    }
    
    if (chartData.materiaisDist.length > 0) {
      message += `*🪨 MATERIAIS:*\n`;
      chartData.materiaisDist.slice(0, 4).forEach((mat) => {
        message += `• ${mat.name}: ${mat.value} viagens\n`;
      });
    }
    
    message += `\n_Gerado em ${now}_`;
    
    return message;
  };

  // Send to WhatsApp
  const handleWhatsAppExport = (phone?: string) => {
    const message = generateWhatsAppMessage();
    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const whatsappUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    setShowWhatsAppExport(false);
    
    toast({
      title: 'WhatsApp aberto',
      description: 'Mensagem preparada para envio',
    });
  };

  // Export to PDF (print)
  const handlePDFExport = () => {
    window.print();
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Top-level module tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-3">
          <TabsList className="h-10 md:h-12 bg-muted/80 p-0.5 md:p-1 rounded-xl gap-0 md:gap-0.5 w-full border border-border/50 shadow-sm grid grid-cols-7">
            <TabsTrigger value="carga" className="gap-0.5 md:gap-1.5 px-1 md:px-3 py-2 md:py-2.5 text-[10px] md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all">
              <Truck className="w-3 h-3 md:w-4 md:h-4 hidden md:block" />
              Produção
            </TabsTrigger>
            <TabsTrigger value="cal" className="gap-0.5 md:gap-1.5 px-1 md:px-3 py-2 md:py-2.5 text-[10px] md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all">
              <BarChart3 className="w-3 h-3 md:w-4 md:h-4 hidden md:block" />
              CAL
            </TabsTrigger>
            <TabsTrigger value="pedreira" className="gap-0.5 md:gap-1.5 px-1 md:px-3 py-2 md:py-2.5 text-[10px] md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all">
              <HardHat className="w-3 h-3 md:w-4 md:h-4 hidden md:block" />
              Pedreira
            </TabsTrigger>
            <TabsTrigger value="pipas" className="gap-0.5 md:gap-1.5 px-1 md:px-3 py-2 md:py-2.5 text-[10px] md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all">
              <Droplets className="w-3 h-3 md:w-4 md:h-4 hidden md:block" />
              Pipas
            </TabsTrigger>
            <TabsTrigger value="abastecimento" className="gap-0.5 md:gap-1.5 px-1 md:px-3 py-2 md:py-2.5 text-[10px] md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all">
              <Fuel className="w-3 h-3 md:w-4 md:h-4 hidden md:block" />
              Abastec.
            </TabsTrigger>
            <TabsTrigger value="frota-geral" className="gap-0.5 md:gap-1.5 px-1 md:px-3 py-2 md:py-2.5 text-[10px] md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all">
              <Truck className="w-3 h-3 md:w-4 md:h-4 hidden md:block" />
              Frota
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="gap-0.5 md:gap-1.5 px-1 md:px-3 py-2 md:py-2.5 text-[10px] md:text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all">
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 hidden md:block" />
              Evolução
            </TabsTrigger>
          </TabsList>
        </div>

        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <TabsContent value="carga">
        <div className="space-y-4 md:space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAllData} disabled={loading} className="text-xs md:text-sm h-8 md:h-9">
            <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-1.5 md:ml-2">Atualizar</span>
          </Button>
          {isMainAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowLayoutConfig(true)} className="text-xs md:text-sm h-8 md:h-9 gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden md:inline">Layout</span>
            </Button>
          )}
        </div>
      </div>

      {/* Carga Dashboard Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-lg md:text-2xl font-bold">Dashboard de Carga</h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          {formattedSelectedDate || 'Carregando...'}
        </p>
      </div>


          {/* Loading or No Data State */}
          {loading && !dataLoaded ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !dataLoaded ? (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Carregando dados...</h3>
                <p className="text-muted-foreground">Aguarde enquanto os dados são carregados da planilha.</p>
              </div>
            </Card>
          ) : rawData.availableDates.length === 0 ? (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum dado encontrado</h3>
                <p className="text-muted-foreground">Todas as planilhas estão vazias, preciso importar os arquivos completos, com os lançamentos</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">

          {/* ===== DADOS DIÁRIOS ===== */}
          <div className="bg-blue-50/60 dark:bg-blue-950/20 rounded-xl p-4 md:p-6 border border-blue-200/50 dark:border-blue-800/30">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-800 dark:text-blue-300">Dados do Dia</span>
                <Badge variant="outline" className="text-[10px] border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400">{selectedDate}</Badge>
              </h2>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedDate} onValueChange={handleDateChange}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                    <SelectValue placeholder="Selecione uma data" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawData.availableDates.slice(0, 30).map((date) => (
                      <SelectItem key={date} value={date}>
                        {date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

          {/* Stats Cards */}
          {isBlockVisible('stats_cards') && (
          <div className="grid gap-2.5 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] md:text-sm font-medium opacity-80 truncate">Viagens</p>
                    <p className="text-xl md:text-3xl font-bold leading-tight">{formatNumber(stats.viagens)}</p>
                    <p className="text-[10px] md:text-sm opacity-70 truncate">{selectedDate}</p>
                  </div>
                  <div className="p-1.5 md:p-2 bg-white/20 rounded-lg">
                    <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] md:text-sm font-medium text-muted-foreground truncate">Vol. Transportado</p>
                    <p className="text-xl md:text-3xl font-bold leading-tight">{formatNumber(stats.volumeTransportado)}</p>
                    <p className="text-[10px] md:text-sm text-muted-foreground truncate">m³ movimentado</p>
                  </div>
                  <div className="p-1.5 md:p-2 bg-green-100 text-green-600 rounded-lg shrink-0">
                    <Truck className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
              <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] md:text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">Escavadeiras</p>
                    <p className="text-xl md:text-3xl font-bold text-emerald-800 dark:text-emerald-200 leading-tight">{stats.escavadeirasAtivas}</p>
                    <p className="text-[10px] md:text-sm text-emerald-600 dark:text-emerald-400 truncate">ativas no dia</p>
                  </div>
                  <div className="p-1.5 md:p-2 bg-emerald-200 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-300 rounded-lg shrink-0">
                    <HardHat className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] md:text-sm font-medium text-muted-foreground truncate">Caminhões</p>
                    <p className="text-xl md:text-3xl font-bold leading-tight">{stats.caminhoesAtivos}</p>
                    <p className="text-[10px] md:text-sm text-muted-foreground truncate">ativos no dia</p>
                  </div>
                  <div className="p-1.5 md:p-2 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-lg shrink-0">
                    <Truck className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] md:text-sm font-medium text-muted-foreground truncate">Média/Caminhão</p>
                    <p className="text-xl md:text-3xl font-bold leading-tight">{stats.mediaCaminhao}</p>
                    <p className="text-[10px] md:text-sm text-muted-foreground truncate">viagens/caminhão</p>
                  </div>
                  <div className="p-1.5 md:p-2 bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300 rounded-lg shrink-0">
                    <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Production Charts */}
          {isBlockVisible('charts_caminhoes_escavadeiras') && (
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Top 10 Caminhões + Escavadeiras */}
            <Card>
              <CardHeader className="pb-2 p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <Truck className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                  Top 10 Caminhões
                </CardTitle>
                <p className="text-xs text-muted-foreground">Viagens em {selectedDate}</p>
              </CardHeader>
              <CardContent className="p-2 md:p-6 pt-0">
                {chartData.caminhoesProd.length > 0 ? (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...chartData.caminhoesProd].reverse()} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={55} reversed />
                        <Tooltip formatter={(value: number) => [`${value} viagens`, 'Viagens']} contentStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="viagens" radius={[0, 4, 4, 0]} barSize={20}>
                          {[...chartData.caminhoesProd].reverse().map((_, index) => (
                            <Cell key={`cell-cam-${index}`} fill={CAMINHAO_COLORS[index % CAMINHAO_COLORS.length]} />
                          ))}
                          <LabelList dataKey="viagens" position="right" fontSize={11} fontWeight={600} fill="hsl(var(--foreground))" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12">Nenhum dado</p>
                )}
              </CardContent>
            </Card>

            {/* Top 10 Escavadeiras */}
            <Card>
              <CardHeader className="pb-2 p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <HardHat className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                  Top 10 Escavadeiras
                </CardTitle>
                <p className="text-xs text-muted-foreground">Viagens em {selectedDate}</p>
              </CardHeader>
              <CardContent className="p-2 md:p-6 pt-0">
                {chartData.escavadeirasProd.length > 0 ? (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...chartData.escavadeirasProd].reverse()} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={100} reversed />
                        <Tooltip formatter={(value: number) => [`${value} viagens`, 'Viagens']} contentStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="viagens" radius={[0, 4, 4, 0]} barSize={20}>
                          {[...chartData.escavadeirasProd].reverse().map((_, index) => (
                            <Cell key={`cell-esc-${index}`} fill={ESCAVADEIRA_COLORS[index % ESCAVADEIRA_COLORS.length]} />
                          ))}
                          <LabelList dataKey="viagens" position="right" fontSize={11} fontWeight={600} fill="hsl(var(--foreground))" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12">Nenhum dado</p>
                )}
              </CardContent>
            </Card>
          </div>
          )}

          {/* Material Distribution */}
          {isBlockVisible('material_distribution') && (
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-sm md:text-base">Distribuição por Material</CardTitle>
                <p className="text-xs md:text-sm text-muted-foreground">Tipos de materiais em {selectedDate}</p>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                {chartData.materiaisDist.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <div className="h-[220px] md:h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData.materiaisDist}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                            strokeWidth={2}
                            stroke="hsl(var(--card))"
                            label={({ name, value, cx, cy, midAngle, outerRadius: or }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = or + 20;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              const anchor = x > cx ? 'start' : 'end';
                              return (
                                <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={anchor} dominantBaseline="central" fontSize={11}>
                                  <tspan fontWeight={600}>{name}</tspan>
                                  <tspan dx={4} fontWeight={400} fill="hsl(var(--muted-foreground))">{formatNumber(value)}</tspan>
                                </text>
                              );
                            }}
                            labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                          >
                            {chartData.materiaisDist.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [`${formatNumber(value)} viagens`, name]}
                            contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full mt-4 flex items-center justify-center">
                      <div className="bg-muted/50 rounded-lg px-6 py-3 text-center">
                        <p className="text-xs text-muted-foreground">Total de Viagens</p>
                        <p className="text-2xl font-bold">{formatNumber(chartData.materiaisDist.reduce((s, i) => s + i.value, 0))}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12">Nenhum dado</p>
                )}
              </CardContent>
            </Card>

            {/* Pluviometria KPI */}
            <Card className="lg:col-span-2">
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-sm md:text-base flex items-center gap-2">
                  <CloudRain className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                  Pluviometria
                </CardTitle>
                <p className="text-xs md:text-sm text-muted-foreground">Precipitação registrada — {selectedDate}</p>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                {(() => {
                  // Parse selectedDate to get month/year
                  const parts = selectedDate?.split('/').map(Number) || [];
                  const selDia = parts[0] || 0;
                  const selMes = parts[1] || 0;
                  const selAno = parts[2] || 0;

                  const diaData = pluvioData.find(r => r.data === selectedDate);
                  const precipDia = diaData?.quantidade || 0;

                  const mesRows = pluvioData.filter(r => r.mes === selMes && r.ano === selAno);
                  const acumuladoMes = mesRows.reduce((s, r) => s + r.quantidade, 0);
                  const diasComChuva = mesRows.filter(r => r.quantidade > 0).length;
                  const maiorPrecip = mesRows.length > 0 ? Math.max(...mesRows.map(r => r.quantidade)) : 0;

                  // Last 7 days mini chart
                  const last7 = pluvioData
                    .filter(r => {
                      const d = new Date(r.ano, r.mes - 1, r.dia);
                      const sel = new Date(selAno, selMes - 1, selDia);
                      const diff = (sel.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
                      return diff >= 0 && diff < 7;
                    })
                    .sort((a, b) => a.ano - b.ano || a.mes - b.mes || a.dia - b.dia)
                    .map(r => ({ dia: `${r.dia}/${r.mes}`, mm: r.quantidade }));

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                          <CloudRain className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                          <p className="text-lg md:text-xl font-bold">{precipDia.toFixed(1)}<span className="text-xs font-normal ml-0.5">mm</span></p>
                          <p className="text-[10px] text-muted-foreground">Precip. do Dia</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                          <Droplets className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                          <p className="text-lg md:text-xl font-bold">{acumuladoMes.toFixed(1)}<span className="text-xs font-normal ml-0.5">mm</span></p>
                          <p className="text-[10px] text-muted-foreground">Acumulado Mês</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                          <CalendarIcon className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                          <p className="text-lg md:text-xl font-bold">{diasComChuva}</p>
                          <p className="text-[10px] text-muted-foreground">Dias com Chuva</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                          <TrendingUp className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                          <p className="text-lg md:text-xl font-bold">{maiorPrecip.toFixed(1)}<span className="text-xs font-normal ml-0.5">mm</span></p>
                          <p className="text-[10px] text-muted-foreground">Maior no Mês</p>
                        </div>
                      </div>
                      {last7.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Últimos 7 dias</p>
                          <div className="h-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={last7}>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis dataKey="dia" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 10 }} width={30} tickLine={false} axisLine={false} />
                                <Tooltip formatter={(v: number) => [`${v} mm`, 'Precipitação']} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                                <Bar dataKey="mm" fill="hsl(210, 80%, 55%)" radius={[3, 3, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
           </div>
           )}
          </div>
          {/* ===== PRODUÇÃO MENSAL (gráfico) ===== */}
          {isBlockVisible('period_stats') && chartData.producaoDiaria.length > 0 && (
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl p-4 md:p-6 border border-emerald-200/50 dark:border-emerald-800/30">
              <Card>
                <CardHeader className="p-4 md:p-6 pb-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                        Produção do Mês ({format(new Date(), 'MMMM/yyyy', { locale: ptBR })})
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">Viagens por dia no mês atual</p>
                    </div>
                    {(() => {
                      const mesViagens = chartData.producaoDiaria.reduce((s, d) => s + d.viagens, 0);
                      const mesTransportado = chartData.producaoMensalPorLocal.reduce((s, r) => s + r.volume, 0);
                      const mesEscavado = Math.round(mesTransportado / 1.217);
                      const mesDias = chartData.producaoDiaria.length;
                      return (
                        <div className="flex flex-wrap gap-2 md:gap-3">
                          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg px-3 py-1.5 text-center">
                            <p className="text-[10px] text-muted-foreground">Viagens</p>
                            <p className="text-sm md:text-base font-bold">{formatNumber(mesViagens)}</p>
                          </div>
                          <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg px-3 py-1.5 text-center">
                            <p className="text-[10px] text-muted-foreground">Transportado</p>
                            <p className="text-sm md:text-base font-bold">{formatNumber(mesTransportado)} m³</p>
                          </div>
                          <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg px-3 py-1.5 text-center">
                            <p className="text-[10px] text-muted-foreground">Escavado</p>
                            <p className="text-sm md:text-base font-bold">{formatNumber(mesEscavado)} m³</p>
                          </div>
                          <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg px-3 py-1.5 text-center">
                            <p className="text-[10px] text-muted-foreground">Dias Trab.</p>
                            <p className="text-sm md:text-base font-bold">{mesDias}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </CardHeader>
                <CardContent className="p-2 md:p-6 pt-0">
                  <div className="h-[200px] md:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.producaoDiaria} margin={{ top: 25, right: 5, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-[10px] md:text-xs" tick={{ fontSize: 10 }} />
                        <YAxis className="text-[10px] md:text-xs" tick={{ fontSize: 10 }} width={35} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="viagens" fill="hsl(var(--primary))" name="Viagens" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}

          {/* ===== RESUMO GERAL DO PERÍODO (no final) ===== */}
          {isBlockVisible('monthly_consolidation') && monthlySummary.months.length > 0 && (
            <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-xl p-4 md:p-6 border border-amber-200/50 dark:border-amber-800/30">
              <Card>
                <CardHeader className="pb-2 p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm md:text-base flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        Resumo Geral do Período 2025/2026 - Volume Acumulado (m³)
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">Escavação, Carga e Transporte</p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-3">
                      <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg px-3 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Viagens</p>
                        <p className="text-sm md:text-base font-bold">{formatNumber(periodStats.totalViagens)}</p>
                      </div>
                      <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg px-3 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Transportado</p>
                        <p className="text-sm md:text-base font-bold">{formatNumber(Math.round(periodStats.totalVolumeTransportado))} m³</p>
                      </div>
                      <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg px-3 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Escavado</p>
                        <p className="text-sm md:text-base font-bold">{formatNumber(Math.round(periodStats.totalVolumeEscavado / 1.217))} m³</p>
                      </div>
                      <div className="bg-violet-100 dark:bg-violet-900/30 rounded-lg px-3 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Dias Trab.</p>
                        <p className="text-sm md:text-base font-bold">{periodStats.diasComDados}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-2 md:p-4 pt-0">
                  <div className="overflow-x-auto scrollbar-thin border rounded-lg">
                    <Table className="border-collapse">
                      <TableHeader>
                        <TableRow className="border-b">
                          <TableHead colSpan={2 + monthlySummary.materials.length + 2} className="text-xs font-bold text-center">
                            Resumo Geral do Período 2025/2026 - Volume Acumulado (m³)
                          </TableHead>
                        </TableRow>
                        <TableRow className="border-b bg-muted/40">
                          <TableHead className="text-[10px] md:text-xs font-bold sticky left-0 bg-muted/40 z-10 min-w-[28px] md:min-w-[40px] text-center border-r px-1 md:px-4">#</TableHead>
                          <TableHead className="text-[10px] md:text-xs font-bold min-w-[70px] md:min-w-[100px] text-center border-r px-1 md:px-4">Mês</TableHead>
                          {monthlySummary.materials.map(mat => (
                            <TableHead key={mat} className="text-xs font-bold text-center whitespace-nowrap border-r">{mat} (m³)</TableHead>
                          ))}
                          <TableHead className="text-xs font-bold text-center whitespace-nowrap border-r bg-primary/10">Escavado</TableHead>
                          <TableHead className="text-xs font-bold text-center whitespace-nowrap border-r bg-primary/10">Transportado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlySummary.months.map((m, idx) => (
                          <TableRow key={m.sortKey} className="border-b">
                            <TableCell className="text-xs py-1.5 text-center text-muted-foreground border-r">{idx + 1}.</TableCell>
                            <TableCell className="text-xs font-medium py-1.5 text-center capitalize border-r">{m.label}</TableCell>
                            {monthlySummary.materials.map(mat => (
                              <TableCell key={mat} className="text-xs text-center py-1.5 tabular-nums border-r">
                                {(m.byMaterial.get(mat) || 0) > 0 ? formatNumber(Math.round(m.byMaterial.get(mat) || 0)) : '-'}
                              </TableCell>
                            ))}
                            <TableCell className="text-xs text-center py-1.5 tabular-nums font-semibold border-r bg-primary/5">{formatNumber(Math.round(m.escavado))}</TableCell>
                            <TableCell className="text-xs text-center py-1.5 tabular-nums font-semibold border-r bg-primary/5">{formatNumber(Math.round(m.transportado))}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2 bg-muted/30">
                          <TableCell className="text-xs py-1.5 border-r"></TableCell>
                          <TableCell className="text-xs py-1.5 font-bold text-center border-r">Total geral</TableCell>
                          {monthlySummary.materials.map(mat => (
                            <TableCell key={mat} className="text-xs text-center py-1.5 tabular-nums border-r">
                              {formatNumber(Math.round(monthlySummary.totals.byMaterial.get(mat) || 0))}
                            </TableCell>
                          ))}
                          <TableCell className="text-xs text-center py-1.5 tabular-nums border-r bg-primary/10">{formatNumber(Math.round(monthlySummary.totals.escavado))}</TableCell>
                          <TableCell className="text-xs text-center py-1.5 tabular-nums border-r bg-primary/10">{formatNumber(Math.round(monthlySummary.totals.transportado))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          </div>

      )}

      {/* WhatsApp Export Modal */}
      <Dialog open={showWhatsAppExport} onOpenChange={setShowWhatsAppExport}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Exportar Resumo Diário
            </DialogTitle>
            <DialogDescription>
              Envie o resumo de carga do dia {selectedDate} via WhatsApp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Preview */}
            <div className="p-4 bg-muted/30 rounded-lg border max-h-[300px] overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {generateWhatsAppMessage().replace(/\*/g, '').replace(/_/g, '')}
              </pre>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-primary/10 rounded-lg text-center">
                <p className="text-2xl font-bold text-primary">{stats.viagens}</p>
                <p className="text-xs text-muted-foreground">Viagens</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-700">{formatNumber(stats.volumeTransportado)}</p>
                <p className="text-xs text-muted-foreground">Volume (m³)</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-700">{stats.caminhoesAtivos}</p>
                <p className="text-xs text-muted-foreground">Caminhões</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowWhatsAppExport(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => handleWhatsAppExport()}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      </TabsContent>

        <TabsContent value="cal">
          <DashboardCalTab />
        </TabsContent>

        <TabsContent value="pedreira">
          <DashboardPedreiraTab />
        </TabsContent>

        <TabsContent value="pipas">
          <DashboardPipasTab />
        </TabsContent>

        <TabsContent value="abastecimento">
          <DashboardAbastecimentoTab />
        </TabsContent>

        <TabsContent value="frota-geral">
          <DashboardFrotaGeralTab />
        </TabsContent>
        <TabsContent value="evolucao">
          <DashboardEvolucaoTab />
        </TabsContent>
        </div>
      </Tabs>

      {/* Layout Config Modal */}
      <PageLayoutConfigModal
        open={showLayoutConfig}
        onOpenChange={setShowLayoutConfig}
        pageLabel="Dashboard — Produção"
        defaultBlocks={DASHBOARD_CARGA_BLOCKS}
        currentConfigs={layoutConfigs}
        onSave={saveLayoutConfigs}
      />
    </div>
  );
}
