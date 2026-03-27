import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Upload, Mountain, Droplets, FlaskConical, CloudRain,
  Truck, FileText, BarChart3, Scale, ClipboardList,
  CalendarIcon, Loader2, RefreshCw, FileDown, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';

// Report components
import { ProducaoCaminhoesReport } from '@/components/reports/ProducaoCaminhoesReport';
import { ProducaoEscavadeirasReport } from '@/components/reports/ProducaoEscavadeirasReport';
import { ProducaoPipasReport } from '@/components/reports/ProducaoPipasReport';
import { ProducaoPedreiraReport } from '@/components/reports/ProducaoPedreiraReport';
import { DivergenciaCargaDescargaReport } from '@/components/reports/DivergenciaCargaDescargaReport';

// ─── Types ──────────────────────────────────────────────────
interface CaminhaoReportData {
  prefixo: string; motorista: string; local: string;
  aterro: number; areia: number; botaFora: number; vegetal: number; bgs: number; total: number;
}
interface EscavadeiraReportData {
  codigo: string; potencia: string; operador: string; local: string;
  aterro: number; areia: number; botaFora: number; vegetal: number; bgs: number; total: number;
}
interface PipaLocalGroup {
  local: string;
  items: { prefixo: string; empresa: string; capacidade: number; viagens: number }[];
  total: number;
}
interface PedreiraRecord {
  data: string; hora: string; ordem: string; fornecedor: string; prefixo: string;
  descricao: string; empresa: string; motorista: string; placa: string; material: string;
  pesoVazio: number; pesoFinal: number; pesoLiquido: number; tonelada: number;
  toneladaTicket?: number; toneladaCalcObra?: number; pesoChegada?: number; fotoChegada?: string;
}

type ReportKey = 'caminhoes' | 'escavadeiras' | 'divergencia' | 'pipas' | 'pedreira' | 'combinado';

interface ReportDef {
  key: ReportKey;
  title: string;
  description: string;
  icon: React.ElementType;
  category: string;
  color: string;
}

const REPORTS: ReportDef[] = [
  { key: 'caminhoes', title: 'Produção de Caminhões', description: 'Relatório de produção por caminhão com totais e médias', icon: Truck, category: 'Carga / Lançamento', color: 'border-emerald-500/30 hover:border-emerald-500/60' },
  { key: 'escavadeiras', title: 'Produção de Escavadeiras', description: 'Relatório de produção por escavadeira', icon: BarChart3, category: 'Carga / Lançamento', color: 'border-emerald-500/30 hover:border-emerald-500/60' },
  { key: 'divergencia', title: 'Divergência Carga x Descarga', description: 'Comparativo entre volumes de carga e descarga', icon: Scale, category: 'Carga / Lançamento', color: 'border-emerald-500/30 hover:border-emerald-500/60' },
  { key: 'pipas', title: 'Produção de Pipas', description: 'Relatório de produção e viagens dos pipas', icon: Droplets, category: 'Pipas', color: 'border-cyan-500/30 hover:border-cyan-500/60' },
  { key: 'pedreira', title: 'Produção Pedreira', description: 'Relatório geral de produção da pedreira', icon: Mountain, category: 'Pedreira', color: 'border-amber-500/30 hover:border-amber-500/60' },
  { key: 'combinado', title: 'Relatório Combinado', description: 'Produção consolidada de Caminhões, Escavadeiras, Pipas e Pedreira', icon: ClipboardList, category: 'Consolidado', color: 'border-purple-500/30 hover:border-purple-500/60' },
];

const CATEGORY_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  'Carga / Lançamento': { icon: Upload, color: 'text-emerald-400' },
  'Pipas': { icon: Droplets, color: 'text-cyan-400' },
  'Pedreira': { icon: Mountain, color: 'text-amber-400' },
  'Consolidado': { icon: ClipboardList, color: 'text-purple-400' },
};

