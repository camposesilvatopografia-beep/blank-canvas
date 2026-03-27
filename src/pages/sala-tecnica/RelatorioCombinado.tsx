import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useObraConfig } from '@/hooks/useObraConfig';
import { ProducaoCaminhoesReport } from '@/components/reports/ProducaoCaminhoesReport';
import { ProducaoEscavadeirasReport } from '@/components/reports/ProducaoEscavadeirasReport';
import { ProducaoPipasReport } from '@/components/reports/ProducaoPipasReport';
import { ProducaoPedreiraReport } from '@/components/reports/ProducaoPedreiraReport';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CalendarIcon, FileText, Truck, Droplets, Mountain, RefreshCw } from 'lucide-react';
import logoApropriapp from '@/assets/logo-apropriapp.png';

// ─── Interfaces ────────────────────────────────────────────────
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
  toneladaTicket?: number; toneladaCalcObra?: number; pesoChegada?: number; 
  fotoChegada?: string; fotoPesagem?: string; fotoVazio?: string;
}

type ReportSection = 'caminhoes' | 'escavadeiras' | 'pipas' | 'pedreira';

export default function RelatorioCombinado() {
  const { readSheet, loading } = useGoogleSheets();
  const { obraConfig } = useObraConfig();

  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Carga data
  const [cargaData, setCargaData] = useState<any[][]>([]);
  const [cargaHeaders, setCargaHeaders] = useState<string[]>([]);
  // Pipas data
  const [pipasData, setPipasData] = useState<any[][]>([]);
  const [pipasHeaders, setPipasHeaders] = useState<string[]>([]);
  // Pedreira data
  const [pedreiraData, setPedreiraData] = useState<any[][]>([]);
  const [pedreiraHeaders, setPedreiraHeaders] = useState<string[]>([]);

  const [dataLoaded, setDataLoaded] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Record<ReportSection, boolean>>({
    caminhoes: true, escavadeiras: true, pipas: true, pedreira: true,
  });

  // ─── Load all sheets in parallel ─────────────────────────────
  const loadAllData = useCallback(async () => {
    const [carga, pipas, pedreira] = await Promise.all([
      readSheet('Carga'),
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
    if (pipas.length > 1) { setPipasHeaders(pipas[0]); setPipasData(pipas); extractDates(pipas); }
    if (pedreira.length > 1) { setPedreiraHeaders(pedreira[0]); setPedreiraData(pedreira); extractDates(pedreira); }

    const parseD = (s: string) => { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d).getTime(); };
    const sorted = Array.from(allDatesSet).sort((a, b) => parseD(b) - parseD(a));
    setAvailableDates(sorted);

    const today = format(new Date(), 'dd/MM/yyyy');
    if (sorted.includes(today)) setSelectedDate(today);
    else if (sorted.length > 0) setSelectedDate(sorted[0]);

    setDataLoaded(true);
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
        toneladaCalcObra: parseFloat(String(r[getIdx('Tonelada (Calc Obra)')] || r[getIdx('Tonelada_Calc_Obra')] || 0).replace(/\./g, '').replace(',', '.')) || parseFloat(String(r[getIdx('Tonelada (ticket)')] || r[getIdx('Tonelada_Ticket')] || r[getIdx('Tonelada')] || 0).replace(/\./g, '').replace(',', '.')),
        pesoChegada: parseFloat(String(r[getIdx('Peso Chegada Obra')] || r[getIdx('Peso da Chegada')] || r[getIdx('Peso_Chegada_Obra')] || 0).replace(/\./g, '').replace(',', '.')),
        fotoChegada: r[getIdx('Foto do Peso Chegada Obra')] || r[getIdx('Foto do Peso da Chegada')] || r[getIdx('Foto_Peso_Chegada')] || '',
        fotoPesagem: r[getIdx('Foto Pesagem Pedreira')] || r[getIdx('Foto_Pesagem_Pedreira')] || '',
        fotoVazio: r[getIdx('Foto do Peso Saida Obra')] || r[getIdx('Foto do Peso Saída Obra')] || r[getIdx('Foto do Peso Vazio Obra')] || r[getIdx('Foto Peso Vazio Obra')] || r[getIdx('Foto_Peso_Vazio_Obra')] || r[getIdx('Foto Peso Vazio')] || '',
      }));

    return { pedreiraRecords: rows, pedreiraDateRange: { start: selectedDate, end: selectedDate } };
  }, [pedreiraData, pedreiraHeaders, selectedDate]);

  const hasCarga = caminhaoData.length > 0 || escavadeiraData.length > 0;
  const hasPipas = pipasLocalGroups.length > 0;
  const hasPedreira = pedreiraRecords.length > 0;

  const toggleSection = (key: ReportSection) => setVisibleSections(p => ({ ...p, [key]: !p[key] }));

  const getDisplayDate = () => {
    if (!selectedDate) return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    const [d, m, y] = selectedDate.split('/').map(Number);
    return format(new Date(y, m - 1, d), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  if (!dataLoaded) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Carregando dados...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Relatório Combinado
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Produção consolidada — {getDisplayDate()}
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
          <Button variant="outline" size="icon" onClick={loadAllData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Section toggles */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={visibleSections.caminhoes ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => toggleSection('caminhoes')}
        >
          <Truck className="w-3 h-3 mr-1" /> Caminhões
        </Badge>
        <Badge
          variant={visibleSections.escavadeiras ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => toggleSection('escavadeiras')}
        >
          <Truck className="w-3 h-3 mr-1" /> Escavadeiras
        </Badge>
        <Badge
          variant={visibleSections.pipas ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => toggleSection('pipas')}
        >
          <Droplets className="w-3 h-3 mr-1" /> Pipas
        </Badge>
        <Badge
          variant={visibleSections.pedreira ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => toggleSection('pedreira')}
        >
          <Mountain className="w-3 h-3 mr-1" /> Pedreira
        </Badge>
      </div>

      {/* Reports */}
      {visibleSections.caminhoes && hasCarga && (
        <ProducaoCaminhoesReport
          data={caminhaoData}
          selectedDate={selectedDate}
          totalViagens={caminhaoStats.totalViagens}
          totalCaminhoes={caminhaoStats.totalCaminhoes}
          mediaPorCaminhao={caminhaoStats.mediaPorCaminhao}
          volumeTransportado={caminhaoStats.volumeTransportado}
        />
      )}

      {visibleSections.escavadeiras && hasCarga && (
        <ProducaoEscavadeirasReport
          data={escavadeiraData}
          selectedDate={selectedDate}
          totalViagens={escavadeiraStats.totalViagens}
          totalEquipamentos={escavadeiraStats.totalEquipamentos}
          totalCaminhoes={escavadeiraStats.totalCaminhoes}
          mediaPorCaminhao={escavadeiraStats.mediaPorCaminhao}
        />
      )}

      {visibleSections.pipas && hasPipas && (
        <ProducaoPipasReport
          data={pipasLocalGroups}
          selectedDate={selectedDate}
          totalPipas={pipasStats.totalPipas}
          totalViagens={pipasStats.totalViagens}
          volumeAgua={pipasStats.volumeAgua}
        />
      )}

      {visibleSections.pedreira && hasPedreira && (
        <ProducaoPedreiraReport
          records={pedreiraRecords}
          dateRange={pedreiraDateRange}
        />
      )}

      {/* Empty state */}
      {!hasCarga && !hasPipas && !hasPedreira && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum dado encontrado para {selectedDate}</p>
            <p className="text-sm mt-1">Selecione outra data ou verifique se os dados foram lançados.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
