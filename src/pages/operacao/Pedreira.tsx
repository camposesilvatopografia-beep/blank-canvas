import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Mountain, 
  FileDown, 
  Plus, 
  Loader2, 
  CalendarIcon, 
  RefreshCw, 
  TrendingUp,
  Scale,
  Truck,
  Building2,
  ExternalLink,
  Clock,
  Pencil,
  Trash2,
  Activity,
  ClipboardList,
  Camera,
  Eye,
  Download,
  Image as ImageIcon,
  Settings2
} from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { PeriodoResumoCard } from '@/components/reports/PeriodoResumoCard';
import { FreteConfigModal, getStoredFreteRate } from '@/components/reports/FreteConfigModal';
import { FreteMateriaisConfigModal } from '@/components/reports/FreteMateriaisConfigModal';
import { Badge } from '@/components/ui/badge';
import { ProducaoPedreiraReport } from '@/components/reports/ProducaoPedreiraReport';
import { PedreiraEditModal } from '@/components/crud/PedreiraEditModal';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { PedreiraAcompanhamentoTab } from '@/components/reports/PedreiraAcompanhamentoTab';
import { RelatorioDiarioPedreira } from '@/components/reports/RelatorioDiarioPedreira';
import { RelatorioFornecedorPedreira } from '@/components/reports/RelatorioFornecedorPedreira';
import { RelatorioMedicaoPedreira } from '@/components/reports/RelatorioMedicaoPedreira';
import { RelatorioControlePesoPedreira } from '@/components/reports/RelatorioControlePesoPedreira';
import { ListaRelatoriosIndividuais } from '@/components/reports/ListaRelatoriosIndividuais';
import { DetalhamentoViagemTab } from '@/components/reports/DetalhamentoViagemTab';
import { exportRelatorioIndividualPedreira } from '@/components/reports/RelatorioIndividualPedreira';
import { PedreiraNewEntryModal } from '@/components/crud/PedreiraNewEntryModal';
import { useObraConfig } from '@/hooks/useObraConfig';
import { PendenteCicloNotification, PendenteCicloRef } from '@/components/mobile/PendenteCicloNotification';
import { FinalizarCicloPendenteModal, PendingCycle } from '@/components/mobile/FinalizarCicloPendenteModal';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useColumnConfig, ColumnDefinition } from '@/hooks/useColumnConfig';
import { ColumnConfigModal } from '@/components/crud/ColumnConfigModal';
import { usePageLayout, BlockDefinition } from '@/hooks/usePageLayout';

/** Smart numeric parser: handles both BR (11.640,00) and US (11640.00) formats */
const parseNumBR = (val: any): number => {
  const s = String(val ?? 0).trim();
  if (!s || s === '0') return 0;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  let num: number;
  if (hasComma) {
    // BR format: dots are thousands, comma is decimal
    num = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  } else if (hasDot) {
    // Could be US decimal OR BR thousands-only (e.g. "11.640")
    // If there's exactly one dot and digits after it are 3 → thousands separator
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      num = parseFloat(s.replace('.', '')); // thousands separator
    } else {
      num = parseFloat(s); // decimal point
    }
  } else {
    num = parseFloat(s);
  }
  return isNaN(num) ? 0 : num;
};

const PEDREIRA_LAYOUT_BLOCKS: BlockDefinition[] = [
  { key: 'header_actions', defaultLabel: 'Cabeçalho e Ações' },
  { key: 'stats_cards', defaultLabel: 'Cards de Resumo' },
  { key: 'date_filter', defaultLabel: 'Filtro de Data' },
  { key: 'table', defaultLabel: 'Tabela de Registros' },
  { key: 'reports_tabs', defaultLabel: 'Abas de Relatórios' },
  { key: 'ciclos_pendentes', defaultLabel: 'Ciclos Pendentes' },
];

const PEDREIRA_COLUMNS: ColumnDefinition[] = [
  { key: 'hora', defaultLabel: 'HORA' },
  { key: 'prefixo', defaultLabel: 'PREFIXO' },
  { key: 'fornecedor', defaultLabel: 'FORNECEDOR' },
  { key: 'empresa', defaultLabel: 'EMPRESA' },
  { key: 'material', defaultLabel: 'MATERIAL' },
  { key: 'peso_final', defaultLabel: 'PESO FINAL' },
  { key: 'foto', defaultLabel: '📷' },
  { key: 'toneladas', defaultLabel: 'TONELADAS' },
  { key: 'peso_chegada', defaultLabel: 'P. CHEGADA' },
  { key: 'diferenca', defaultLabel: 'DIFERENÇA' },
  { key: 'acoes', defaultLabel: 'AÇÕES' },
];

interface PedreiraRecord {
  rowIndex: number;
  data: string;
  hora: string;
  ordem: string;
  fornecedor: string;
  prefixo: string;
  descricao: string;
  empresa: string;
  motorista: string;
  placa: string;
  material: string;
  pesoVazio: number;
  pesoFinal: number;
  pesoLiquido: number;
  tonelada: number;
  toneladaTicket?: number;
  toneladaCalcObra?: number;
  frete: number;
  pesoChegada: number;
  pesoVazioObra: number;
  fotoChegada: string;
  fotoPesagem: string;
  fotoVazio: string;
  status: string;
}

interface MaterialStat {
  material: string;
  viagens: number;
  toneladas: number;
  frete: number;
}

interface EmpresaStat {
  empresa: string;
  caminhoes: number;
  viagens: number;
  toneladas: number;
  frete: number;
}