const Relatorios = () => {
  const navigate = useNavigate();
  const { readSheet, loading: sheetsLoading } = useGoogleSheets();
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [openReport, setOpenReport] = useState<ReportKey | null>(null);

  // Raw data
  const [cargaData, setCargaData] = useState<any[][]>([]);
  const [cargaHeaders, setCargaHeaders] = useState<string[]>([]);
  const [descargaData, setDescargaData] = useState<any[][]>([]);
  const [pipasData, setPipasData] = useState<any[][]>([]);
  const [pipasHeaders, setPipasHeaders] = useState<string[]>([]);
  const [pedreiraData, setPedreiraData] = useState<any[][]>([]);
  const [pedreiraHeaders, setPedreiraHeaders] = useState<string[]>([]);

  // ─── Load all sheets ─────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    try {
      const [carga, descarga, pipas, pedreira] = await Promise.all([
        readSheet('Carga'),
        readSheet('Descarga'),
        readSheet('Apontamento_Pipa'),
        readSheet('Apontamento_Pedreira'),
      ]);

      const allDatesSet = new Set<string>();
      const extractDates = (data: any[][]) => {
        if (data.length < 2) return;
        const dateIdx = data[0].indexOf('Data');
        if (dateIdx === -1) return;
        data.slice(1).forEach(row => {
          const d = row[dateIdx];
          if (d) allDatesSet.add(d);
        });
      };

      if (carga.length > 1) { setCargaHeaders(carga[0]); setCargaData(carga); extractDates(carga); }
      if (descarga.length > 1) { setDescargaData(descarga); extractDates(descarga); }
      if (pipas.length > 1) { setPipasHeaders(pipas[0]); setPipasData(pipas); extractDates(pipas); }
      if (pedreira.length > 1) { setPedreiraHeaders(pedreira[0]); setPedreiraData(pedreira); extractDates(pedreira); }

      const parseD = (s: string) => { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d).getTime(); };
      const sorted = Array.from(allDatesSet).sort((a, b) => parseD(b) - parseD(a));
      setAvailableDates(sorted);

      const today = format(new Date(), 'dd/MM/yyyy');
      if (sorted.includes(today)) setSelectedDate(today);
      else if (sorted.length > 0) setSelectedDate(sorted[0]);

      setDataLoaded(true);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados das planilhas');
    }
  }, [readSheet]);

  useEffect(() => { loadAllData(); }, []);

  // ─── Process Carga → Caminhões + Escavadeiras ─────────────────
  const { caminhaoData, caminhaoStats, escavadeiraData, escavadeiraStats } = useMemo(() => {
    const empty = {
      caminhaoData: [] as CaminhaoReportData[], caminhaoStats: { totalViagens: 0, totalCaminhoes: 0, mediaPorCaminhao: 0, volumeTransportado: 0 },
      escavadeiraData: [] as EscavadeiraReportData[], escavadeiraStats: { totalViagens: 0, totalEquipamentos: 0, totalCaminhoes: 0, mediaPorCaminhao: 0 },
    };
    if (!cargaData.length || !cargaHeaders.length || !selectedDate) return empty;

    const getIdx = (name: string) => cargaHeaders.indexOf(name);
    const parseViagens = (v: any) => { const p = parseInt(String(v ?? '1'), 10); return Number.isFinite(p) && p > 0 ? p : 1; };
    const viagensIdx = getIdx('N_Viagens') !== -1 ? getIdx('N_Viagens') : getIdx('I_Viagens');

    const rows = cargaData.slice(1).filter(r => r[getIdx('Data')] === selectedDate);

    // Caminhões
    const camMap = new Map<string, CaminhaoReportData>();
    rows.forEach(r => {
      const prefixo = r[getIdx('Prefixo_Cb')] || '';
      const local = (r[getIdx('Local_da_Obra')] || '').trim();
      const key = `${prefixo}|${local}`;
      const viagens = parseViagens(viagensIdx >= 0 ? r[viagensIdx] : undefined);
      if (!camMap.has(key)) camMap.set(key, { prefixo, motorista: r[getIdx('Motorista')] || '', local, aterro: 0, areia: 0, botaFora: 0, vegetal: 0, bgs: 0, total: 0 });
      const s = camMap.get(key)!;
      const mat = (r[getIdx('Material')] || '').toLowerCase();
      if (mat.includes('areia')) s.areia += viagens;
      else if (mat.includes('aterro')) s.aterro += viagens;
      else if (mat.includes('bgs')) s.bgs += viagens;
      else if (mat.includes('bota')) s.botaFora += viagens;
      else if (mat.includes('vegetal')) s.vegetal += viagens;
      s.total += viagens;
    });
    const camArr = Array.from(camMap.values()).sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }));

    // Escavadeiras
    const escMap = new Map<string, EscavadeiraReportData>();
    rows.forEach(r => {
      const codigo = r[getIdx('Prefixo_Eq')] || '';
      const local = (r[getIdx('Local_da_Obra')] || '').trim();
      const key = `${codigo}|${local}`;
      const viagens = parseViagens(viagensIdx >= 0 ? r[viagensIdx] : undefined);
      if (!escMap.has(key)) escMap.set(key, { codigo, potencia: r[getIdx('Descricao_Eq')] || '', operador: r[getIdx('Operador')] || '', local, aterro: 0, areia: 0, botaFora: 0, vegetal: 0, bgs: 0, total: 0 });
      const s = escMap.get(key)!;
      const mat = (r[getIdx('Material')] || '').toLowerCase();
      if (mat.includes('areia')) s.areia += viagens;
      else if (mat.includes('aterro')) s.aterro += viagens;
      else if (mat.includes('bgs')) s.bgs += viagens;
      else if (mat.includes('bota')) s.botaFora += viagens;
      else if (mat.includes('vegetal')) s.vegetal += viagens;
      s.total += viagens;
    });
    const escArr = Array.from(escMap.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));

    const totalViagens = rows.reduce((s, r) => s + parseViagens(viagensIdx >= 0 ? r[viagensIdx] : undefined), 0);
    const caminhoes = new Set(rows.map(r => r[getIdx('Prefixo_Cb')]));
    const escavadeiras = new Set(rows.map(r => r[getIdx('Prefixo_Eq')]));
    const volumeTransportado = rows.reduce((s, r) => {
      const vt = parseFloat(String(r[getIdx('Volume_Total')] || 0).replace(',', '.'));
      const v = parseFloat(String(r[getIdx('Volume')] || 0).replace(',', '.'));
      const viagens = parseViagens(viagensIdx >= 0 ? r[viagensIdx] : undefined);
      return s + (vt > 0 ? vt : viagens * v);
    }, 0);

    return {
      caminhaoData: camArr,
      caminhaoStats: { totalViagens, totalCaminhoes: caminhoes.size, mediaPorCaminhao: caminhoes.size > 0 ? Math.round(totalViagens / caminhoes.size) : 0, volumeTransportado },
      escavadeiraData: escArr,
      escavadeiraStats: { totalViagens, totalEquipamentos: escavadeiras.size, totalCaminhoes: caminhoes.size, mediaPorCaminhao: caminhoes.size > 0 ? Math.round(totalViagens / caminhoes.size) : 0 },
    };
  }, [cargaData, cargaHeaders, selectedDate]);

  // ─── Process Pipas ────────────────────────────────────────────
  const { pipasLocalGroups, pipasStats } = useMemo(() => {
    const empty = { pipasLocalGroups: [] as PipaLocalGroup[], pipasStats: { totalPipas: 0, totalViagens: 0, volumeAgua: 0 } };
    if (!pipasData.length || !pipasHeaders.length || !selectedDate) return empty;

    const getIdx = (name: string) => {
      const idx = pipasHeaders.indexOf(name);
      if (idx !== -1) return idx;
      return pipasHeaders.findIndex(h => h?.toLowerCase() === name.toLowerCase());
    };
    const localIdx = (() => {
      let idx = getIdx('Local de Trabalho');
      if (idx === -1) idx = getIdx('Tipo_Local');
      if (idx === -1) idx = getIdx('Local_Trabalho');
      if (idx === -1) idx = getIdx('Local');
      return idx;
    })();

    const rows = pipasData.slice(1).filter(r => r[getIdx('Data')] === selectedDate);
    const byLocal = new Map<string, Map<string, { prefixo: string; empresa: string; capacidade: number; viagens: number }>>();

    rows.forEach(r => {
      const tipoLocal = localIdx >= 0 ? (r[localIdx] || 'Sem Tipo') : 'Sem Tipo';
      const prefixo = r[getIdx('Prefixo')] || '';
      const viagens = parseInt(r[getIdx('N_Viagens')] || '1');
      const capacidade = parseFloat(String(r[getIdx('Capacidade')] || 0).replace('.', '').replace(',', '.'));
      if (!byLocal.has(tipoLocal)) byLocal.set(tipoLocal, new Map());
      const m = byLocal.get(tipoLocal)!;
      if (m.has(prefixo)) { m.get(prefixo)!.viagens += viagens; }
      else m.set(prefixo, { prefixo, empresa: r[getIdx('Empresa')] || r[getIdx('Motorista')] || '', capacidade, viagens });
    });

    const groups: PipaLocalGroup[] = [];
    byLocal.forEach((items, local) => {
      const arr = Array.from(items.values()).sort((a, b) => b.viagens - a.viagens);
      groups.push({ local, items: arr, total: arr.reduce((s, i) => s + i.viagens, 0) });
    });
    groups.sort((a, b) => b.total - a.total);

    const allPipas = new Set(rows.map(r => r[getIdx('Prefixo')]));
    const totalViagens = rows.reduce((s, r) => s + parseInt(r[getIdx('N_Viagens')] || '1'), 0);
    const volumeAgua = rows.reduce((s, r) => {
      const cap = parseFloat(String(r[getIdx('Capacidade')] || 0).replace('.', '').replace(',', '.'));
      const v = parseInt(r[getIdx('N_Viagens')] || '1');
      return s + cap * v;
    }, 0);

    return { pipasLocalGroups: groups, pipasStats: { totalPipas: allPipas.size, totalViagens, volumeAgua } };
  }, [pipasData, pipasHeaders, selectedDate]);

  // ─── Process Pedreira ─────────────────────────────────────────
  const { pedreiraRecords, pedreiraDateRange } = useMemo(() => {
    const empty = { pedreiraRecords: [] as PedreiraRecord[], pedreiraDateRange: { start: '', end: '' } };
    if (!pedreiraData.length || !pedreiraHeaders.length || !selectedDate) return empty;

    const normalize = (s: string) => s.toLowerCase().replace(/[_\s]+/g, '').replace(/[áàã]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i').replace(/[óòõ]/g, 'o').replace(/[úù]/g, 'u');
    const normalizedHdrs = pedreiraHeaders.map(normalize);
    const getIdx = (name: string) => {
      const exact = pedreiraHeaders.indexOf(name);
      if (exact !== -1) return exact;
      return normalizedHdrs.indexOf(normalize(name));
    };

    const statusIdx = pedreiraHeaders.indexOf('Status');
    const rows = pedreiraData.slice(1)
      .filter(r => {
        if (r[getIdx('Data')] !== selectedDate) return false;
        if (statusIdx === -1) return true;
        return String(r[statusIdx] || '').trim().toLowerCase() === 'finalizado';
      })
      .map(r => ({
        data: r[getIdx('Data')] || '',
        hora: r[getIdx('Hora')] || '',
        ordem: r[getIdx('Ordem_Carregamento')] || '',
        fornecedor: r[getIdx('Fornecedor')] || '',
        prefixo: r[getIdx('Prefixo_Eq')] || '',
        descricao: r[getIdx('Descricao_Eq')] || '',
        empresa: r[getIdx('Empresa_Eq')] || '',
        motorista: r[getIdx('Motorista')] || '',
        placa: r[getIdx('Placa')] || '',
        material: r[getIdx('Material')] || '',
        pesoVazio: parseFloat(String(r[getIdx('Peso_Vazio')] || 0).replace(/\./g, '').replace(',', '.')),
        pesoFinal: parseFloat(String(r[getIdx('Peso_Final')] || 0).replace(/\./g, '').replace(',', '.')),
        pesoLiquido: parseFloat(String(r[getIdx('Peso_Liquido_Cubico')] || 0).replace(/\./g, '').replace(',', '.')),
        tonelada: parseFloat(String(r[getIdx('Tonelada')] || r[getIdx('Tonelada (ticket)')] || r[getIdx('Tonelada_Ticket')] || 0).replace(/\./g, '').replace(',', '.')),
        toneladaTicket: parseFloat(String(r[getIdx('Tonelada (ticket)')] || r[getIdx('Tonelada_Ticket')] || r[getIdx('Tonelada')] || 0).replace(/\./g, '').replace(',', '.')),
        pesoChegada: parseFloat(String(r[getIdx('Peso Chegada Obra')] || r[getIdx('Peso da Chegada')] || r[getIdx('Peso_Chegada_Obra')] || 0).replace(/\./g, '').replace(',', '.')),
        toneladaCalcObra: (() => {
          const tonCalc = parseFloat(String(r[getIdx('Tonelada (Calc Obra)')] || r[getIdx('Tonelada_Calc_Obra')] || 0).replace(/\./g, '').replace(',', '.'));
          if (tonCalc > 0) return tonCalc;
          
          const pVazio = parseFloat(String(r[getIdx('Peso_Vazio')] || 0).replace(/\./g, '').replace(',', '.'));
          const pChegada = parseFloat(String(r[getIdx('Peso Chegada Obra')] || r[getIdx('Peso da Chegada')] || r[getIdx('Peso_Chegada_Obra')] || 0).replace(/\./g, '').replace(',', '.'));
          const pVazioObra = parseFloat(String(r[getIdx('Peso Vazio Obra')] || 0).replace(/\./g, '').replace(',', '.'));
          
          const pVazioEfetivo = pVazioObra > 0 ? pVazioObra : pVazio;
          
          if (pChegada > 0 && pVazioEfetivo > 0) {
            return (pChegada - pVazioEfetivo) / 1000;
          }
          
          return parseFloat(String(r[getIdx('Tonelada (ticket)')] || r[getIdx('Tonelada_Ticket')] || r[getIdx('Tonelada')] || 0).replace(/\./g, '').replace(',', '.'));
        })(),
        fotoChegada: r[getIdx('Foto do Peso Chegada Obra')] || r[getIdx('Foto do Peso da Chegada')] || r[getIdx('Foto_Peso_Chegada')] || '',
      }));

    return { pedreiraRecords: rows, pedreiraDateRange: { start: selectedDate, end: selectedDate } };
  }, [pedreiraData, pedreiraHeaders, selectedDate]);

  // Count records per report
  const reportCounts: Record<ReportKey, number> = {
    caminhoes: caminhaoData.length,
    escavadeiras: escavadeiraData.length,
    divergencia: caminhaoData.length > 0 ? 1 : 0,
    pipas: pipasLocalGroups.length,
    pedreira: pedreiraRecords.length,
    combinado: 1, // Always available
  };

  // Group reports by category
  const groupedReports = useMemo(() => {
    const groups: Record<string, ReportDef[]> = {};
    REPORTS.forEach(r => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return Object.entries(groups);
  }, []);

  const getDisplayDate = () => {
    if (!selectedDate) return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const [d, m, y] = selectedDate.split('/').map(Number);
    return format(new Date(y, m - 1, d), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  if (!dataLoaded) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Carregando dados dos relatórios...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Central de relatórios — {getDisplayDate()}. Clique para visualizar e exportar (PDF / Excel).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Selecionar data" />
              </SelectTrigger>
              <SelectContent>
                {availableDates.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={loadAllData} disabled={sheetsLoading}>
            <RefreshCw className={`w-4 h-4 ${sheetsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Report cards grouped by category */}
      {groupedReports.map(([category, reports]) => {
        const catConfig = CATEGORY_ICONS[category];
        const CatIcon = catConfig?.icon || FileText;
        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <CatIcon className={`w-5 h-5 ${catConfig?.color || 'text-muted-foreground'}`} />
              <h2 className="text-lg font-semibold">{category}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {reports.map(report => {
                const count = reportCounts[report.key];
                const hasData = count > 0;
                return (
                  <Card
                    key={report.key}
                    className={`cursor-pointer border transition-all duration-200 ${report.color} hover:shadow-md ${!hasData ? 'opacity-50' : ''}`}
                    onClick={() => {
                      if (!hasData) return;
                      if (report.key === 'combinado') {
                        navigate('/sala-tecnica/relatorio-combinado');
                      } else {
                        setOpenReport(report.key);
                      }
                    }}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <report.icon className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm">{report.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant={hasData ? 'default' : 'secondary'} className="text-[10px] h-5">
                          {hasData ? `${count} reg.` : 'Sem dados'}
                        </Badge>
                        {hasData && (
                          <div className="flex items-center gap-1">
                            <FileDown className="w-3 h-3 text-muted-foreground" />
                            <FileSpreadsheet className="w-3 h-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Report Dialogs */}
      <Dialog open={openReport === 'caminhoes'} onOpenChange={open => !open && setOpenReport(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <ProducaoCaminhoesReport
            data={caminhaoData}
            selectedDate={selectedDate}
            totalViagens={caminhaoStats.totalViagens}
            totalCaminhoes={caminhaoStats.totalCaminhoes}
            mediaPorCaminhao={caminhaoStats.mediaPorCaminhao}
            volumeTransportado={caminhaoStats.volumeTransportado}
            onClose={() => setOpenReport(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openReport === 'escavadeiras'} onOpenChange={open => !open && setOpenReport(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <ProducaoEscavadeirasReport
            data={escavadeiraData}
            selectedDate={selectedDate}
            totalViagens={escavadeiraStats.totalViagens}
            totalEquipamentos={escavadeiraStats.totalEquipamentos}
            totalCaminhoes={escavadeiraStats.totalCaminhoes}
            mediaPorCaminhao={escavadeiraStats.mediaPorCaminhao}
            onClose={() => setOpenReport(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openReport === 'divergencia'} onOpenChange={open => !open && setOpenReport(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DivergenciaCargaDescargaReport
            cargaData={cargaData}
            descargaData={descargaData}
            availableDates={availableDates}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openReport === 'pipas'} onOpenChange={open => !open && setOpenReport(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <ProducaoPipasReport
            data={pipasLocalGroups}
            selectedDate={selectedDate}
            totalPipas={pipasStats.totalPipas}
            totalViagens={pipasStats.totalViagens}
            volumeAgua={pipasStats.volumeAgua}
            onClose={() => setOpenReport(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openReport === 'pedreira'} onOpenChange={open => !open && setOpenReport(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <ProducaoPedreiraReport
            records={pedreiraRecords}
            dateRange={pedreiraDateRange}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Relatorios;
