import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, TrendingUp, Truck, HardHat, FileDown, Loader2, ChevronRight, RefreshCw, Database, MessageCircle, Send, Edit3, X, Shovel, Plus, FileText, BarChart2, ClipboardList, Factory } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProducaoEscavadeirasReport } from '@/components/reports/ProducaoEscavadeirasReport';
import { ProducaoCaminhoesReport } from '@/components/reports/ProducaoCaminhoesReport';
import { ResumoPorLocal } from '@/components/reports/ResumoPorLocal';
import { DetalheProducaoModal } from '@/components/reports/DetalheProducaoModal';
import { BatchEditModal } from '@/components/operations/BatchEditModal';
import { ApontamentoRapidoModal } from '@/components/operations/ApontamentoRapidoModal';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { HistoricoVeiculoReport } from '@/components/reports/HistoricoVeiculoReport';
import { CargaMonitoramentoTab } from '@/components/operations/CargaMonitoramentoTab';
import { UsinaSolosTab } from '@/components/operations/UsinaSolosTab';

import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { usePageLayout, BlockDefinition } from '@/hooks/usePageLayout';

const CARGA_LAYOUT_BLOCKS: BlockDefinition[] = [
  { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
  { key: 'date_filter', defaultLabel: 'Filtro de Data' },
  { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
  { key: 'tabs_escavadeiras', defaultLabel: 'Aba Escavadeiras' },
  { key: 'tabs_caminhoes', defaultLabel: 'Aba Caminhões' },
  { key: 'tabs_locais', defaultLabel: 'Aba Locais' },
  { key: 'tabs_monitoramento', defaultLabel: 'Aba Monitoramento' },
  { key: 'reports', defaultLabel: 'Relatórios' },
];

// Colors for bar charts
const CAMINHAO_COLORS = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#f59e0b', '#10b981', '#14b8a6', '#6366f1', '#8b5cf6'];
const ESCAVADEIRA_COLORS = ['#f97316', '#22c55e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#a855f7'];

interface LocalStats {
  local: string;
  aterro: number;
  areia: number;
  botaFora: number;
  vegetal: number;
  bgs: number;
  total: number;
}

interface CargaRecord {
  data: string;
  hora: string;
  prefixoEq: string;
  descricaoEq: string;
  empresaEq: string;
  operador: string;
  prefixoCb: string;
  descricaoCb: string;
  empresaCb: string;
  motorista: string;
  volume: number;
  viagens: number;
  volumeTotal: number;
  local: string;
  /** Normalizado para agrupamentos/contagens (não exibir) */
  localNormalized: string;
  estaca: string;
  material: string;
}

interface EscavadeiraStats {
  prefixo: string;
  descricao: string;
  operador: string;
  local: string;
  areia: number;
  aterro: number;
  bgs: number;
  botaFora: number;
  vegetal: number;
  total: number;
}

interface CaminhaoStats {
  prefixo: string;
  descricao: string;
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

export default function Carga() {
  const { profile } = useAuth();
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const { isBlockVisible } = usePageLayout('operacao_carga', CARGA_LAYOUT_BLOCKS);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [allData, setAllData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<CargaRecord[]>([]);
  const [escavadeiraStats, setEscavadeiraStats] = useState<EscavadeiraStats[]>([]);
  const [caminhaoStats, setCaminhaoStats] = useState<CaminhaoStats[]>([]);
  const [allCaminhoes, setAllCaminhoes] = useState<{prefixo: string; motorista: string; empresa: string}[]>([]);
  const [allEscavadeiras, setAllEscavadeiras] = useState<{codigo: string; operador: string; empresa: string}[]>([]);
  const [showEscavadeiraReport, setShowEscavadeiraReport] = useState(false);
  const [showCaminhaoReport, setShowCaminhaoReport] = useState(false);
  const [cargaLocalStats, setCargaLocalStats] = useState<LocalStats[]>([]);
  const [detalheModal, setDetalheModal] = useState<DetalheModalState>({
    open: false,
    tipo: 'escavadeira',
    titulo: '',
    subtitulo: '',
    prefixo: '',
  });
  const [showWhatsAppExport, setShowWhatsAppExport] = useState(false);
  const [whatsAppFilterByUser, setWhatsAppFilterByUser] = useState(false);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [showApontamentoRapido, setShowApontamentoRapido] = useState(false);
  const [activeTab, setActiveTab] = useState('operacao');
  const { readSheet, loading } = useGoogleSheets();

  const [stats, setStats] = useState({
    totalViagens: 0,
    volumeTransportado: 0,
    escavadeirasAtivas: 0,
    mediaCaminhao: 0,
    totalCaminhoes: 0,
  });

  // Load all data and extract available dates
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const data = await readSheet('Carga');
      if (data.length > 1) {
        const hdrs = data[0];
        setHeaders(hdrs);
        setAllData(data);
        
        const dateIdx = hdrs.indexOf('Data');
        const dates = [...new Set(data.slice(1).map(row => row[dateIdx]).filter(Boolean))];
        
        // Sort dates in descending order (most recent first)
        const sortedDates = dates.sort((a, b) => {
          const [da, ma, ya] = a.split('/').map(Number);
          const [db, mb, yb] = b.split('/').map(Number);
          return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });
        
        setAvailableDates(sortedDates);
        
        // Auto-select most recent date
        if (sortedDates.length > 0 && !selectedDate) {
          setSelectedDate(sortedDates[0]);
        }
      }
      
      // Load all caminhoes for inactive report
      const caminhaoData = await readSheet('Caminhao');
      if (caminhaoData && caminhaoData.length > 1) {
        const headers = caminhaoData[0];
        const getIdx = (name: string) => {
          const idx = headers.findIndex((h: string) => h?.toLowerCase().includes(name.toLowerCase()));
          return idx !== -1 ? idx : headers.indexOf(name);
        };
        
        const caminhoes = caminhaoData.slice(1)
          .filter((row: any[]) => row[getIdx('prefixo')])
          .map((row: any[]) => ({
            prefixo: row[getIdx('prefixo')] || '',
            motorista: row[getIdx('motorista')] || '',
            empresa: row[getIdx('empresa')] || '',
          }));
        setAllCaminhoes(caminhoes);
      }

      // Load all escavadeiras for inactive report
      const equipData = await readSheet('Equipamentos');
      if (equipData && equipData.length > 1) {
        const headers = equipData[0];
        const getIdx = (name: string) => {
          const idx = headers.findIndex((h: string) => h?.toLowerCase().includes(name.toLowerCase()));
          return idx !== -1 ? idx : headers.indexOf(name);
        };
        
        const escavadeiras = equipData.slice(1)
          .filter((row: any[]) => row[getIdx('prefixo')])
          .map((row: any[]) => ({
            codigo: row[getIdx('prefixo')] || '',
            operador: row[getIdx('operador')] || '',
            empresa: row[getIdx('empresa')] || '',
          }));
        setAllEscavadeiras(escavadeiras);
      }
    } catch (error) {
      console.error('Error loading carga data:', error);
    }
  };

  // Process data when selected date changes
  const processDataForDate = useCallback((dateStr: string) => {
    if (!allData.length || !headers.length || !dateStr) return;
    
    const getIdx = (name: string) => headers.indexOf(name);

    const viagensIdx = getIdx('N_Viagens');
    const viagensIdxAlt = getIdx('I_Viagens');
    
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
        const rawViagens = viagensIdx !== -1 ? row[viagensIdx] : viagensIdxAlt !== -1 ? row[viagensIdxAlt] : undefined;

        return {
          data: row[getIdx('Data')] || '',
          hora: row[getIdx('Hora_Carga')] || '',
          prefixoEq: row[getIdx('Prefixo_Eq')] || '',
          descricaoEq: row[getIdx('Descricao_Eq')] || '',
          empresaEq: row[getIdx('Empresa_Eq')] || '',
          operador: row[getIdx('Operador')] || '',
          prefixoCb: row[getIdx('Prefixo_Cb')] || '',
          descricaoCb: row[getIdx('Descricao_Cb')] || '',
          empresaCb: row[getIdx('Empresa_Cb')] || '',
          motorista: row[getIdx('Motorista')] || '',
          volume: parseFloat(String(row[getIdx('Volume')] || 0).replace(',', '.')),
          viagens: parseViagens(rawViagens),
          volumeTotal: parseFloat(String(row[getIdx('Volume_Total')] || 0).replace(',', '.')),
          local: rawLocal.trim(), // Manter original para exibição
          localNormalized: normalizeLocal(rawLocal), // Normalizado para comparação
          estaca: row[getIdx('Estaca')] || '',
          material: row[getIdx('Material')] || '',
        };
      });

    setRecords(todayRecords);

    // Calculate stats - Total de viagens é a soma de N_Viagens (r.viagens)
    const totalViagens = todayRecords.reduce((sum, r) => sum + r.viagens, 0);
    
    // Calcular volume transportado corretamente: viagens * volume (capacidade)
    const volumeTransportado = todayRecords.reduce((sum, r) => {
      // Se volumeTotal já está preenchido, usar ele; senão calcular viagens * volume
      const vol = r.volumeTotal > 0 ? r.volumeTotal : (r.viagens * r.volume);
      return sum + vol;
    }, 0);
    
    const escavadeiras = new Set(todayRecords.map(r => r.prefixoEq));
    const caminhoes = new Set(todayRecords.map(r => r.prefixoCb));

    setStats({
      totalViagens,
      volumeTransportado,
      escavadeirasAtivas: escavadeiras.size,
      totalCaminhoes: caminhoes.size,
      mediaCaminhao: caminhoes.size > 0 ? Math.round(totalViagens / caminhoes.size) : 0,
    });

    // Calculate escavadeira stats - Separar por Prefixo + Local (usando localNormalized para agrupar)
    const escMap = new Map<string, EscavadeiraStats>();
    todayRecords.forEach(r => {
      const key = `${r.prefixoEq}|${r.localNormalized || 'SEM LOCAL'}`;
      if (!escMap.has(key)) {
        escMap.set(key, {
          prefixo: r.prefixoEq,
          descricao: r.descricaoEq,
          operador: r.operador,
          local: r.local || 'Sem Local', // Manter original para exibição
          areia: 0, aterro: 0, bgs: 0, botaFora: 0, vegetal: 0, total: 0,
        });
      }
      const s = escMap.get(key)!;
      const mat = r.material.toLowerCase();
      if (mat.includes('areia')) s.areia += r.viagens;
      else if (mat.includes('aterro')) s.aterro += r.viagens;
      else if (mat.includes('bgs')) s.bgs += r.viagens;
      else if (mat.includes('bota')) s.botaFora += r.viagens;
      else if (mat.includes('vegetal')) s.vegetal += r.viagens;
      s.total += r.viagens;
    });
    setEscavadeiraStats(Array.from(escMap.values()).sort((a, b) => {
      // Primeiro ordenar por prefixo, depois por local
      const prefixoCompare = a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true });
      if (prefixoCompare !== 0) return prefixoCompare;
      return a.local.localeCompare(b.local, 'pt-BR');
    }));

    // Calculate caminhao stats - Separar por Prefixo + Local (usando localNormalized para agrupar)
    const camMap = new Map<string, CaminhaoStats>();
    todayRecords.forEach(r => {
      const key = `${r.prefixoCb}|${r.localNormalized || 'SEM LOCAL'}`;
      if (!camMap.has(key)) {
        camMap.set(key, {
          prefixo: r.prefixoCb,
          descricao: r.descricaoCb,
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
      // Primeiro ordenar por prefixo, depois por local
      const prefixoCompare = a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true });
      if (prefixoCompare !== 0) return prefixoCompare;
      return a.local.localeCompare(b.local, 'pt-BR');
    }));

    // Calculate local stats for Resumo de Carga
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
    setCargaLocalStats(Array.from(localMap.values()).sort((a, b) => a.local.localeCompare(b.local)));
  }, [allData, headers]);

  useEffect(() => {
    if (selectedDate) {
      processDataForDate(selectedDate);
    }
  }, [selectedDate, processDataForDate]);

  const handleDateChange = (value: string) => {
    setSelectedDate(value);
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');

  const handleEscavadeiraClick = (esc: EscavadeiraStats) => {
    setDetalheModal({
      open: true,
      tipo: 'escavadeira',
      titulo: esc.prefixo,
      subtitulo: `${esc.descricao} • ${esc.operador}`,
      prefixo: esc.prefixo,
    });
  };

  const handleCaminhaoClick = (cam: CaminhaoStats) => {
    setDetalheModal({
      open: true,
      tipo: 'caminhao',
      titulo: cam.prefixo,
      subtitulo: `${cam.descricao} • ${cam.motorista}`,
      prefixo: cam.prefixo,
    });
  };

  const getDetalheRegistros = () => {
    if (detalheModal.tipo === 'escavadeira') {
      return records
        .filter(r => r.prefixoEq === detalheModal.prefixo)
        .map(r => ({
          hora: r.hora,
          prefixoCb: r.prefixoCb,
          prefixoEq: r.prefixoEq,
          motorista: r.motorista,
          operador: r.operador,
          local: r.local,
          material: r.material,
          volume: r.volumeTotal,
          viagens: r.viagens,
        }));
    } else {
      return records
        .filter(r => r.prefixoCb === detalheModal.prefixo)
        .map(r => ({
          hora: r.hora,
          prefixoCb: r.prefixoCb,
          prefixoEq: r.prefixoEq,
          motorista: r.motorista,
          operador: r.operador,
          local: r.local,
          material: r.material,
          volume: r.volumeTotal,
          viagens: r.viagens,
        }));
    }
  };

  const getDetalheTotalViagens = () => {
    const registros = getDetalheRegistros();
    return registros.reduce((sum, r) => sum + r.viagens, 0);
  };

  const getDisplayDate = () => {
    if (!selectedDate) return format(new Date(), "dd 'de' MMMM", { locale: ptBR });
    const [day, month, year] = selectedDate.split('/').map(Number);
    return format(new Date(year, month - 1, day), "dd 'de' MMMM", { locale: ptBR });
  };

  // Filter records by user for WhatsApp
  const userFilteredRecords = useMemo(() => {
    if (!whatsAppFilterByUser || !profile?.nome) return records;
    return records.filter(r => {
      // Check if any field matches the user name (operator or motorista columns may have the user)
      const userIdx = headers.indexOf('Usuario');
      if (userIdx === -1) return true;
      // We need to check from the raw data - records don't have usuario
      // Instead, filter by checking allData
      return true; // fallback - will use alternative approach below
    });
  }, [records, whatsAppFilterByUser, profile?.nome, headers]);

  // Get user-filtered stats for WhatsApp
  const getUserFilteredStats = useCallback(() => {
    if (!whatsAppFilterByUser || !profile?.nome || !allData.length) {
      return { stats, escavadeiraStats, caminhaoStats, cargaLocalStats };
    }

    const userName = profile.nome;
    const userIdx = headers.indexOf('Usuario');
    if (userIdx === -1) return { stats, escavadeiraStats, caminhaoStats, cargaLocalStats };

    const dateIdx = headers.indexOf('Data');
    const filteredRows = allData.slice(1).filter(row => 
      row[dateIdx] === selectedDate && (row[userIdx] || '').trim() === userName
    );

    // Recalculate stats from filtered rows
    const viagensIdx = headers.indexOf('N_Viagens') !== -1 ? headers.indexOf('N_Viagens') : headers.indexOf('I_Viagens');
    const volumeIdx = headers.indexOf('Vol_Total') !== -1 ? headers.indexOf('Vol_Total') : headers.indexOf('Volume');
    const eqIdx = headers.indexOf('Prefixo_Eq') !== -1 ? headers.indexOf('Prefixo_Eq') : headers.indexOf('PrefixoEq');
    const cbIdx = headers.indexOf('Prefixo_Cb') !== -1 ? headers.indexOf('Prefixo_Cb') : headers.indexOf('PrefixoCb');
    const localIdx = headers.indexOf('Local');

    let totalViagens = 0, volumeTransportado = 0;
    const escMap = new Map<string, number>();
    const camMap = new Map<string, number>();
    const locMap = new Map<string, number>();

    filteredRows.forEach(row => {
      const v = viagensIdx !== -1 ? (parseInt(row[viagensIdx]) || 0) : 1;
      const vol = volumeIdx !== -1 ? (parseFloat(row[volumeIdx]) || 0) : 0;
      totalViagens += v;
      volumeTransportado += vol;
      
      if (eqIdx !== -1 && row[eqIdx]) escMap.set(row[eqIdx], (escMap.get(row[eqIdx]) || 0) + v);
      if (cbIdx !== -1 && row[cbIdx]) camMap.set(row[cbIdx], (camMap.get(row[cbIdx]) || 0) + v);
      if (localIdx !== -1 && row[localIdx]) locMap.set(row[localIdx], (locMap.get(row[localIdx]) || 0) + v);
    });

    const fEsc = Array.from(escMap.entries()).map(([prefixo, total]) => ({ prefixo, descricao: '', operador: '', local: '', areia: 0, aterro: 0, bgs: 0, botaFora: 0, vegetal: 0, total })).sort((a, b) => b.total - a.total);
    const fCam = Array.from(camMap.entries()).map(([prefixo, total]) => ({ prefixo, descricao: '', motorista: '', local: '', areia: 0, aterro: 0, bgs: 0, botaFora: 0, vegetal: 0, total })).sort((a, b) => b.total - a.total);
    const fLoc = Array.from(locMap.entries()).map(([local, total]) => ({ local, aterro: 0, areia: 0, botaFora: 0, vegetal: 0, bgs: 0, total })).sort((a, b) => b.total - a.total);

    return {
      stats: { totalViagens, volumeTransportado, escavadeirasAtivas: escMap.size, totalCaminhoes: camMap.size, mediaCaminhao: Math.round(totalViagens / (camMap.size || 1)) },
      escavadeiraStats: fEsc,
      caminhaoStats: fCam,
      cargaLocalStats: fLoc,
    };
  }, [whatsAppFilterByUser, profile?.nome, allData, headers, selectedDate, stats, escavadeiraStats, caminhaoStats, cargaLocalStats]);

  // Generate WhatsApp message for daily summary
  const generateWhatsAppMessage = () => {
    const formatNum = (n: number) => n.toLocaleString('pt-BR');
    const now = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
    const filtered = getUserFilteredStats();
    
    let message = `*🚛 Resumo de Carga - ${selectedDate}*\n\n`;
    
    if (whatsAppFilterByUser && profile?.nome) {
      message += `👷 *Apontador: ${profile.nome}*\n\n`;
    }
    
    message += `*📊 INDICADORES:*\n`;
    message += `• Total de Viagens: *${formatNum(filtered.stats.totalViagens)}*\n`;
    message += `• Volume Transportado: *${formatNum(filtered.stats.volumeTransportado)} m³*\n`;
    message += `• Escavadeiras Ativas: *${filtered.stats.escavadeirasAtivas}*\n`;
    message += `• Caminhões Ativos: *${filtered.stats.totalCaminhoes}*\n`;
    message += `• Média por Caminhão: *${Math.round(filtered.stats.totalViagens / (filtered.stats.totalCaminhoes || 1))} viagens*\n\n`;
    
    if (filtered.escavadeiraStats.length > 0) {
      message += `*🚜 TOP 5 ESCAVADEIRAS:*\n`;
      filtered.escavadeiraStats.slice(0, 5).forEach((eq, idx) => {
        message += `${idx + 1}. ${eq.prefixo}: ${eq.total} viagens\n`;
      });
      message += '\n';
    }
    
    if (filtered.caminhaoStats.length > 0) {
      message += `*🚚 TOP 5 CAMINHÕES:*\n`;
      filtered.caminhaoStats.slice(0, 5).forEach((cam, idx) => {
        message += `${idx + 1}. ${cam.prefixo}: ${cam.total} viagens\n`;
      });
      message += '\n';
    }
    
    if (filtered.cargaLocalStats.length > 0) {
      message += `*📍 POR LOCAL:*\n`;
      filtered.cargaLocalStats.slice(0, 5).forEach((loc) => {
        message += `• ${loc.local}: ${loc.total} viagens\n`;
      });
    }
    
    message += `\n_Gerado em ${now}_`;
    
    return message;
  };

  // Send to WhatsApp
  const handleWhatsAppExport = () => {
    const message = generateWhatsAppMessage();
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    setShowWhatsAppExport(false);
  };

  // Export summary to PDF
  const handleExportResumoPDF = async () => {
    const formatNum = (n: number) => n.toLocaleString('pt-BR');
    const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    // Convert logo to base64
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
    const logoBase64 = await toBase64(activeLogo);

    // Aggregate escavadeira stats by unique prefixo (merge local rows)
    const escAggMap = new Map<string, { prefixo: string; descricao: string; operador: string; total: number }>();
    escavadeiraStats.forEach(e => {
      if (escAggMap.has(e.prefixo)) {
        escAggMap.get(e.prefixo)!.total += e.total;
      } else {
        escAggMap.set(e.prefixo, { prefixo: e.prefixo, descricao: e.descricao, operador: e.operador, total: e.total });
      }
    });
    const escAgg = Array.from(escAggMap.values()).sort((a, b) => b.total - a.total);

    // Aggregate caminhao stats by unique prefixo (merge local rows)
    const camAggMap = new Map<string, { prefixo: string; descricao: string; motorista: string; total: number }>();
    caminhaoStats.forEach(c => {
      if (camAggMap.has(c.prefixo)) {
        camAggMap.get(c.prefixo)!.total += c.total;
      } else {
        camAggMap.set(c.prefixo, { prefixo: c.prefixo, descricao: c.descricao, motorista: c.motorista, total: c.total });
      }
    });
    const camAgg = Array.from(camAggMap.values()).sort((a, b) => b.total - a.total);

    const localTotals = cargaLocalStats.reduce(
      (acc, row) => ({
        aterro: acc.aterro + row.aterro,
        areia: acc.areia + row.areia,
        botaFora: acc.botaFora + row.botaFora,
        vegetal: acc.vegetal + row.vegetal,
        bgs: acc.bgs + row.bgs,
        total: acc.total + row.total,
      }),
      { aterro: 0, areia: 0, botaFora: 0, vegetal: 0, bgs: 0, total: 0 }
    );

    const cellVal = (v: number) => v === 0 ? '' : formatNum(v);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Resumo de Carga - ${selectedDate}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 12px; font-size: 10px; color: #222; }
          .obra-header { background: linear-gradient(135deg, #1a2e6e, #1d3557); border-radius: 10px; padding: 14px 20px; margin-bottom: 14px; display: flex; align-items: center; gap: 16px; }
          .obra-header img { height: 52px; width: auto; object-fit: contain; background: rgba(255,255,255,0.15); border-radius: 8px; padding: 4px; }
          .obra-header .info { flex: 1; }
          .obra-header .obra-nome { color: rgba(255,255,255,0.9); font-weight: 700; font-size: 13px; margin-bottom: 1px; }
          .obra-header .obra-local { color: rgba(255,255,255,0.6); font-size: 10px; margin-bottom: 4px; }
          .obra-header .report-title { color: white; font-weight: 800; font-size: 18px; letter-spacing: 1px; }
          .obra-header .date-info { color: rgba(255,255,255,0.75); font-size: 11px; text-align: right; }
          .stats-row { display: flex; gap: 12px; margin-bottom: 16px; justify-content: center; flex-wrap: wrap; }
          .stat-box { border: 1px solid #ddd; border-radius: 8px; padding: 8px 18px; text-align: center; background: #f8fafc; min-width: 110px; }
          .stat-box.highlight { background: #1e3a5f; color: #fff; border-color: #1e3a5f; }
          .stat-box.highlight .value { color: #fff; }
          .stat-box.highlight .label { color: #cbd5e1; }
          .stat-box .value { font-size: 22px; font-weight: bold; color: #1e3a5f; }
          .stat-box .label { font-size: 9px; color: #666; margin-top: 2px; }
          .section { margin-bottom: 14px; }
          .section-title { font-size: 13px; font-weight: bold; color: #fff; text-align: center; padding: 6px; background: #1e3a5f; border-radius: 4px; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; font-size: 9px; }
          th { background: #1e3a5f; color: white; padding: 5px 4px; text-align: center; font-size: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
          th:first-child { text-align: left; padding-left: 8px; }
          td { border: 1px solid #ddd; padding: 4px 3px; text-align: center; }
          td:first-child { text-align: left; padding-left: 8px; font-weight: 500; }
          tr:nth-child(even) { background: #f4f6f8; }
          .total-row { font-weight: bold; background: #e2e8f0 !important; border-top: 2px solid #1e3a5f; }
          .total-row td { font-weight: bold; }
          .total-row td:last-child { color: #c0392b; }
          .two-cols { display: flex; gap: 14px; margin-bottom: 14px; }
          .two-cols .col { flex: 1; }
          .rank-table td:first-child { width: 25px; text-align: center; font-weight: bold; color: #1e3a5f; }
          .footer { margin-top: 14px; text-align: center; font-size: 8px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="obra-header">
          <img src="${logoBase64}" alt="Logo" />
          <div class="info">
            ${obraConfig.nome ? `<div class="obra-nome">${obraConfig.nome}</div>` : ''}
            ${obraConfig.local ? `<div class="obra-local">📍 ${obraConfig.local}</div>` : ''}
            <div class="report-title">RESUMO DE CARGA</div>
          </div>
          <div class="date-info">📅 ${selectedDate}</div>
        </div>

        <div class="stats-row">
          <div class="stat-box highlight">
            <div class="value">${formatNum(stats.totalViagens)}</div>
            <div class="label">Total Viagens</div>
          </div>
          <div class="stat-box">
            <div class="value">${formatNum(stats.volumeTransportado)}</div>
            <div class="label">Volume (m³)</div>
          </div>
          <div class="stat-box">
            <div class="value">${stats.escavadeirasAtivas}</div>
            <div class="label">Escavadeiras</div>
          </div>
          <div class="stat-box">
            <div class="value">${stats.totalCaminhoes}</div>
            <div class="label">Caminhões</div>
          </div>
          <div class="stat-box">
            <div class="value">${stats.mediaCaminhao}</div>
            <div class="label">Média/Caminhão</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Resumo de Carga por Local</div>
          <table>
            <thead>
              <tr>
                <th>Local</th>
                <th>Aterro</th>
                <th>Areia</th>
                <th>Bota Fora</th>
                <th>Vegetal</th>
                <th>BGS</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${cargaLocalStats.map((row, idx) => `
                <tr>
                  <td>${row.local || '-'}</td>
                  <td>${cellVal(row.aterro)}</td>
                  <td>${cellVal(row.areia)}</td>
                  <td>${cellVal(row.botaFora)}</td>
                  <td>${cellVal(row.vegetal)}</td>
                  <td>${cellVal(row.bgs)}</td>
                  <td><strong>${formatNum(row.total)}</strong></td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td>Total Geral</td>
                <td>${cellVal(localTotals.aterro)}</td>
                <td>${cellVal(localTotals.areia)}</td>
                <td>${cellVal(localTotals.botaFora)}</td>
                <td>${cellVal(localTotals.vegetal)}</td>
                <td>${cellVal(localTotals.bgs)}</td>
                <td>${formatNum(localTotals.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="two-cols">
          <div class="col">
            <div class="section-title">Produção por Escavadeira</div>
            <table class="rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Código</th>
                  <th>Operador</th>
                  <th>Viagens</th>
                </tr>
              </thead>
              <tbody>
                ${escAgg.map((e, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${e.prefixo}</strong></td>
                    <td>${e.operador}</td>
                    <td><strong>${e.total}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="col">
            <div class="section-title">Produção por Caminhão</div>
            <table class="rank-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Prefixo</th>
                  <th>Motorista</th>
                  <th>Viagens</th>
                </tr>
              </thead>
              <tbody>
                ${camAgg.map((c, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${c.prefixo}</strong></td>
                    <td>${c.motorista}</td>
                    <td><strong>${c.total}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer">
          <p>ApropriAPP - Gestão Inteligente • Gerado em ${now} • Data: ${selectedDate}</p>
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

  // Helper: count unique locations per prefix
  const getLocaisCountByPrefixo = (stats: { prefixo: string; local: string }[]) => {
    const countMap = new Map<string, Set<string>>();
    stats.forEach(s => {
      if (!countMap.has(s.prefixo)) countMap.set(s.prefixo, new Set());
      countMap.get(s.prefixo)!.add(s.local);
    });
    return countMap;
  };

  const escavadeiraLocaisCount = getLocaisCountByPrefixo(escavadeiraStats);
  const caminhaoLocaisCount = getLocaisCountByPrefixo(caminhaoStats);

  // Prepare chart data - aggregate by prefixo first, then sort DESCENDING for Top 10
  const camAggForChart = new Map<string, number>();
  caminhaoStats.forEach(c => camAggForChart.set(c.prefixo, (camAggForChart.get(c.prefixo) || 0) + c.total));
  const top10Caminhoes = Array.from(camAggForChart.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, viagens], idx) => ({
      name,
      viagens,
      color: CAMINHAO_COLORS[idx % CAMINHAO_COLORS.length],
    }))
    .reverse(); // reverse so largest bar appears at the top in vertical layout

  // Build a map of prefixo -> descricao for potência extraction
  const escDescMap = new Map<string, string>();
  escavadeiraStats.forEach(e => {
    if (!escDescMap.has(e.prefixo) && e.descricao) escDescMap.set(e.prefixo, e.descricao);
  });

  const escAggForChart = new Map<string, number>();
  escavadeiraStats.forEach(e => escAggForChart.set(e.prefixo, (escAggForChart.get(e.prefixo) || 0) + e.total));
  const escavadeiraChartData = Array.from(escAggForChart.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([prefixo, viagens], idx) => {
      // Extract potência number from description (e.g., "Escavadeira 336" -> "336")
      const desc = escDescMap.get(prefixo) || '';
      const potMatch = desc.match(/(\d{3,4})/);
      const label = potMatch ? `${prefixo} (Pot. ${potMatch[1]})` : prefixo;
      return { name: label, viagens, color: ESCAVADEIRA_COLORS[idx % ESCAVADEIRA_COLORS.length] };
    })
    .reverse();

  return (
    <div className="space-y-4">
      {/* Header */}
      {isBlockVisible('header_actions') && activeTab !== 'usina-solos' && <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Registro de Carga</h1>
            <p className="text-sm text-muted-foreground">
              Acompanhamento de carregamentos • {getDisplayDate()}
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
                <SelectItem key={date} value={date}>
                  {date}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate('')} className="h-9">
            Limpar
          </Button>
          <Button
            size="sm"
            className="h-9 bg-primary hover:bg-primary/90"
            onClick={() => setShowApontamentoRapido(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden md:inline">Apontar</span>
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
        </div>
      </div>}

      {/* Apontamento Rápido Modal */}
      <ApontamentoRapidoModal
        open={showApontamentoRapido}
        onOpenChange={setShowApontamentoRapido}
        onSuccess={loadAllData}
      />

      {/* Batch Edit Modal */}
      <BatchEditModal
        open={showBatchEdit}
        onOpenChange={setShowBatchEdit}
        sheetName="Carga"
        onSuccess={loadAllData}
      />

      {/* WhatsApp Quick Export Modal */}
      {showWhatsAppExport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-lg">Resumo Rápido - WhatsApp</h3>
              </div>
              <p className="text-sm text-muted-foreground">Enviar resumo de carga do dia {selectedDate}</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Somente meus registros</p>
                  <p className="text-xs text-muted-foreground">{profile?.nome || 'Usuário'}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={whatsAppFilterByUser} onChange={(e) => setWhatsAppFilterByUser(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-primary/10 rounded-lg text-center">
                  <p className="text-2xl font-bold text-primary">{stats.totalViagens}</p>
                  <p className="text-xs text-muted-foreground">Viagens</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">{formatNumber(stats.volumeTransportado)}</p>
                  <p className="text-xs text-muted-foreground">Volume (m³)</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{stats.escavadeirasAtivas}</p>
                  <p className="text-xs text-muted-foreground">Escavadeiras</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-700">{stats.totalCaminhoes}</p>
                  <p className="text-xs text-muted-foreground">Caminhões</p>
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border max-h-[200px] overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {generateWhatsAppMessage().replace(/\*/g, '').replace(/_/g, '')}
                </pre>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowWhatsAppExport(false)}>Cancelar</Button>
              <Button onClick={handleWhatsAppExport} className="bg-green-600 hover:bg-green-700">
                <Send className="w-4 h-4 mr-2" />
                Enviar via WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Operação | Relatórios */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="operacao">
            <TrendingUp className="w-4 h-4 mr-2" />
            Resumo Diário
          </TabsTrigger>
          <TabsTrigger value="monitoramento">
            <Database className="w-4 h-4 mr-2" />
            Monitoramento
          </TabsTrigger>
          <TabsTrigger value="relatorios">
            <BarChart2 className="w-4 h-4 mr-2" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="historico-veiculo">
            <ClipboardList className="w-4 h-4 mr-2" />
            Histórico Veículo
          </TabsTrigger>
          <TabsTrigger value="usina-solos">
            <Factory className="w-4 h-4 mr-2" />
            Usina Solos
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
              {isBlockVisible('stats_cards') && <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Card className="bg-[#1e3a5f] text-white">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs font-medium opacity-80">Total Viagens</p>
                      <TrendingUp className="w-3 h-3 opacity-60" />
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(stats.totalViagens)}</p>
                    <p className="text-xs opacity-60">Hoje</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs font-medium text-muted-foreground">Volume Transportado</p>
                      <Truck className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold">{formatNumber(stats.volumeTransportado)} m³</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs font-medium text-green-700">Escavadeiras</p>
                      <HardHat className="w-3 h-3 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-green-800">{stats.escavadeirasAtivas}</p>
                    <p className="text-xs text-green-600">Ativas</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs font-medium text-muted-foreground">Média por Caminhão</p>
                      <Truck className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <p className="text-3xl font-bold">{stats.mediaCaminhao}</p>
                    <p className="text-xs text-muted-foreground">{stats.totalCaminhoes} caminhões</p>
                  </CardContent>
                </Card>
              </div>}

              {/* Bar Charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Top 10 Caminhões com Mais Viagens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top10Caminhoes} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                          <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={55} reversed />
                          <Tooltip formatter={(value: number) => [`${value} viagens`, 'Viagens']} contentStyle={{ fontSize: '12px' }} />
                          <Bar dataKey="viagens" radius={[0, 4, 4, 0]} barSize={20}>
                            {top10Caminhoes.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <LabelList dataKey="viagens" position="right" fontSize={11} fontWeight={600} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold">Produção por Escavadeira</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={escavadeiraChartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                          <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={110} reversed />
                          <Tooltip formatter={(value: number) => [`${value} viagens`, 'Viagens']} contentStyle={{ fontSize: '12px' }} />
                          <Bar dataKey="viagens" radius={[0, 4, 4, 0]} barSize={20}>
                            {escavadeiraChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <LabelList dataKey="viagens" position="right" fontSize={11} fontWeight={600} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Resumo por Local */}
              <ResumoPorLocal title="Resumo de Carga" data={cargaLocalStats} />
            </>
          )}
        </TabsContent>

        {/* ── Relatórios ── */}
        <TabsContent value="relatorios" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Produção Escavadeiras */}
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow border-orange-200 hover:border-orange-400"
              onClick={() => setShowEscavadeiraReport(true)}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Shovel className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Produção Escavadeiras</h3>
                  <p className="text-sm text-muted-foreground mt-1">Detalhamento por equipamento e material</p>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {stats.escavadeirasAtivas} ativas
                </Badge>
              </CardContent>
            </Card>

            {/* Produção Caminhões */}
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
                  {stats.totalCaminhoes} ativos
                </Badge>
              </CardContent>
            </Card>

            {/* PDF Resumo */}
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow border-slate-200 hover:border-slate-400"
              onClick={handleExportResumoPDF}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Resumo Geral</h3>
                  <p className="text-sm text-muted-foreground mt-1">Exportar relatório geral em PDF para impressão</p>
                </div>
                <Badge variant="secondary">
                  {selectedDate || 'Sem data'}
                </Badge>
              </CardContent>
            </Card>

            {/* WhatsApp */}
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow border-green-200 hover:border-green-400"
              onClick={() => setShowWhatsAppExport(true)}
            >
              <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Enviar WhatsApp</h3>
                  <p className="text-sm text-muted-foreground mt-1">Resumo rápido do dia via mensagem</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {stats.totalViagens} viagens
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Histórico Veículo ── */}
        <TabsContent value="historico-veiculo" className="space-y-4">
          <HistoricoVeiculoReport
            cargaData={allData}
            loading={loading}
          />
        </TabsContent>

        {/* ── Monitoramento ── */}
        <TabsContent value="monitoramento">
          <CargaMonitoramentoTab allData={allData} headers={headers} />
        </TabsContent>

        {/* ── Usina Solos ── */}
        <TabsContent value="usina-solos">
          <UsinaSolosTab />
        </TabsContent>

      </Tabs>

      {/* Report Modal - Escavadeiras */}
      {showEscavadeiraReport && (() => {
        const activeCodigos = new Set(escavadeiraStats.map(e => e.prefixo));
        const inactiveEscavadeiras = allEscavadeiras
          .filter(e => !activeCodigos.has(e.codigo))
          .map(e => ({ codigo: e.codigo, operador: e.operador, empresa: e.empresa }));
        return (
          <ProducaoEscavadeirasReport
            data={escavadeiraStats.map((e) => ({
              codigo: e.prefixo,
              potencia: (() => { const m = (e.descricao || '').match(/(\d{3,4})/); return m ? m[1] : e.descricao; })(),
              operador: e.operador,
              local: e.local || '-',
              aterro: e.aterro,
              areia: e.areia,
              botaFora: e.botaFora,
              vegetal: e.vegetal,
              bgs: e.bgs,
              total: e.total,
            }))}
            selectedDate={selectedDate}
            totalViagens={stats.totalViagens}
            totalEquipamentos={stats.escavadeirasAtivas}
            totalCaminhoes={stats.totalCaminhoes}
            mediaPorCaminhao={stats.mediaCaminhao}
            inactiveEscavadeiras={inactiveEscavadeiras}
            onClose={() => setShowEscavadeiraReport(false)}
          />
        );
      })()}

      {/* Report Modal - Caminhões */}
      {showCaminhaoReport && (() => {
        const activePrefixos = new Set(caminhaoStats.map(c => c.prefixo));
        const inactiveCaminhoes = allCaminhoes
          .filter(c => !activePrefixos.has(c.prefixo))
          .map(c => ({ prefixo: c.prefixo, motorista: c.motorista, empresa: c.empresa }));
        return (
          <ProducaoCaminhoesReport
            data={caminhaoStats.map((c) => ({
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
            volumeTransportado={stats.volumeTransportado}
            inactiveCaminhoes={inactiveCaminhoes}
            onClose={() => setShowCaminhaoReport(false)}
          />
        );
      })()}

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
    </div>
  );
}