export default function Pedreira() {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('todos');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [allData, setAllData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<PedreiraRecord[]>([]);
  const [materialStatsDay, setMaterialStatsDay] = useState<MaterialStat[]>([]);
  const [empresaStatsDay, setEmpresaStatsDay] = useState<EmpresaStat[]>([]);
  const [materialStatsTotal, setMaterialStatsTotal] = useState<MaterialStat[]>([]);
  const [empresaStatsTotal, setEmpresaStatsTotal] = useState<EmpresaStat[]>([]);
  const [materialStatsMonth, setMaterialStatsMonth] = useState<MaterialStat[]>([]);
  const [empresaStatsMonth, setEmpresaStatsMonth] = useState<EmpresaStat[]>([]);
  const { readSheet, deleteRow, loading } = useGoogleSheets();
  const { toast } = useToast();
  const { obraConfig } = useObraConfig();
  const { user } = useAuth();
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const { isBlockVisible } = usePageLayout('operacao_pedreira', PEDREIRA_LAYOUT_BLOCKS);
  const { configs: pedreiraConfigs, getLabel: pGetLabel, isVisible: pIsVisible, getStyle: pGetStyle, getHeaderStyle: pGetHeaderStyle, saveConfigs: pSaveConfigs } = useColumnConfig('pedreira_registros', PEDREIRA_COLUMNS);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [newEntryModalOpen, setNewEntryModalOpen] = useState(false);

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PedreiraRecord | null>(null);
  
  // Frete configuration
  const [freteRate, setFreteRate] = useState<number>(getStoredFreteRate());
  const [freteConfigOpen, setFreteConfigOpen] = useState(false);
  const [freteMateriaisConfigOpen, setFreteMateriaisConfigOpen] = useState(false);
  
  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteRecord, setDeleteRecord] = useState<PedreiraRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Finalizar ciclo pendente modal (kept for backward compat but no longer primary UX)
  const [finalizarModalOpen, setFinalizarModalOpen] = useState(false);
  const [selectedPendingCycle, setSelectedPendingCycle] = useState<PendingCycle | null>(null);

  // Photo preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const openPreview = (url: string, title: string) => {
    setPreviewUrl(url);
    setPreviewTitle(title);
    setPreviewOpen(true);
  };

  // Ref to imperatively remove a cycle from the notification banner after finalization
  const pendenteCicloRef = useRef<PendenteCicloRef>(null);

  // Active tab + acompanhamento filter state
  const [activeTab, setActiveTab] = useState('relatorios');
  const [acompanhamentoSearch, setAcompanhamentoSearch] = useState('');
  const [acompanhamentoDate, setAcompanhamentoDate] = useState('');

  const [stats, setStats] = useState({
    periodoTotal: { viagens: 0, toneladas: 0, frete: 0 },
    mesAtual: { viagens: 0, toneladas: 0, frete: 0, start: '', end: '' },
    diaSelecionado: { viagens: 0, toneladas: 0, frete: 0, veiculos: 0 },
  });
  
  // Get unique empresas from records
  const availableEmpresas = useMemo(() => {
    const empresas = new Set<string>();
    records.forEach(r => {
      if (r.empresa) empresas.add(r.empresa);
    });
    return Array.from(empresas).sort();
  }, [records]);

  // Get unique materials from all records for freight config
  const availableMaterialsForFrete = useMemo(() => {
    const mats = new Set<string>();
    records.forEach(r => { if (r.material) mats.add(r.material); });
    return Array.from(mats).sort();
  }, [records]);

  // Filter records by selected empresa
  const filteredRecords = useMemo(() => {
    if (selectedEmpresa === 'todos') return records;
    return records.filter(r => r.empresa === selectedEmpresa);
  }, [records, selectedEmpresa]);
  const pedreiraSort = useTableSort(filteredRecords);


  useEffect(() => {
    loadAllData();
  }, [freteRate]);

  // Auto-refresh: listen for updates from mobile tabs and poll every 60s
  useEffect(() => {
    // Listen for localStorage events (mobile updating data in another tab)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'pedreira_data_updated') {
        loadAllData();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // Also poll every 60 seconds to catch any missed updates
    const intervalId = setInterval(() => {
      loadAllData();
    }, 60_000);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freteRate]);

  const parseDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  const loadAllData = async () => {
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (data.length > 1) {
        const hdrs = data[0];
        setHeaders(hdrs);
        setAllData(data);
        
        const normalize = (s: string) => s.toLowerCase().replace(/[_\s]+/g, '').replace(/[áàã]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i').replace(/[óòõ]/g, 'o').replace(/[úù]/g, 'u');
        const normalizedHdrs = hdrs.map(normalize);
        const getIdx = (name: string) => {
          const exact = hdrs.indexOf(name);
          if (exact !== -1) return exact;
          return normalizedHdrs.indexOf(normalize(name));
        };
        const dateIdx = hdrs.indexOf('Data');
        const dates = [...new Set(data.slice(1).map(row => row[dateIdx]).filter(Boolean))];
        
        // Sort dates in descending order
        const sortedDates = dates.sort((a, b) => {
          const dateA = parseDate(a);
          const dateB = parseDate(b);
          return dateB.getTime() - dateA.getTime();
        });
        
        setAvailableDates(sortedDates);
        
        // Get date range
        if (sortedDates.length > 0) {
          setDateRange({
            start: sortedDates[sortedDates.length - 1],
            end: sortedDates[0]
          });
        }

        if (sortedDates.length > 0 && !selectedDate) {
          setSelectedDate(sortedDates[0]);
        }

        // Parse all records — only "Finalizado" status counts for viagens/toneladas
        const statusIdx = hdrs.indexOf('Status');
        const isFinalizado = (row: any[]) => {
          if (statusIdx === -1) return true; // if no status column, include all
          const s = String(row[statusIdx] || '').trim().toLowerCase();
          return s === 'finalizado';
        };

        const allRecords = data.slice(1)
          .filter(isFinalizado)
          .map((row, idx) => ({
          rowIndex: idx + 2,
          data: row[getIdx('Data')] || '',
          hora: row[getIdx('Hora')] || '',
          ordem: row[getIdx('Ordem_Carregamento')] || '',
          fornecedor: row[getIdx('Fornecedor')] || '',
          prefixo: row[getIdx('Prefixo_Eq')] || '',
          descricao: row[getIdx('Descricao_Eq')] || '',
          empresa: row[getIdx('Empresa_Eq')] || '',
          motorista: row[getIdx('Motorista')] || '',
          placa: row[getIdx('Placa')] || '',
          material: row[getIdx('Material')] || '',
          pesoVazio: parseNumBR(row[getIdx('Peso_Vazio')]),
          pesoFinal: parseNumBR(row[getIdx('Peso_Final')]),
          pesoLiquido: parseNumBR(row[getIdx('Peso_Liquido_Cubico')]),
          tonelada: parseNumBR(row[getIdx('Tonelada')] || row[getIdx('Tonelada (ticket)')] || row[getIdx('Tonelada_Ticket')]),
          toneladaTicket: parseNumBR(row[getIdx('Tonelada (ticket)')] || row[getIdx('Tonelada_Ticket')] || row[getIdx('Tonelada')]),
          toneladaCalcObra: (() => {
            const sheetVal = parseNumBR(row[getIdx('Tonelada (Calc Obra)')] || row[getIdx('Tonelada_Calc_Obra')]);
            if (sheetVal > 0) return sheetVal;
            const pChegada = parseNumBR(row[getIdx('Peso Chegada Obra')] || row[getIdx('Peso da Chegada')] || row[getIdx('Peso_Chegada_Obra')]);
            if (pChegada > 0) {
              const pVazioObra = parseNumBR(row[getIdx('Peso Vazio Obra')] || row[getIdx('Peso_Vazio_Obra')] || row[getIdx('Peso do Vazio Obra')] || row[getIdx('Peso Saida Obra')] || row[getIdx('Peso_Saida_Obra')]);
              const pVazio = parseNumBR(row[getIdx('Peso_Vazio')]);
              const tara = pVazioObra > 0 ? pVazioObra : pVazio;
              if (tara > 0) return (pChegada - tara) / 1000;
            }
            return 0;
          })(),
          frete: parseNumBR(String(row[getIdx('Frete')] || row[getIdx('Valor_Frete')] || '').replace('R$', '').trim()),
          pesoChegada: parseNumBR(row[getIdx('Peso Chegada Obra')] || row[getIdx('Peso da Chegada')] || row[getIdx('Peso_Chegada_Obra')]),
          pesoVazioObra: parseNumBR(row[getIdx('Peso Vazio Obra')] || row[getIdx('Peso_Vazio_Obra')] || row[getIdx('Peso do Vazio Obra')] || row[getIdx('Peso Saida Obra')] || row[getIdx('Peso_Saida_Obra')]),
          fotoChegada: row[getIdx('Foto do Peso Chegada Obra')] || row[getIdx('Foto Peso Chegada Obra')] || row[getIdx('Foto do Peso da Chegada')] || row[getIdx('Foto do Peso Chegada')] || row[getIdx('Foto Chegada Obra')] || row[getIdx('Foto da Chegada')] || row[getIdx('Foto_Peso_Chegada')] || row[getIdx('Foto Peso Chegada')] || row[getIdx('Foto Chegada')] || row[getIdx('Anexo Foto Chegada')] || '',
          fotoPesagem: row[getIdx('Foto Pesagem Pedreira')] || row[getIdx('Foto_Pesagem_Pedreira')] || row[getIdx('Foto Pesagem')] || row[getIdx('Foto_Pesagem')] || row[getIdx('Foto da Pesagem')] || row[getIdx('Foto OCR Pedreira')] || row[getIdx('Foto do Peso Carregado')] || row[getIdx('Foto Peso Carregado')] || row[getIdx('Foto da Balança')] || row[getIdx('Foto Balanca')] || row[getIdx('Foto Balança')] || row[getIdx('Anexo Foto Pesagem')] || '',
          fotoVazio: row[getIdx('Foto do Peso Saida Obra')] || row[getIdx('Foto do Peso Saída Obra')] || row[getIdx('Foto do Peso Vazio Obra')] || row[getIdx('Foto Peso Vazio Obra')] || row[getIdx('Foto_Peso_Vazio_Obra')] || row[getIdx('Foto do Peso Vazio Pedreira')] || row[getIdx('Foto Peso Vazio Pedreira')] || row[getIdx('Foto_Peso_Vazio_Pedreira')] || row[getIdx('Foto Peso Vazio')] || row[getIdx('Foto_Peso_Vazio')] || row[getIdx('Foto do Peso Saida')] || row[getIdx('Foto do Peso Saída')] || row[getIdx('Foto Peso Saida')] || row[getIdx('Foto Saida')] || row[getIdx('Foto Saída')] || row[getIdx('Anexo Foto Saida')] || '',
          originalRow: row,
        }));

        // Calculate Total Period stats
        const totalMaterialMap = new Map<string, MaterialStat>();
        const totalEmpresaMap = new Map<string, { empresa: string; caminhoes: Set<string>; viagens: number; toneladas: number; frete: number }>();
        
        allRecords.forEach(r => {
          // Calculate frete based on rate if configured
          const calculatedFrete = freteRate > 0 ? r.tonelada * freteRate : r.frete;
          
          // Material stats
          const matKey = r.material || 'Outros';
          if (!totalMaterialMap.has(matKey)) {
            totalMaterialMap.set(matKey, { material: matKey, viagens: 0, toneladas: 0, frete: 0 });
          }
          const mat = totalMaterialMap.get(matKey)!;
          mat.viagens += 1;
          mat.toneladas += r.tonelada;
          mat.frete += calculatedFrete;

          // Empresa stats
          const empKey = r.empresa || 'Outros';
          if (!totalEmpresaMap.has(empKey)) {
            totalEmpresaMap.set(empKey, { empresa: empKey, caminhoes: new Set(), viagens: 0, toneladas: 0, frete: 0 });
          }
          const emp = totalEmpresaMap.get(empKey)!;
          emp.viagens += 1;
          emp.toneladas += r.tonelada;
          emp.frete += calculatedFrete;
          if (r.prefixo) emp.caminhoes.add(r.prefixo);
        });

        setMaterialStatsTotal(Array.from(totalMaterialMap.values()).sort((a, b) => b.viagens - a.viagens));
        setEmpresaStatsTotal(Array.from(totalEmpresaMap.values()).map(e => ({
          empresa: e.empresa,
          caminhoes: e.caminhoes.size,
          viagens: e.viagens,
          toneladas: e.toneladas,
          frete: e.frete
        })).sort((a, b) => b.viagens - a.viagens));

        // Calculate total frete with rate
        const totalFrete = freteRate > 0 
          ? allRecords.reduce((sum, r) => sum + r.tonelada * freteRate, 0)
          : allRecords.reduce((sum, r) => sum + r.frete, 0);

        setStats(prev => ({
          ...prev,
          periodoTotal: {
            viagens: allRecords.length,
            toneladas: allRecords.reduce((sum, r) => sum + r.tonelada, 0),
            frete: totalFrete,
          },
        }));

        // Calculate Current Month stats
        const currentMonth = format(new Date(), 'MM/yyyy');
        const monthRecords = allRecords.filter(r => {
          const parts = r.data.split('/');
          return parts.length >= 3 && `${parts[1]}/${parts[2]}` === currentMonth;
        });

        // Get month date range
        let monthStart = '';
        let monthEnd = '';
        if (monthRecords.length > 0) {
          const monthDates = monthRecords.map(r => r.data).sort((a, b) => parseDate(a).getTime() - parseDate(b).getTime());
          monthStart = monthDates[0];
          monthEnd = monthDates[monthDates.length - 1];
        }

        const monthMaterialMap = new Map<string, MaterialStat>();
        const monthEmpresaMap = new Map<string, { empresa: string; caminhoes: Set<string>; viagens: number; toneladas: number; frete: number }>();
        
        monthRecords.forEach(r => {
          const calculatedFrete = freteRate > 0 ? r.tonelada * freteRate : r.frete;
          
          const matKey = r.material || 'Outros';
          if (!monthMaterialMap.has(matKey)) {
            monthMaterialMap.set(matKey, { material: matKey, viagens: 0, toneladas: 0, frete: 0 });
          }
          const mat = monthMaterialMap.get(matKey)!;
          mat.viagens += 1;
          mat.toneladas += r.tonelada;
          mat.frete += calculatedFrete;

          const empKey = r.empresa || 'Outros';
          if (!monthEmpresaMap.has(empKey)) {
            monthEmpresaMap.set(empKey, { empresa: empKey, caminhoes: new Set(), viagens: 0, toneladas: 0, frete: 0 });
          }
          const emp = monthEmpresaMap.get(empKey)!;
          emp.viagens += 1;
          emp.toneladas += r.tonelada;
          emp.frete += calculatedFrete;
          if (r.prefixo) emp.caminhoes.add(r.prefixo);
        });

        setMaterialStatsMonth(Array.from(monthMaterialMap.values()).sort((a, b) => b.viagens - a.viagens));
        setEmpresaStatsMonth(Array.from(monthEmpresaMap.values()).map(e => ({
          empresa: e.empresa,
          caminhoes: e.caminhoes.size,
          viagens: e.viagens,
          toneladas: e.toneladas,
          frete: e.frete
        })).sort((a, b) => b.viagens - a.viagens));

        // Calculate month frete with rate
        const monthFrete = freteRate > 0 
          ? monthRecords.reduce((sum, r) => sum + r.tonelada * freteRate, 0)
          : monthRecords.reduce((sum, r) => sum + r.frete, 0);

        setStats(prev => ({
          ...prev,
          mesAtual: {
            viagens: monthRecords.length,
            toneladas: monthRecords.reduce((sum, r) => sum + r.tonelada, 0),
            frete: monthFrete,
            start: monthStart,
            end: monthEnd,
          },
        }));
      }
    } catch (error) {
      console.error('Error loading pedreira data:', error);
    }
  };

  const processDataForDate = useCallback((dateStr: string) => {
    if (!allData.length || !headers.length || !dateStr) return;
    
    const normalize = (s: string) => s.toLowerCase().replace(/[_\s]+/g, '').replace(/[áàã]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i').replace(/[óòõ]/g, 'o').replace(/[úù]/g, 'u');
    const normalizedHdrs = headers.map(normalize);
    const getIdx = (name: string) => {
      const exact = headers.indexOf(name);
      if (exact !== -1) return exact;
      return normalizedHdrs.indexOf(normalize(name));
    };
    const statusIdx = headers.indexOf('Status');
    const isFinalizado = (row: any[]) => {
      if (statusIdx === -1) return true;
      const s = String(row[statusIdx] || '').trim().toLowerCase();
      return s === 'finalizado';
    };

    // All records for the day (shown in table — all statuses)
    const rowMapper = (row: any[], rowIndex: number): PedreiraRecord => ({
      rowIndex,
      data: row[getIdx('Data')] || '',
      hora: row[getIdx('Hora')] || '',
      ordem: row[getIdx('Ordem_Carregamento')] || '',
      fornecedor: row[getIdx('Fornecedor')] || '',
      prefixo: row[getIdx('Prefixo_Eq')] || '',
      descricao: row[getIdx('Descricao_Eq')] || '',
      empresa: row[getIdx('Empresa_Eq')] || '',
      motorista: row[getIdx('Motorista')] || '',
      placa: row[getIdx('Placa')] || '',
      material: row[getIdx('Material')] || '',
      pesoVazio: parseNumBR(row[getIdx('Peso_Vazio')]),
      pesoFinal: parseNumBR(row[getIdx('Peso_Final')]),
      pesoLiquido: parseNumBR(row[getIdx('Peso_Liquido_Cubico')]),
      tonelada: parseNumBR(row[getIdx('Tonelada')] || row[getIdx('Tonelada (ticket)')] || row[getIdx('Tonelada_Ticket')]),
      toneladaTicket: parseNumBR(row[getIdx('Tonelada (ticket)')] || row[getIdx('Tonelada_Ticket')] || row[getIdx('Tonelada')]),
      toneladaCalcObra: parseNumBR(row[getIdx('Tonelada (Calc Obra)')] || row[getIdx('Tonelada_Calc_Obra')]),
      
      frete: parseNumBR(String(row[getIdx('Frete')] || row[getIdx('Valor_Frete')] || '').replace('R$', '').trim()),
      pesoChegada: parseNumBR(row[getIdx('Peso Chegada Obra')] || row[getIdx('Peso da Chegada')] || row[getIdx('Peso_Chegada_Obra')]),
      pesoVazioObra: parseNumBR(row[getIdx('Peso Vazio Obra')] || row[getIdx('Peso_Vazio_Obra')] || row[getIdx('Peso do Vazio Obra')] || row[getIdx('Peso Saida Obra')] || row[getIdx('Peso_Saida_Obra')]),
      fotoChegada: row[getIdx('Foto do Peso Chegada Obra')] || row[getIdx('Foto Peso Chegada Obra')] || row[getIdx('Foto do Peso da Chegada')] || row[getIdx('Foto do Peso Chegada')] || row[getIdx('Foto Chegada Obra')] || row[getIdx('Foto da Chegada')] || row[getIdx('Foto_Peso_Chegada')] || row[getIdx('Foto Peso Chegada')] || row[getIdx('Foto Chegada')] || row[getIdx('Anexo Foto Chegada')] || '',
      fotoPesagem: row[getIdx('Foto Pesagem Pedreira')] || row[getIdx('Foto_Pesagem_Pedreira')] || row[getIdx('Foto Pesagem')] || row[getIdx('Foto_Pesagem')] || row[getIdx('Foto da Pesagem')] || row[getIdx('Foto OCR Pedreira')] || row[getIdx('Foto do Peso Carregado')] || row[getIdx('Foto Peso Carregado')] || row[getIdx('Foto da Balança')] || row[getIdx('Foto Balanca')] || row[getIdx('Foto Balança')] || row[getIdx('Anexo Foto Pesagem')] || '',
      fotoVazio: row[getIdx('Foto do Peso Saida Obra')] || row[getIdx('Foto do Peso Saída Obra')] || row[getIdx('Foto do Peso Vazio Obra')] || row[getIdx('Foto Peso Vazio Obra')] || row[getIdx('Foto_Peso_Vazio_Obra')] || row[getIdx('Foto do Peso Vazio Pedreira')] || row[getIdx('Foto Peso Vazio Pedreira')] || row[getIdx('Foto_Peso_Vazio_Pedreira')] || row[getIdx('Foto Peso Vazio')] || row[getIdx('Foto_Peso_Vazio')] || row[getIdx('Foto do Peso Saida')] || row[getIdx('Foto do Peso Saída')] || row[getIdx('Foto Peso Saida')] || row[getIdx('Foto Saida')] || row[getIdx('Foto Saída')] || row[getIdx('Anexo Foto Saida')] || '',
      status: statusIdx !== -1 ? String(row[statusIdx] || '').trim() : 'Finalizado',
    });

    const dayRows = allData.slice(1)
      .map((row, idx) => ({ row, rowIndex: idx + 2 }))
      .filter(({ row }) => row[getIdx('Data')] === dateStr);

    const dayRecords: PedreiraRecord[] = dayRows.map(({ row, rowIndex }) => rowMapper(row, rowIndex));

    // Only "Finalizado" records contribute to KPI totals
    const finalizedDayRecords: PedreiraRecord[] = dayRows
      .filter(({ row }) => isFinalizado(row))
      .map(({ row, rowIndex }) => rowMapper(row, rowIndex));

    setSelectedEmpresa('todos');  // Reset empresa filter when date changes
    setRecords(dayRecords);

    // Unique vehicles (from finalized only)
    const uniqueVehicles = new Set(finalizedDayRecords.map(r => r.prefixo).filter(Boolean));

    // Calculate day frete with rate (finalized only)
    const dayFrete = freteRate > 0 
      ? finalizedDayRecords.reduce((sum, r) => sum + r.tonelada * freteRate, 0)
      : finalizedDayRecords.reduce((sum, r) => sum + r.frete, 0);

    setStats(prev => ({
      ...prev,
      diaSelecionado: {
        viagens: finalizedDayRecords.length,
        toneladas: finalizedDayRecords.reduce((sum, r) => sum + r.tonelada, 0),
        frete: dayFrete,
        veiculos: uniqueVehicles.size,
      },
    }));

    // Material stats for selected day — finalized only
    const matMap = new Map<string, MaterialStat>();
    finalizedDayRecords.forEach(r => {
      const calculatedFrete = freteRate > 0 ? r.tonelada * freteRate : r.frete;
      const key = r.material || 'Outros';
      if (!matMap.has(key)) matMap.set(key, { material: key, viagens: 0, toneladas: 0, frete: 0 });
      const s = matMap.get(key)!;
      s.viagens += 1;
      s.toneladas += r.tonelada;
      s.frete += calculatedFrete;
    });
    setMaterialStatsDay(Array.from(matMap.values()).sort((a, b) => b.viagens - a.viagens));

    // Empresa stats for selected day — finalized only
    const empMap = new Map<string, { empresa: string; caminhoes: Set<string>; viagens: number; toneladas: number; frete: number }>();
    finalizedDayRecords.forEach(r => {
      const calculatedFrete = freteRate > 0 ? r.tonelada * freteRate : r.frete;
      const key = r.empresa || 'Outros';
      if (!empMap.has(key)) empMap.set(key, { empresa: key, caminhoes: new Set(), viagens: 0, toneladas: 0, frete: 0 });
      const s = empMap.get(key)!;
      s.viagens += 1;
      s.toneladas += r.tonelada;
      s.frete += calculatedFrete;
      if (r.prefixo) s.caminhoes.add(r.prefixo);
    });
    setEmpresaStatsDay(Array.from(empMap.values()).map(e => ({
      empresa: e.empresa,
      caminhoes: e.caminhoes.size,
      viagens: e.viagens,
      toneladas: e.toneladas,
      frete: e.frete
    })).sort((a, b) => b.viagens - a.viagens));

  }, [allData, headers, freteRate]);

  // All records formatted for the report (only Finalizado)
  const allRecordsForReport = useMemo(() => {
    if (!allData.length || !headers.length) return [];
    
    const normalize = (s: string) => s.toLowerCase().replace(/[_\s]+/g, '').replace(/[áàã]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i').replace(/[óòõ]/g, 'o').replace(/[úù]/g, 'u');
    const normalizedHdrs = headers.map(normalize);
    const getIdx = (name: string) => {
      const exact = headers.indexOf(name);
      if (exact !== -1) return exact;
      return normalizedHdrs.indexOf(normalize(name));
    };
    const statusIdx = headers.indexOf('Status');
    
    return allData.slice(1)
      .map((row, idx) => ({ row, rowIndex: idx + 2 }))
      .filter(({ row }) => {
        if (statusIdx === -1) return true;
        const s = String(row[statusIdx] || '').trim().toLowerCase();
        return s === '' || s === 'finalizado';
      })
      .map(({ row, rowIndex }) => ({
      rowIndex,
      data: row[getIdx('Data')] || '',
      hora: row[getIdx('Hora')] || '',
      ordem: row[getIdx('Ordem_Carregamento')] || '',
      prefixo: row[getIdx('Prefixo_Eq')] || '',
      descricao: row[getIdx('Descricao_Eq')] || '',
      empresa: row[getIdx('Empresa_Eq')] || '',
      fornecedor: row[getIdx('Fornecedor')] || '',
      motorista: row[getIdx('Motorista')] || '',
      placa: row[getIdx('Placa')] || '',
      material: row[getIdx('Material')] || '',
      pesoVazio: parseNumBR(row[getIdx('Peso_Vazio')]),
      pesoFinal: parseNumBR(row[getIdx('Peso_Final')]),
      pesoLiquido: parseNumBR(row[getIdx('Peso_Liquido_Cubico')]),
      tonelada: parseNumBR(row[getIdx('Tonelada')] || row[getIdx('Tonelada (ticket)')] || row[getIdx('Tonelada_Ticket')]),
      toneladaTicket: parseNumBR(row[getIdx('Tonelada (ticket)')] || row[getIdx('Tonelada_Ticket')] || row[getIdx('Tonelada')]),
      toneladaCalcObra: (() => {
        const sheetVal = parseNumBR(row[getIdx('Tonelada (Calc Obra)')] || row[getIdx('Tonelada_Calc_Obra')]);
        if (sheetVal > 0) return sheetVal;
        const pChegada = parseNumBR(row[getIdx('Peso Chegada Obra')] || row[getIdx('Peso da Chegada')] || row[getIdx('Peso_Chegada_Obra')]);
        if (pChegada > 0) {
          const pVazioObra = parseNumBR(row[getIdx('Peso Vazio Obra')] || row[getIdx('Peso_Vazio_Obra')] || row[getIdx('Peso do Vazio Obra')] || row[getIdx('Peso Saida Obra')] || row[getIdx('Peso_Saida_Obra')]);
          const pVazio = parseNumBR(row[getIdx('Peso_Vazio')]);
          const tara = pVazioObra > 0 ? pVazioObra : pVazio;
          if (tara > 0) return (pChegada - tara) / 1000;
        }
        return 0;
      })(),
      frete: parseNumBR(String(row[getIdx('Frete')] || row[getIdx('Valor_Frete')] || '').replace('R$', '').trim()),
      pesoChegada: parseNumBR(row[getIdx('Peso Chegada Obra')] || row[getIdx('Peso da Chegada')] || row[getIdx('Peso_Chegada_Obra')]),
      pesoVazioObra: parseNumBR(row[getIdx('Peso Vazio Obra')] || row[getIdx('Peso_Vazio_Obra')] || row[getIdx('Peso do Vazio Obra')] || row[getIdx('Peso Saida Obra')] || row[getIdx('Peso_Saida_Obra')]),
      fotoChegada: row[getIdx('Foto do Peso Chegada Obra')] || row[getIdx('Foto Peso Chegada Obra')] || row[getIdx('Foto do Peso da Chegada')] || row[getIdx('Foto do Peso Chegada')] || row[getIdx('Foto Chegada Obra')] || row[getIdx('Foto da Chegada')] || row[getIdx('Foto_Peso_Chegada')] || row[getIdx('Foto Peso Chegada')] || row[getIdx('Foto Chegada')] || row[getIdx('Anexo Foto Chegada')] || '',
      fotoPesagem: row[getIdx('Foto Pesagem Pedreira')] || row[getIdx('Foto_Pesagem_Pedreira')] || row[getIdx('Foto Pesagem')] || row[getIdx('Foto_Pesagem')] || row[getIdx('Foto da Pesagem')] || row[getIdx('Foto OCR Pedreira')] || row[getIdx('Foto do Peso Carregado')] || row[getIdx('Foto Peso Carregado')] || row[getIdx('Foto da Balança')] || row[getIdx('Foto Balanca')] || row[getIdx('Foto Balança')] || row[getIdx('Anexo Foto Pesagem')] || '',
      fotoVazio: row[getIdx('Foto do Peso Saida Obra')] || row[getIdx('Foto do Peso Saída Obra')] || row[getIdx('Foto do Peso Vazio Obra')] || row[getIdx('Foto Peso Vazio Obra')] || row[getIdx('Foto_Peso_Vazio_Obra')] || row[getIdx('Foto do Peso Vazio Pedreira')] || row[getIdx('Foto Peso Vazio Pedreira')] || row[getIdx('Foto_Peso_Vazio_Pedreira')] || row[getIdx('Foto Peso Vazio')] || row[getIdx('Foto_Peso_Vazio')] || row[getIdx('Foto do Peso Saida')] || row[getIdx('Foto do Peso Saída')] || row[getIdx('Foto Peso Saida')] || row[getIdx('Foto Saida')] || row[getIdx('Foto Saída')] || row[getIdx('Anexo Foto Saida')] || '',
      originalRow: row,
    }));
  }, [allData, headers]);

  useEffect(() => {
    if (selectedDate) {
      processDataForDate(selectedDate);
    }
  }, [selectedDate, processDataForDate]);

  const handleDateChange = (value: string) => {
    setSelectedDate(value);
  };

  const clearDate = () => {
    if (availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
    }
  };

  const formatNumber = (num: number) => num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const formatCurrency = (num: number) => num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleDeleteConfirm = async () => {
    if (!deleteRecord) return;
    setDeleteLoading(true);
    try {
      const success = await deleteRow('Apontamento_Pedreira', deleteRecord.rowIndex);
      if (!success) throw new Error('Falha ao excluir');
      toast({ title: 'Sucesso!', description: 'Registro excluído com sucesso.' });
      // Signal mobile/other tabs to refresh
      localStorage.setItem('pedreira_data_updated', Date.now().toString());
      setDeleteDialogOpen(false);
      setDeleteRecord(null);
      await loadAllData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir registro', variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const getDisplayDate = () => {
    if (!selectedDate) return '';
    const [day, month, year] = selectedDate.split('/').map(Number);
    return format(new Date(year, month - 1, day), "dd 'de' MMMM", { locale: ptBR });
  };

  const getCurrentMonthName = () => {
    return format(new Date(), "MMMM'/'yyyy", { locale: ptBR });
  };

  return (
    <>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="relatorios" className="flex items-center gap-2">
            <FileDown className="w-4 h-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="acompanhamento" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Acompanhamento
          </TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFreteMateriaisConfigOpen(true)}
          >
            <Settings2 className="w-4 h-4 mr-1" />
            Frete Material/Fornecedor
          </Button>
          <Button
            onClick={() => setNewEntryModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600"
            disabled={!headers.length}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Lançamento
          </Button>
        </div>
      </div>



      {/* ─── ABA: RELATÓRIOS (consolidada) ─── */}
      <TabsContent value="relatorios" className="space-y-4">
        <Tabs defaultValue="diario" className="space-y-4">
          <TabsList className="grid w-full max-w-5xl grid-cols-6">
            <TabsTrigger value="diario" className="flex items-center gap-1 text-xs">
              <Clock className="w-3.5 h-3.5" />
              Rel. Diário
            </TabsTrigger>
            <TabsTrigger value="individual" className="flex items-center gap-1 text-xs">
              <FileDown className="w-3.5 h-3.5" />
              Rel. Individual
            </TabsTrigger>
            <TabsTrigger value="carregamento" className="flex items-center gap-1 text-xs">
              <TrendingUp className="w-3.5 h-3.5" />
              Rel. Carregamento
            </TabsTrigger>
            <TabsTrigger value="medicao" className="flex items-center gap-1 text-xs">
              <Activity className="w-3.5 h-3.5" />
              Rel. Medição
            </TabsTrigger>
            <TabsTrigger value="fornecedor" className="flex items-center gap-1 text-xs">
              <Building2 className="w-3.5 h-3.5" />
              Rel. Fornecedor
            </TabsTrigger>
            <TabsTrigger value="detalhamento" className="flex items-center gap-1 text-xs">
              <ClipboardList className="w-3.5 h-3.5" />
              Detalhamento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diario" className="space-y-4">
            <div className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Relatório Diário</h2>
              <Badge variant="secondary">{selectedDate}</Badge>
            </div>
            <RelatorioDiarioPedreira
              records={records}
              selectedDate={selectedDate}
              freteRate={freteRate}
              allRecords={allRecordsForReport as any}
              availableDates={availableDates}
            />
          </TabsContent>


          <TabsContent value="individual" className="space-y-4">
            <div className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold">Relatórios Individuais de Viagem</h2>
              <Badge variant="secondary">{selectedDate}</Badge>
            </div>
            <ListaRelatoriosIndividuais
              records={records}
              selectedDate={selectedDate}
              allRecords={allRecordsForReport as any}
              availableDates={availableDates}
              headers={headers}
              onEditSuccess={() => loadAllData()}
            />
          </TabsContent>


          <TabsContent value="carregamento" className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Relatório Geral de Carregamento</h2>
              <Badge variant="outline">{dateRange.start} → {dateRange.end}</Badge>
            </div>
            <ProducaoPedreiraReport
              records={allRecordsForReport}
              dateRange={dateRange}
              onEdit={(record) => {
                setEditRecord({
                  rowIndex: record.rowIndex,
                  data: record.data,
                  hora: record.hora,
                  ordem: record.ordem,
                  fornecedor: record.fornecedor,
                  prefixo: record.prefixo,
                  descricao: record.descricao,
                  empresa: record.empresa,
                  motorista: record.motorista || '',
                  placa: record.placa || '',
                  material: record.material,
                  pesoVazio: record.pesoVazio,
                  pesoFinal: record.pesoFinal || 0,
                  pesoLiquido: record.pesoLiquido || 0,
                  tonelada: record.tonelada,
                  originalRow: record.originalRow,
                } as any);
                setEditModalOpen(true);
              }}
              onDelete={(record) => {
                setDeleteRecord({
                  rowIndex: record.rowIndex,
                  data: record.data,
                  hora: record.hora,
                  ordem: record.ordem,
                  fornecedor: record.fornecedor,
                  prefixo: record.prefixo,
                  descricao: record.descricao,
                  empresa: record.empresa,
                  motorista: record.motorista || '',
                  placa: record.placa || '',
                  material: record.material,
                  pesoVazio: record.pesoVazio,
                  pesoFinal: record.pesoFinal || 0,
                  pesoLiquido: record.pesoLiquido || 0,
                  tonelada: record.tonelada,
                } as any);
                setDeleteDialogOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="medicao" className="space-y-4">
            <RelatorioMedicaoPedreira records={allRecordsForReport} dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="fornecedor" className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Relatório por Fornecedor</h2>
              <Badge variant="outline">{dateRange.start} → {dateRange.end}</Badge>
            </div>
            <RelatorioFornecedorPedreira records={allRecordsForReport as any} dateRange={dateRange} />
          </TabsContent>
          <TabsContent value="detalhamento" className="space-y-4">
            <DetalhamentoViagemTab
              records={records as any}
              selectedDate={selectedDate}
              allRecords={allRecordsForReport as any}
              availableDates={availableDates}
            />
          </TabsContent>
        </Tabs>
      </TabsContent>

      {/* ─── ABA: ACOMPANHAMENTO ─── */}
      <TabsContent value="acompanhamento">
        <PedreiraAcompanhamentoTab
          initialSearch={acompanhamentoSearch}
          initialDate={acompanhamentoDate}
        />
      </TabsContent>
    </Tabs>

      {/* Finalizar ciclo pendente modal */}
      <FinalizarCicloPendenteModal
        open={finalizarModalOpen}
        onOpenChange={setFinalizarModalOpen}
        cycle={selectedPendingCycle}
        onSuccess={() => {
          // Remove the finalized cycle from the banner immediately
          if (selectedPendingCycle) {
            pendenteCicloRef.current?.removeCycle(selectedPendingCycle.rowIndex);
          }
          setFinalizarModalOpen(false);
          // Reload all data so stats and records update immediately
          loadAllData();
        }}
      />

      {/* Photo Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              {previewTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="w-full overflow-auto max-h-[65vh] rounded-lg border">
              <img 
                src={previewUrl} 
                alt={previewTitle} 
                className="w-full h-auto object-contain"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir original
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={previewUrl} download>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ColumnConfigModal
        open={showColumnConfig}
        onOpenChange={setShowColumnConfig}
        tableLabel="Registros Pedreira"
        defaultColumns={PEDREIRA_COLUMNS}
        currentConfigs={pedreiraConfigs}
        onSave={pSaveConfigs}
      />

      <PedreiraNewEntryModal
        open={newEntryModalOpen}
        onOpenChange={setNewEntryModalOpen}
        onSuccess={() => loadAllData()}
        headers={headers}
      />

      <PedreiraEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={() => {
          setEditModalOpen(false);
          loadAllData();
        }}
        editData={editRecord as any}
        headers={headers}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(v) => { if (!v) { setDeleteDialogOpen(false); setDeleteRecord(null); } }}
        onConfirm={handleDeleteConfirm}
        loading={deleteLoading}
      />

      <FreteMateriaisConfigModal
        open={freteMateriaisConfigOpen}
        onOpenChange={setFreteMateriaisConfigOpen}
        availableMaterials={availableMaterialsForFrete}
        availableSuppliers={Array.from(new Set(records.map(r => r.fornecedor).filter(Boolean))).sort()}
      />
    </>
  );
}

