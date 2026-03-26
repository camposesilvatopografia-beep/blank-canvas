import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format, parse, isValid, eachDayOfInterval, startOfDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Loader2, RefreshCw, History, CalendarIcon, X, Truck, FileDown, FileSpreadsheet, Settings2, ArrowUpDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

// ─── Types ───
interface DayEntry {
  data: string;
  dateParsed: Date;
  producao: ProducaoEntry[];
  horimetros: HorimetroEntry[];
  abastecimentos: AbastecimentoEntry[];
  manutencoes: ManutencaoEntry[];
}

interface ManutencaoEntry {
  idOrdem: string;
  problema: string;
  servico: string;
  mecanico: string;
  dataEntrada: string;
  dataSaida: string;
  horaEntrada: string;
  horaSaida: string;
  horasParado: string;
  observacao: string;
  status: string;
}

interface ProducaoEntry {
  tipo: 'carga' | 'descarga' | 'pipa' | 'pedreira';
  local: string;
  material: string;
  viagens: number;
  volume: number;
  motorista: string;
  escavadeira: string;
}

interface HorimetroEntry {
  horimetroAnterior: string;
  horimetroAtual: string;
  intervaloH: string;
  kmAnterior: string;
  kmAtual: string;
  totalKm: string;
  operador: string;
  categoria: string;
  empresa: string;
}

interface AbastecimentoEntry {
  hora: string;
  tipoCombustivel: string;
  quantidade: string;
  local: string;
  fornecedor: string;
  valorTotal: string;
  horimetroAnterior: string;
  horimetroAtual: string;
  kmAnterior: string;
  kmAtual: string;
  intervaloKm: string;
  observacao: string;
}

interface ConsolidatedRow {
  data: string;
  dateParsed: Date;
  diaSemana: string;
  motorista: string;
  viagens: number;
  volume: number;
  litrosAbast: number;
  valorAbast: number;
  horAnterior: string;
  horAtual: string;
  intervaloH: string;
  kmAnterior: string;
  kmAtual: string;
  totalKm: string;
  manutencao: boolean;
  horasParado: number;
  horasTurno: number;
  problemaManut: string;
  statusManut: string;
}

// ─── Column definitions ───
const ALL_COLUMNS = [
  { key: 'data', label: 'Data', group: 'geral' },
  { key: 'diaSemana', label: 'Dia', group: 'geral' },
  { key: 'motorista', label: 'Motorista', group: 'geral' },
  { key: 'litrosAbast', label: 'Abast. (L)', group: 'abastecimento' },
  { key: 'horAnterior', label: 'Hor. Inicial', group: 'horimetro' },
  { key: 'horAtual', label: 'Hor. Final', group: 'horimetro' },
  { key: 'intervaloH', label: 'Interv. H', group: 'horimetro' },
  { key: 'kmAnterior', label: 'Km Inicial', group: 'km' },
  { key: 'kmAtual', label: 'Km Final', group: 'km' },
  { key: 'totalKm', label: 'Total Km', group: 'km' },
  { key: 'manutencao', label: 'Manutenção', group: 'manutencao' },
  { key: 'horasParado', label: 'Tempo Manut.', group: 'manutencao' },
  { key: 'problemaManut', label: 'Problema', group: 'manutencao' },
  { key: 'statusManut', label: 'Status Manut.', group: 'manutencao' },
] as const;

type ColumnKey = typeof ALL_COLUMNS[number]['key'];

const DEFAULT_VISIBLE: ColumnKey[] = [
  'data', 'diaSemana', 'motorista',
  'horAnterior', 'horAtual', 'intervaloH',
  'kmAnterior', 'kmAtual', 'totalKm',
  'litrosAbast',
  'manutencao', 'horasParado', 'problemaManut',
];

const COLUMN_GROUPS = [
  { key: 'geral', label: 'Geral' },
  { key: 'producao', label: 'Produção' },
  { key: 'abastecimento', label: 'Abastecimento' },
  { key: 'horimetro', label: 'Horímetro' },
  { key: 'km', label: 'Quilometragem' },
  { key: 'manutencao', label: 'Manutenção' },
];

// ─── Turno por dia da semana ───
// 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
type TurnoConfig = Record<number, { inicio: number; fim: number }>;

const DEFAULT_TURNO: TurnoConfig = {
  0: { inicio: 0, fim: 0 },      // Domingo — sem turno
  1: { inicio: 7, fim: 18 },      // Segunda: 7h às 18h = 11h
  2: { inicio: 6, fim: 18 },      // Terça: 6h às 18h = 12h
  3: { inicio: 6, fim: 18 },      // Quarta: 6h às 18h = 12h
  4: { inicio: 6, fim: 18 },      // Quinta: 6h às 18h = 12h
  5: { inicio: 6, fim: 15 },      // Sexta: 6h às 15h = 9h
  6: { inicio: 6, fim: 14 },      // Sábado: 6h às 14h = 8h
};

const TURNO_STORAGE_KEY = 'frota-historico-turno-config';

const DIA_LABELS: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado',
};

function loadTurnoConfig(): TurnoConfig {
  try {
    const stored = localStorage.getItem(TURNO_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (typeof parsed === 'object' && parsed[0] !== undefined) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_TURNO;
}

function saveTurnoConfig(config: TurnoConfig) {
  localStorage.setItem(TURNO_STORAGE_KEY, JSON.stringify(config));
}

function getHorasTurnoFromConfig(config: TurnoConfig, date: Date): number {
  const dow = getDay(date);
  const turno = config[dow];
  if (!turno) return 0;
  return Math.max(0, turno.fim - turno.inicio);
}

function calcMediaHoras(config: TurnoConfig): number {
  const dias = [1, 2, 3, 4, 5]; // seg-sex
  const total = dias.reduce((s, d) => s + Math.max(0, config[d].fim - config[d].inicio), 0);
  return total / dias.length;
}

// ─── Helpers ───
function parseDate(val: string): Date | null {
  if (!val) return null;
  // Normalize date string: pad single-digit day/month with zero (e.g., "1/2/2026" → "01/02/2026")
  const normalized = val.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, (_, d, m, y) => 
    `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  );
  let d = parse(normalized, 'dd/MM/yyyy', new Date());
  if (isValid(d)) return d;
  d = parse(normalized, 'MM/dd/yyyy', new Date());
  if (isValid(d)) return d;
  d = parse(val, 'yyyy-MM-dd', new Date());
  if (isValid(d)) return d;
  d = new Date(val);
  return isValid(d) ? d : null;
}

/**
 * Parse "horas_parado" value from various formats:
 * - "3d 2h" → (3 * MEDIA_HORAS_DIA) + 2 hours
 * - "5h" → 5 hours
 * - "29" or "29.5" → raw hours
 * Returns total hours as a number.
 */
function parseHorasParado(val: string, mediaHoras: number): number {
  if (!val) return 0;
  const str = String(val).trim().toLowerCase();
  if (!str) return 0;

  const hasDHM = /[dhm]/.test(str);

  if (hasDHM) {
    let totalHours = 0;
    const dMatch = str.match(/(\d+(?:[.,]\d+)?)\s*d/);
    const hMatch = str.match(/(\d+(?:[.,]\d+)?)\s*h/);
    const mMatch = str.match(/(\d+(?:[.,]\d+)?)\s*m/);

    if (dMatch) totalHours += parseFloat(dMatch[1].replace(',', '.')) * mediaHoras;
    if (hMatch) totalHours += parseFloat(hMatch[1].replace(',', '.'));
    if (mMatch) totalHours += parseFloat(mMatch[1].replace(',', '.')) / 60;

    return totalHours;
  }

  const num = parseFloat(str.replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

/**
 * Formata horas paradas para exibição no total/KPI.
 * Ex: 45.2 → "45,2h (≈4d 1,2h)"
 */
function formatHorasParadoTotal(totalHours: number, mediaHoras: number): string {
  if (totalHours <= 0) return '-';
  const horasStr = totalHours.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${horasStr}h`;
}

/**
 * Formata horas paradas para uma linha diária.
 * Ex: horasParado=8 → "8h"
 */
function formatHorasParadoDia(horasParado: number, _horasTurno: number): string {
  if (horasParado <= 0) return '-';
  const hpStr = horasParado.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${hpStr}h`;
}

function formatNum(val: string) {
  if (!val) return '-';
  // Normalize: remove spaces, handle both "1.234,56" (pt-BR) and "1234.56" formats
  let cleaned = String(val).trim();
  // If contains comma, treat as pt-BR (dots are thousands, comma is decimal)
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? val : num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatCurrency(val: number) {
  if (!val) return '-';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Right-aligned numeric columns
const NUMERIC_COLS: ColumnKey[] = ['litrosAbast', 'horAnterior', 'horAtual', 'intervaloH', 'kmAnterior', 'kmAtual', 'totalKm', 'horasParado'];
const BOLD_COLS: ColumnKey[] = ['intervaloH', 'totalKm', 'horasParado'];

export function FrotaHistoricoVeiculoTab() {
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [cargaRaw, setCargaRaw] = useState<any[][]>([]);
  const [descargaRaw, setDescargaRaw] = useState<any[][]>([]);
  const [horimetrosRaw, setHorimetrosRaw] = useState<any[][]>([]);
  const [abastecimentosRaw, setAbastecimentosRaw] = useState<any[][]>([]);
  const [pipasRaw, setPipasRaw] = useState<any[][]>([]);
  const [pedreiraRaw, setPedreiraRaw] = useState<any[][]>([]);
  const [manutencoesRaw, setManutencoesRaw] = useState<any[][]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 'ALL' means all vehicles for the selected empresa (or all empresas)
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('ALL');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('ALL'); // 'ALL' or specific prefixo
  const vehicleDropdownRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [dateSortAsc, setDateSortAsc] = useState(true);
  const [turnoConfig, setTurnoConfig] = useState<TurnoConfig>(loadTurnoConfig);
  const [showTurnoConfig, setShowTurnoConfig] = useState(false);

  const mediaHoras = useMemo(() => calcMediaHoras(turnoConfig), [turnoConfig]);

  const updateTurno = (dow: number, field: 'inicio' | 'fim', value: number) => {
    setTurnoConfig(prev => {
      const updated = { ...prev, [dow]: { ...prev[dow], [field]: value } };
      saveTurnoConfig(updated);
      return updated;
    });
  };

  const resetTurno = () => {
    setTurnoConfig(DEFAULT_TURNO);
    saveTurnoConfig(DEFAULT_TURNO);
  };

  const { readSheet } = useGoogleSheets();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [carga, descarga, hor, abast, pipas, pedreira, manut] = await Promise.all([
        readSheet('Carga'), readSheet('Descarga'), readSheet('Horimetros'), readSheet('Abastecimentos'),
        readSheet('Apontamento_Pipa'), readSheet('Apontamento_Pedreira'), readSheet('Manutenções'),
      ]);
      console.log('[Historico] Manutenções raw rows:', manut.length, 'Headers:', manut[0]);
      if (manut.length > 1) console.log('[Historico] Manutenções first data row:', manut[1]);
      setCargaRaw(carga); setDescargaRaw(descarga); setHorimetrosRaw(hor); setAbastecimentosRaw(abast);
      setPipasRaw(pipas); setPedreiraRaw(pedreira); setManutencoesRaw(manut);
    } catch (err) {
      console.error('Error loading histórico data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [readSheet]);

  useEffect(() => { loadData(); }, []);

  // ─── Extract unique vehicles ───
  const allVehicles = useMemo(() => {
    const set = new Set<string>();
    const extractCol = (raw: any[][], keywords: string[]) => {
      if (raw.length < 2) return;
      const hdrs = raw[0] as string[];
      const idx = hdrs.findIndex(h => h && keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
      if (idx < 0) return;
      raw.slice(1).forEach(row => {
        const v = row[idx];
        if (v && typeof v === 'string' && v.trim()) set.add(v.trim());
      });
    };
    extractCol(cargaRaw, ['Prefixo_Cb']); extractCol(descargaRaw, ['Prefixo_Cb']);
    extractCol(horimetrosRaw, ['veiculo']); extractCol(abastecimentosRaw, ['veiculo']);
    extractCol(pipasRaw, ['Prefixo', 'prefixo']); extractCol(pedreiraRaw, ['Prefixo', 'prefixo']);
    extractCol(manutencoesRaw, ['Veiculo', 'veiculo']);
    return Array.from(set).sort();
  }, [cargaRaw, descargaRaw, horimetrosRaw, abastecimentosRaw, pipasRaw, pedreiraRaw, manutencoesRaw]);

  // ─── Extract unique empresas from horímetros + abastecimentos ───
  const allEmpresas = useMemo(() => {
    const set = new Set<string>();
    const extractEmp = (raw: any[][], keywords: string[]) => {
      if (raw.length < 2) return;
      const hdrs = raw[0] as string[];
      const idx = hdrs.findIndex(h => h && keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
      if (idx < 0) return;
      raw.slice(1).forEach(row => { const v = row[idx]; if (v && typeof v === 'string' && v.trim()) set.add(v.trim()); });
    };
    extractEmp(horimetrosRaw, ['empresa']); extractEmp(abastecimentosRaw, ['empresa']);
    return Array.from(set).sort();
  }, [horimetrosRaw, abastecimentosRaw]);

  // Vehicles filtered by selected empresa
  const vehiclesForEmpresa = useMemo(() => {
    if (selectedEmpresa === 'ALL') return allVehicles;
    // Find vehicles that appear in horímetros or abastecimentos for this empresa
    const set = new Set<string>();
    const check = (raw: any[][], veicKws: string[], empKws: string[]) => {
      if (raw.length < 2) return;
      const hdrs = raw[0] as string[];
      const vi = hdrs.findIndex(h => h && veicKws.some(k => h.toLowerCase().includes(k.toLowerCase())));
      const ei = hdrs.findIndex(h => h && empKws.some(k => h.toLowerCase().includes(k.toLowerCase())));
      if (vi < 0 || ei < 0) return;
      raw.slice(1).forEach(row => {
        if ((row[ei] || '').toString().trim() === selectedEmpresa) {
          const v = (row[vi] || '').toString().trim();
          if (v) set.add(v);
        }
      });
    };
    check(horimetrosRaw, ['veiculo'], ['empresa']);
    check(abastecimentosRaw, ['veiculo'], ['empresa']);
    // Fallback: show all vehicles if none matched
    return set.size > 0 ? Array.from(set).sort() : allVehicles;
  }, [selectedEmpresa, allVehicles, horimetrosRaw, abastecimentosRaw]);

  // Sync selectedVehicles when empresa or vehicle selection changes
  const syncSelectedVehicles = useCallback((empresa: string, vehicle: string, veicForEmpresa: string[]) => {
    if (vehicle === 'ALL') {
      const vehicles = empresa === 'ALL' ? allVehicles : veicForEmpresa;
      setSelectedVehicles(vehicles);
    } else {
      setSelectedVehicles([vehicle]);
    }
  }, [allVehicles]);

  // Re-sync when data loads (allVehicles becomes populated)
  useEffect(() => {
    if (allVehicles.length > 0 && selectedVehicles.length === 0 && selectedVehicle === 'ALL') {
      setSelectedVehicles(selectedEmpresa === 'ALL' ? allVehicles : vehiclesForEmpresa);
    }
  }, [allVehicles, vehiclesForEmpresa]);

  // ─── Build consolidated daily entries ───
  const dailyEntries = useMemo((): DayEntry[] => {
    if (selectedVehicles.length === 0) return [];
    const dayMap = new Map<string, DayEntry>();

    const getOrCreateDay = (dateStr: string, dateParsed: Date): DayEntry => {
      const key = format(dateParsed, 'yyyy-MM-dd');
      // Normalize date display to always use dd/MM/yyyy with zero padding
      const normalizedDateStr = format(dateParsed, 'dd/MM/yyyy');
      if (!dayMap.has(key)) {
        dayMap.set(key, { data: normalizedDateStr, dateParsed, producao: [], horimetros: [], abastecimentos: [], manutencoes: [] });
      }
      return dayMap.get(key)!;
    };

    const findIdx = (hdrs: string[], keywords: string[]) =>
      hdrs.findIndex(h => h && keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

    // Carga
    if (cargaRaw.length > 1) {
      const hdrs = cargaRaw[0] as string[];
      const gi = (name: string) => hdrs.indexOf(name);
      const prefIdx = gi('Prefixo_Cb'), dataIdx = gi('Data');
      const localIdx = gi('Local_Carga') >= 0 ? gi('Local_Carga') : gi('Local_da_Obra');
      const matIdx = gi('Material');
      const viagIdx = gi('N_Viagens') >= 0 ? gi('N_Viagens') : gi('I_Viagens');
      const volTotalIdx = gi('Volume_Total'), volIdx = gi('Volume');
      const motIdx = gi('Motorista'), escIdx = gi('Prefixo_Eq');
      cargaRaw.slice(1).forEach(row => {
        const rv = (row[prefIdx] || '').toString().trim();
        if (!selectedVehicles.includes(rv)) return;
        const dp = parseDate(row[dataIdx]); if (!dp) return;
        const rawViagens = parseFloat(String(row[viagIdx] || '0').replace(',', '.')) || 0;
        const rawVolTotal = parseFloat(String(row[volTotalIdx] || '0').replace(',', '.')) || 0;
        const rawVol = parseFloat(String(row[volIdx] || '0').replace(',', '.')) || 0;
        getOrCreateDay(row[dataIdx], dp).producao.push({
          tipo: 'carga', local: row[localIdx] || '', material: row[matIdx] || '',
          viagens: rawViagens,
          volume: rawVolTotal || (rawVol * rawViagens) || 0,
          motorista: row[motIdx] || '', escavadeira: row[escIdx] || '',
        });
      });
    }

    // Descarga
    if (descargaRaw.length > 1) {
      const hdrs = descargaRaw[0] as string[];
      const gi = (name: string) => hdrs.indexOf(name);
      const prefIdx = gi('Prefixo_Cb'), dataIdx = gi('Data');
      const localIdx = gi('Local_Descarga') >= 0 ? gi('Local_Descarga') : gi('Local');
      const matIdx = gi('Material');
      const viagIdx = gi('N_Viagens') >= 0 ? gi('N_Viagens') : gi('I_Viagens');
      const volTotalIdx = gi('Volume_Total'), volIdx = gi('Volume');
      const motIdx = gi('Motorista'), escIdx = gi('Prefixo_Eq');
      descargaRaw.slice(1).forEach(row => {
        const rv = (row[prefIdx] || '').toString().trim();
        if (!selectedVehicles.includes(rv)) return;
        const dp = parseDate(row[dataIdx]); if (!dp) return;
        const rawViagens = parseFloat(String(row[viagIdx] || '0').replace(',', '.')) || 0;
        const rawVolTotal = parseFloat(String(row[volTotalIdx] || '0').replace(',', '.')) || 0;
        const rawVol = parseFloat(String(row[volIdx] || '0').replace(',', '.')) || 0;
        getOrCreateDay(row[dataIdx], dp).producao.push({
          tipo: 'descarga', local: row[localIdx] || '', material: row[matIdx] || '',
          viagens: rawViagens,
          volume: rawVolTotal || (rawVol * rawViagens) || 0,
          motorista: row[motIdx] || '', escavadeira: row[escIdx] || '',
        });
      });
    }

    // Pipas (Apontamento_Pipa)
    if (pipasRaw.length > 1) {
      const hdrs = pipasRaw[0] as string[];
      const fi = (kws: string[]) => findIdx(hdrs, kws);
      const prefIdx = fi(['prefixo', 'pipa']);
      const dataIdx = fi(['data']);
      const viagIdx = fi(['viagens', 'n_viagens']);
      const localIdx = fi(['local']);
      console.log('[Historico] Pipa headers:', hdrs, 'prefIdx:', prefIdx, 'viagIdx:', viagIdx);
      let pipaMatchCount = 0;
      pipasRaw.slice(1).forEach(row => {
        const rowVehicle = (row[prefIdx] || '').toString().trim();
        if (!selectedVehicles.includes(rowVehicle)) return;
        pipaMatchCount++;
        const dp = parseDate(row[dataIdx]); if (!dp) return;
        const viagens = parseFloat(String(row[viagIdx] || '0').replace(',', '.')) || 0;
        getOrCreateDay(row[dataIdx], dp).producao.push({
          tipo: 'pipa', local: row[localIdx] || '', material: '',
          viagens: viagens || 1, volume: 0, motorista: '', escavadeira: '',
        });
      });
      console.log(`[Historico] Pipa matched ${pipaMatchCount} rows for "${selectedVehicles.join(',')}"`);
    }

    // Pedreira (Apontamento_Pedreira) — como caminhão (Prefixo) e como escavadeira (Prefixo_Eq)
    if (pedreiraRaw.length > 1) {
      const hdrs = pedreiraRaw[0] as string[];
      const fi = (kws: string[]) => findIdx(hdrs, kws);
      const prefIdx = fi(['prefixo_cb', 'prefixo']); // caminhão
      const eqIdx = fi(['prefixo_eq', 'escavadeira', '_eq']); // escavadeira
      const dataIdx = fi(['data']);
      const viagIdx = fi(['viagens', 'n_viagens']);
      const localIdx = fi(['local', 'fornecedor']);
      const matIdx = fi(['material']);
      console.log('[Historico] Pedreira headers:', hdrs, 'prefIdx:', prefIdx, 'eqIdx:', eqIdx, 'dataIdx:', dataIdx);
      let pedreiraMatchCount = 0;
      pedreiraRaw.slice(1).forEach(row => {
        const rowCaminhao = (row[prefIdx] || '').toString().trim();
        const rowEscavadeira = eqIdx >= 0 ? (row[eqIdx] || '').toString().trim() : '';
        const matchesCaminhao = selectedVehicles.includes(rowCaminhao);
        const matchesEscavadeira = rowEscavadeira ? selectedVehicles.includes(rowEscavadeira) : false;
        if (!matchesCaminhao && !matchesEscavadeira) return;
        pedreiraMatchCount++;
        const dp = parseDate(row[dataIdx]); if (!dp) return;
        const viagens = viagIdx >= 0 ? (parseFloat(String(row[viagIdx] || '1').replace(',', '.')) || 1) : 1;
        getOrCreateDay(row[dataIdx], dp).producao.push({
          tipo: 'pedreira',
          local: row[localIdx] || '', material: row[matIdx] || '',
          viagens, volume: 0, motorista: '', escavadeira: rowEscavadeira,
        });
      });
      console.log(`[Historico] Pedreira matched ${pedreiraMatchCount} rows for "${selectedVehicles.join(',')}"`);
    }

    // Horímetros
    if (horimetrosRaw.length > 1) {
      const hdrs = horimetrosRaw[0] as string[];
      const fi = (kws: string[]) => findIdx(hdrs, kws);
      const veicIdx = fi(['veiculo']), dataIdx = fi(['data']);
      const horAntIdx = fi(['horimetro anterior', 'orimetro anter']);
      const horAtualIdx = fi(['horimetro atual', 'orimetro atual']);
      const intervaloIdx = fi(['intervalo']), kmAntIdx = fi(['km anterior']);
      const kmAtualIdx = fi(['km atual']), totalKmIdx = fi(['total km']), operadorIdx = fi(['operador']);
      const categoriaIdx = fi(['categoria']);
      const empresaIdx = fi(['empresa']);
      horimetrosRaw.slice(1).forEach(row => {
        if (!selectedVehicles.includes((row[veicIdx] || '').toString().trim())) return;
        const dp = parseDate(row[dataIdx]); if (!dp) return;
        getOrCreateDay(row[dataIdx], dp).horimetros.push({
          horimetroAnterior: row[horAntIdx] || '', horimetroAtual: row[horAtualIdx] || '',
          intervaloH: row[intervaloIdx] || '', kmAnterior: row[kmAntIdx] || '',
          kmAtual: row[kmAtualIdx] || '', totalKm: row[totalKmIdx] || '', operador: row[operadorIdx] || '',
          categoria: categoriaIdx >= 0 ? (row[categoriaIdx] || '') : '',
          empresa: empresaIdx >= 0 ? (row[empresaIdx] || '') : '',
        });
      });
    }

    // Abastecimentos
    if (abastecimentosRaw.length > 1) {
      const hdrs = abastecimentosRaw[0] as string[];
      const fi = (kws: string[]) => findIdx(hdrs, kws);
      const veicIdx = fi(['veiculo']), dataIdx = fi(['data']), horaIdx = fi(['hora']);
      const tipoCombIdx = fi(['tipo de comb']), qtdIdx = fi(['quantidade']);
      const localIdx = fi(['local']), fornIdx = fi(['fornecedor']), vlrTotalIdx = fi(['valor total']);
      const obsIdx = fi(['observa']);
      const horCols = hdrs.reduce<number[]>((acc, h, i) => { if (h && h.toLowerCase().includes('horimetro')) acc.push(i); return acc; }, []);
      const horAntIdx = horCols[0] ?? -1, horAtualIdx = horCols[1] ?? -1;
      const kmCols = hdrs.reduce<number[]>((acc, h, i) => { if (h && h.toLowerCase().includes('km')) acc.push(i); return acc; }, []);
      const kmAntIdx = kmCols[0] ?? -1, kmAtualIdx = kmCols[1] ?? -1;
      const intervaloKmIdx = fi(['intervalo km']);
      abastecimentosRaw.slice(1).forEach(row => {
        if (!selectedVehicles.includes((row[veicIdx] || '').toString().trim())) return;
        const dp = parseDate(row[dataIdx]); if (!dp) return;
        const gv = (idx: number) => idx >= 0 ? (row[idx] || '') : '';
        getOrCreateDay(row[dataIdx], dp).abastecimentos.push({
          hora: gv(horaIdx), tipoCombustivel: gv(tipoCombIdx), quantidade: gv(qtdIdx),
          local: gv(localIdx), fornecedor: gv(fornIdx), valorTotal: gv(vlrTotalIdx),
          horimetroAnterior: gv(horAntIdx), horimetroAtual: gv(horAtualIdx),
          kmAnterior: gv(kmAntIdx), kmAtual: gv(kmAtualIdx), intervaloKm: gv(intervaloKmIdx), observacao: gv(obsIdx),
        });
      });
    }

    // Manutenções
    if (manutencoesRaw.length > 1) {
      const hdrs = manutencoesRaw[0] as string[];
      console.log('[Historico] Manutenções headers:', hdrs);
      const fi = (kws: string[]) => findIdx(hdrs, kws);
      const veicIdx = fi(['veiculo']);
      const dataIdx = fi(['data']);
      const idOrdemIdx = fi(['idordem', 'id_ordem', 'id']);
      const problemaIdx = fi(['problema']);
      const servicoIdx = fi(['servico', 'serviço']);
      const mecanicoIdx = fi(['mecanico', 'mecânico']);
      const dataEntIdx = fi(['data_entrada', 'data entrada']);
      const dataSaiIdx = fi(['data_saida', 'data saida', 'data saída']);
      const horaEntIdx = fi(['hora_entrada', 'hora entrada']);
      const horaSaiIdx = fi(['hora_saida', 'hora saida', 'hora saída']);
      const horasParadoIdx = fi(['horas_parado', 'horas parado', 'hrs_parado', 'hrs parado', 'tempo_parado', 'tempo parado']);
      const obsIdx = fi(['observa']);
      const statusIdx = fi(['status']);
      console.log('[Historico] Manutenções headers:', hdrs);
      console.log('[Historico] Manutenções col indexes:', { veicIdx, dataIdx, problemaIdx, statusIdx, horasParadoIdx });
      let matchCount = 0;
      manutencoesRaw.slice(1).forEach(row => {
        if (!selectedVehicles.includes((row[veicIdx] || '').toString().trim())) return;
        matchCount++;
        const dp = parseDate(row[dataIdx]); 
        if (!dp) {
          console.log('[Historico] Manutenção date parse failed:', row[dataIdx], 'row:', row.slice(0, 6));
          return;
        }
        const gv = (idx: number) => idx >= 0 ? (row[idx] || '') : '';
        
        // Calculate horas parado: prefer direct field, fallback to hora_entrada/hora_saida diff
        let horasParadoVal = gv(horasParadoIdx);
        if (!horasParadoVal && gv(horaEntIdx) && gv(horaSaiIdx)) {
          try {
            const [hE, mE] = gv(horaEntIdx).split(':').map(Number);
            const [hS, mS] = gv(horaSaiIdx).split(':').map(Number);
            if (!isNaN(hE) && !isNaN(hS)) {
              const diffMin = (hS * 60 + (mS || 0)) - (hE * 60 + (mE || 0));
              if (diffMin > 0) horasParadoVal = (diffMin / 60).toFixed(1);
            }
          } catch { /* ignore */ }
        }
        
        // Also try to calculate from data_entrada/data_saida if horas still empty
        if (!horasParadoVal && gv(dataEntIdx) && gv(dataSaiIdx)) {
          try {
            const entDate = parseDate(gv(dataEntIdx));
            const saiDate = parseDate(gv(dataSaiIdx));
            if (entDate && saiDate) {
              const diffMs = saiDate.getTime() - entDate.getTime();
              const diffHours = diffMs / (1000 * 60 * 60);
              if (diffHours > 0) horasParadoVal = diffHours.toFixed(1);
            }
          } catch { /* ignore */ }
        }
        
        console.log('[Historico] Manutenção entry:', { data: row[dataIdx], problema: gv(problemaIdx), horasParado: horasParadoVal, status: gv(statusIdx) });
        
        getOrCreateDay(row[dataIdx], dp).manutencoes.push({
          idOrdem: gv(idOrdemIdx), problema: gv(problemaIdx), servico: gv(servicoIdx),
          mecanico: gv(mecanicoIdx), dataEntrada: gv(dataEntIdx), dataSaida: gv(dataSaiIdx),
          horaEntrada: gv(horaEntIdx), horaSaida: gv(horaSaiIdx), horasParado: horasParadoVal,
          observacao: gv(obsIdx), status: gv(statusIdx),
        });
      });
      console.log(`[Historico] Manutenções matched ${matchCount} rows for vehicles "${selectedVehicles.join(',')}"`);
    } else {
      console.log('[Historico] Manutenções: no data (raw length:', manutencoesRaw.length, ')');
    }

    return Array.from(dayMap.values()).sort((a, b) => b.dateParsed.getTime() - a.dateParsed.getTime());
  }, [selectedVehicles, cargaRaw, descargaRaw, horimetrosRaw, abastecimentosRaw, pipasRaw, pedreiraRaw, manutencoesRaw]);

  // ─── Date filter ───
  const filteredDays = useMemo(() => {
    return dailyEntries.filter(entry => {
      if (dateFrom) { const from = new Date(dateFrom); from.setHours(0, 0, 0, 0); if (entry.dateParsed < from) return false; }
      if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); if (entry.dateParsed > to) return false; }
      return true;
    });
  }, [dailyEntries, dateFrom, dateTo]);

  // ─── Detect vehicle type based on which sheets have data ───
  // Also check if vehicle appears as escavadeira (Prefixo_Eq) in pedreira sheet
  const isEscavadeira = useMemo(() => {
    if (selectedVehicles.length === 0 || pedreiraRaw.length < 2) return false;
    const hdrs = pedreiraRaw[0] as string[];
    const findIdx2 = (kws: string[]) => hdrs.findIndex(h => h && kws.some(k => h.toLowerCase().includes(k.toLowerCase())));
    const eqIdx = findIdx2(['prefixo_eq', 'escavadeira', 'eq']);
    if (eqIdx < 0) return false;
    return pedreiraRaw.slice(1).some(row => selectedVehicles.includes((row[eqIdx] || '').toString().trim()));
  }, [selectedVehicles, pedreiraRaw]);

  const vehicleViagensType = useMemo((): 'carga' | 'pipa' | 'pedreira' | 'escavadeira' | 'all' => {
    // When multiple vehicles selected, count all types
    if (selectedVehicles.length > 1) return 'all';
    
    let hasCarga = false, hasDescarga = false, hasPipa = false, hasPedreira = false;
    filteredDays.forEach(day => {
      day.producao.forEach(p => {
        if (p.tipo === 'carga') hasCarga = true;
        if (p.tipo === 'descarga') hasDescarga = true;
        if (p.tipo === 'pipa') hasPipa = true;
        if (p.tipo === 'pedreira') hasPedreira = true;
      });
    });
    // Se é escavadeira (aparece como Prefixo_Eq na pedreira), usa tipo escavadeira
    if (isEscavadeira && !hasCarga && !hasDescarga) return 'escavadeira';
    // For vehicles that ONLY have pipa or pedreira data, use that type
    if (hasPipa && !hasCarga && !hasDescarga) return 'pipa';
    if (hasPedreira && !hasCarga && !hasDescarga) return 'pedreira';
    // For mixed carga/descarga, prefer carga to avoid double counting
    if (hasCarga) return 'carga';
    if (hasDescarga) return 'carga';
    if (hasPipa) return 'pipa';
    if (hasPedreira) return 'pedreira';
    return 'all';
  }, [filteredDays, isEscavadeira, selectedVehicles.length]);

  // ─── Detect vehicle empresa from horímetros ───
  const vehicleEmpresa = useMemo(() => {
    for (const day of dailyEntries) {
      for (const h of day.horimetros) {
        if (h.empresa) return h.empresa;
      }
    }
    return '';
  }, [dailyEntries]);

  // ─── Summary KPIs ───
  const parseNumBR = (val: string): number => {
    if (!val || val === '-') return 0;
    const n = parseFloat(val.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  const summary = useMemo(() => {
    let totalViagens = 0, totalVolume = 0, totalLitros = 0, totalValorAbast = 0, totalHorasParado = 0, diasManutencao = 0;
    let totalHorasIntervalo = 0, totalKmIntervalo = 0;
    filteredDays.forEach(day => {
      day.producao.forEach(p => { 
        if (vehicleViagensType === 'all') {
          // Count all types but avoid double-counting carga+descarga for same vehicle
          if (p.tipo !== 'descarga') totalViagens += p.viagens;
        } else if (vehicleViagensType === 'pipa' && p.tipo === 'pipa') totalViagens += p.viagens;
        else if ((vehicleViagensType === 'pedreira' || vehicleViagensType === 'escavadeira') && p.tipo === 'pedreira') totalViagens += p.viagens;
        else if (vehicleViagensType === 'carga' && p.tipo === 'carga') totalViagens += p.viagens;
        totalVolume += p.volume; 
      });
      day.abastecimentos.forEach(a => {
        const q = parseFloat(String(a.quantidade).replace(/\./g, '').replace(',', '.')); if (!isNaN(q)) totalLitros += q;
        const v = parseFloat(String(a.valorTotal).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')); if (!isNaN(v)) totalValorAbast += v;
      });
      if (day.manutencoes.length > 0) {
        diasManutencao++;
        day.manutencoes.forEach(m => {
          totalHorasParado += parseHorasParado(m.horasParado, mediaHoras);
        });
      }
      // Sum intervaloH and totalKm from horímetros
      if (day.horimetros.length > 0) {
        const h = day.horimetros[0];
        totalHorasIntervalo += parseNumBR(h.intervaloH || '');
        totalKmIntervalo += parseNumBR(h.totalKm || '');
      } else if (day.abastecimentos.length > 0) {
        const a = day.abastecimentos[0];
        // Abastecimentos may not have intervaloH, only intervaloKm
        totalKmIntervalo += parseNumBR(a.intervaloKm || '');
      }
    });
    return { totalViagens, totalVolume, totalLitros, totalValorAbast, totalDias: filteredDays.length, totalHorasParado, diasManutencao, totalHorasIntervalo, totalKmIntervalo };
  }, [filteredDays, vehicleViagensType, mediaHoras]);

  // ─── Consolidated rows (including days without records) ───
  const consolidatedRows = useMemo((): ConsolidatedRow[] => {
    const dayDataMap = new Map<string, typeof filteredDays[number]>();
    filteredDays.forEach(day => {
      dayDataMap.set(format(day.dateParsed, 'yyyy-MM-dd'), day);
    });

    let allDates: Date[] = [];
    if (dateFrom && dateTo) {
      const from = startOfDay(dateFrom);
      const to = startOfDay(dateTo);
      if (from <= to) allDates = eachDayOfInterval({ start: from, end: to });
    }
    if (allDates.length === 0) allDates = filteredDays.map(d => d.dateParsed);

    const sorted = dateSortAsc
      ? [...allDates].sort((a, b) => a.getTime() - b.getTime())
      : [...allDates].sort((a, b) => b.getTime() - a.getTime());

    return sorted.map(date => {
      const key = format(date, 'yyyy-MM-dd');
      const day = dayDataMap.get(key);

      if (!day) {
        return {
          data: format(date, 'dd/MM/yyyy'), dateParsed: date, diaSemana: format(date, 'EEE', { locale: ptBR }),
          motorista: '', viagens: 0, volume: 0, litrosAbast: 0, valorAbast: 0,
          horAnterior: '', horAtual: '', intervaloH: '', kmAnterior: '', kmAtual: '', totalKm: '',
          manutencao: false, horasParado: 0, horasTurno: getHorasTurnoFromConfig(turnoConfig, date), problemaManut: '', statusManut: '',
        };
      }

      const viagens = day.producao
        .filter(p => {
          if (vehicleViagensType === 'all') return p.tipo !== 'descarga';
          if (vehicleViagensType === 'pipa') return p.tipo === 'pipa';
          if (vehicleViagensType === 'pedreira' || vehicleViagensType === 'escavadeira') return p.tipo === 'pedreira';
          return p.tipo === 'carga';
        })
        .reduce((s, p) => s + p.viagens, 0);
      const volume = day.producao.reduce((s, p) => s + p.volume, 0);
      const motorista = day.producao.find(p => p.motorista)?.motorista || '';
      let litrosAbast = 0, valorAbast = 0;
      day.abastecimentos.forEach(a => {
        const q = parseFloat(String(a.quantidade).replace(/\./g, '').replace(',', '.')); if (!isNaN(q)) litrosAbast += q;
        const v = parseFloat(String(a.valorTotal).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')); if (!isNaN(v)) valorAbast += v;
      });
      const hor = day.horimetros[0]; const abastHor = day.abastecimentos[0];
      const horAnt = hor?.horimetroAnterior || abastHor?.horimetroAnterior || '';
      const horAt = hor?.horimetroAtual || abastHor?.horimetroAtual || '';
      const intH = hor?.intervaloH || '';
      const kmAnt = hor?.kmAnterior || abastHor?.kmAnterior || '';
      const kmAt = hor?.kmAtual || abastHor?.kmAtual || '';
      const totKm = hor?.totalKm || abastHor?.intervaloKm || '';

      // Manutenção
      const hasManut = day.manutencoes.length > 0;
      let horasParado = 0;
      day.manutencoes.forEach(m => {
        horasParado += parseHorasParado(m.horasParado, mediaHoras);
      });
      const problemaManut = day.manutencoes.map(m => m.problema).filter(Boolean).join('; ');
      const statusManut = day.manutencoes.map(m => m.status).filter(Boolean)[0] || '';

      return {
        data: day.data, dateParsed: day.dateParsed, diaSemana: format(day.dateParsed, 'EEE', { locale: ptBR }), motorista, viagens, volume,
        litrosAbast, valorAbast,
        horAnterior: horAnt, horAtual: horAt, intervaloH: intH,
        kmAnterior: kmAnt, kmAtual: kmAt, totalKm: totKm,
        manutencao: hasManut, horasParado, horasTurno: getHorasTurnoFromConfig(turnoConfig, day.dateParsed), problemaManut, statusManut,
      };
    });
  }, [filteredDays, dateSortAsc, dateFrom, dateTo, vehicleViagensType, turnoConfig, mediaHoras]);

  const activeColumns = useMemo(() => ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)), [visibleColumns]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const clearDates = () => { setDateFrom(undefined); setDateTo(undefined); };

  const getCellValue = (row: ConsolidatedRow, key: ColumnKey): string => {
    switch (key) {
      case 'data': return row.data;
      case 'diaSemana': return row.diaSemana;
      case 'motorista': return row.motorista || '-';
      case 'litrosAbast': return row.litrosAbast > 0 ? row.litrosAbast.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-';
      case 'horAnterior': return formatNum(row.horAnterior);
      case 'horAtual': return formatNum(row.horAtual);
      case 'intervaloH': return formatNum(row.intervaloH);
      case 'kmAnterior': return formatNum(row.kmAnterior);
      case 'kmAtual': return formatNum(row.kmAtual);
      case 'totalKm': return formatNum(row.totalKm);
      case 'manutencao': return row.manutencao ? '🔧 Sim' : '-';
      case 'horasParado': return formatHorasParadoDia(row.horasParado, row.horasTurno);
      case 'problemaManut': return row.problemaManut || '-';
      case 'statusManut': return row.statusManut || '-';
      default: return '-';
    }
  };

  const vehiclesLabel = selectedVehicle === 'ALL'
    ? (selectedEmpresa === 'ALL' ? 'Todos os Veículos' : `Empresa: ${selectedEmpresa}`)
    : selectedVehicle;

  // ─── PDF Export ───
  const exportToPDF = async () => {
    if (selectedVehicles.length === 0 || consolidatedRows.length === 0) return;
    const cols = activeColumns;
    const themeColor = '#1d3557';

    const toBase64 = (src: string): Promise<string> => {
      if (src.startsWith('data:')) return Promise.resolve(src);
      return new Promise((resolve) => {
        const img = new Image();
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
    const periodoStr = `${dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Início'} — ${dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Fim'}`;

    const kpisHtml = `<div class="kpis">
      <div class="kpi kpi-dias"><div class="kpi-label">Dias com Registro</div><div class="kpi-value">${summary.totalDias}</div></div>
      <div class="kpi kpi-viagens"><div class="kpi-label">Total de Viagens</div><div class="kpi-value">${summary.totalViagens}</div></div>
      <div class="kpi kpi-litros"><div class="kpi-label">Litros Abastecidos</div><div class="kpi-value">${summary.totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div></div>
    </div>`;

    const tableHtml = `<table><thead><tr>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead><tbody>
      ${consolidatedRows.map(r => `<tr${r.manutencao ? ' class="manut-row"' : ''}>${cols.map(c => {
        const val = getCellValue(r, c.key);
        const isBold = BOLD_COLS.includes(c.key);
        return `<td${isBold ? ' class="bold"' : ''}>${val}</td>`;
      }).join('')}</tr>`).join('')}
      <tr class="total-row">${cols.map(c => {
        if (c.key === 'data') return `<td class="bold">TOTAL</td>`;
        if (c.key === 'litrosAbast') return `<td class="bold">${summary.totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>`;
        if (c.key === 'intervaloH') return `<td class="bold">${summary.totalHorasIntervalo > 0 ? summary.totalHorasIntervalo.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : ''}</td>`;
        if (c.key === 'totalKm') return `<td class="bold">${summary.totalKmIntervalo > 0 ? summary.totalKmIntervalo.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : ''}</td>`;
        if (c.key === 'horasParado') return `<td class="bold">${formatHorasParadoTotal(summary.totalHorasParado, mediaHoras)}</td>`;
        if (c.key === 'manutencao') return `<td class="bold">${summary.diasManutencao > 0 ? summary.diasManutencao + 'd' : ''}</td>`;
        return `<td></td>`;
      }).join('')}</tr>
    </tbody></table>`;

    const obraNomeHtml = obraConfig.nome ? `<div class="header-obra-nome">${obraConfig.nome}</div>` : '';
    const obraLocalHtml = obraConfig.local ? `<div class="header-obra-local">📍 ${obraConfig.local}</div>` : '';
    const empresaHtml = vehicleEmpresa ? `<span style="font-size:10px;opacity:0.8;">🏢 ${vehicleEmpresa}</span>` : '';

    const printContent = `<!DOCTYPE html><html><head>
      <title>Histórico - ${vehiclesLabel}</title>
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { padding: 0; font-size: 9px; }
        .header { background: linear-gradient(135deg, #1d3557, #2d5a8e); color: white; border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
        .header-top { display: flex; align-items: center; gap: 16px; padding: 14px 18px 10px 18px; }
        .header-logo { height: 72px; width: auto; object-fit: contain; background: rgba(255,255,255,0.15); border-radius: 8px; padding: 6px; flex-shrink: 0; }
        .header-info { flex: 1; }
        .header-obra-nome { font-size: 13px; font-weight: 700; opacity: 0.85; margin-bottom: 2px; }
        .header-obra-local { font-size: 10px; opacity: 0.65; margin-bottom: 6px; }
        .header-title { font-size: 20px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.1; }
        .header-bottom { background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: space-between; padding: 7px 18px; border-top: 1px solid rgba(255,255,255,0.15); }
        .header-period { font-size: 11px; opacity: 0.9; }
        .kpis { display: flex; gap: 10px; margin-bottom: 10px; }
        .kpi { flex: 1; border-radius: 8px; padding: 8px 10px; text-align: center; }
        .kpi-label { font-size: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .kpi-value { font-size: 20px; font-weight: 800; }
        .kpi-dias { background: #e0e7ff; color: #3730a3; }
        .kpi-viagens { background: #dcfce7; color: #166534; }
        .kpi-litros { background: #fef9c3; color: #854d0e; }
        table { width: 100%; border-collapse: collapse; font-size: 8px; }
        th { background: ${themeColor}; color: white; padding: 5px 4px; text-align: center; font-size: 8px; }
        td { border: 1px solid #e5e7eb; padding: 3px 4px; text-align: center; }
        tr:nth-child(even) { background: #f9fafb; }
        .total-row { background: #dbeafe !important; font-weight: bold; }
        .manut-row { background: #fef3c7 !important; }
        .bold { font-weight: bold; }
        .footer { text-align: center; margin-top: 10px; font-size: 7px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 6px; }
      </style>
    </head><body>
      <div class="header">
        <div class="header-top">
          <img class="header-logo" src="${logoBase64}" alt="Logo" />
          <div class="header-info">
            ${obraNomeHtml}
            ${obraLocalHtml}
            <div class="header-title">HISTÓRICO CONSOLIDADO — ${vehiclesLabel}</div>
          </div>
        </div>
        <div class="header-bottom">
          <span class="header-period">📅 Período: <b>${periodoStr}</b></span>
          ${empresaHtml}
        </div>
      </div>
      ${kpisHtml}
      ${tableHtml}
      <div class="footer">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • ApropriAPP - Gestão Inteligente</div>
    </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };


  const exportToXLSX = () => {
    if (selectedVehicles.length === 0 || consolidatedRows.length === 0) return;
    const cols = activeColumns;

    const headerRow = cols.map(c => c.label);
    const dataRows = consolidatedRows.map(r => cols.map(c => getCellValue(r, c.key)));
    const totalRow = cols.map(c => {
      if (c.key === 'data') return 'TOTAL';
      if (c.key === 'litrosAbast') return summary.totalLitros;
      if (c.key === 'intervaloH') return summary.totalHorasIntervalo;
      if (c.key === 'totalKm') return summary.totalKmIntervalo;
      if (c.key === 'horasParado') return summary.totalHorasParado;
      if (c.key === 'manutencao') return summary.diasManutencao > 0 ? `${summary.diasManutencao} dias` : '';
      return '';
    });

    const wsData = [headerRow, ...dataRows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = cols.map(c => ({ wch: c.key === 'motorista' || c.key === 'problemaManut' ? 25 : c.key === 'data' ? 12 : 14 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    const periodo = dateFrom && dateTo ? `_${format(dateFrom, 'ddMMyyyy')}_${format(dateTo, 'ddMMyyyy')}` : '';
    const empresaSuffix = vehicleEmpresa ? `_${vehicleEmpresa.replace(/\s+/g, '_')}` : '';
    const fileVehicles = selectedVehicles.length === 1 ? selectedVehicles[0] : `${selectedVehicles.length}veiculos`;
    XLSX.writeFile(wb, `Historico_${fileVehicles}${empresaSuffix}${periodo}.xlsx`);
  };

  if (isLoading && cargaRaw.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-2 px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-4 h-4 text-primary" />
          Histórico Consolidado do Veículo
        </CardTitle>
        <div className="flex gap-2">
          {selectedVehicles.length > 0 && consolidatedRows.length > 0 && (
            <>
              <Popover open={showColumnConfig} onOpenChange={setShowColumnConfig}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="w-4 h-4 mr-2" />
                    Colunas
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-3">
                    <p className="font-semibold text-sm">Colunas visíveis</p>
                    {COLUMN_GROUPS.map(group => (
                      <div key={group.key}>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{group.label}</p>
                        <div className="space-y-1.5">
                          {ALL_COLUMNS.filter(c => c.group === group.key).map(col => (
                            <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5">
                              <Checkbox
                                checked={visibleColumns.includes(col.key)}
                                onCheckedChange={() => toggleColumn(col.key)}
                              />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setVisibleColumns(DEFAULT_VISIBLE)}>
                        Restaurar
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setVisibleColumns(ALL_COLUMNS.map(c => c.key))}>
                        Todas
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Popover open={showTurnoConfig} onOpenChange={setShowTurnoConfig}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Clock className="w-4 h-4 mr-2" />
                    Turnos
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-3">
                    <p className="font-semibold text-sm">Configuração de Turnos</p>
                    <p className="text-xs text-muted-foreground">Defina o horário de início e fim do turno para cada dia da semana.</p>
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5, 6, 0].map(dow => {
                        const turno = turnoConfig[dow];
                        const horas = Math.max(0, turno.fim - turno.inicio);
                        return (
                          <div key={dow} className="flex items-center gap-2">
                            <span className="text-xs font-medium w-16 text-foreground">{DIA_LABELS[dow]}</span>
                            <Input
                              type="number"
                              min={0}
                              max={23}
                              value={turno.inicio}
                              onChange={e => updateTurno(dow, 'inicio', parseInt(e.target.value) || 0)}
                              className="w-16 h-7 text-xs text-center"
                            />
                            <span className="text-xs text-muted-foreground">às</span>
                            <Input
                              type="number"
                              min={0}
                              max={24}
                              value={turno.fim}
                              onChange={e => updateTurno(dow, 'fim', parseInt(e.target.value) || 0)}
                              className="w-16 h-7 text-xs text-center"
                            />
                            <span className="text-xs text-muted-foreground w-10 text-right">{horas}h</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={resetTurno}>
                        Restaurar Padrão
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Média útil: {mediaHoras.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h/dia</p>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportToXLSX}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                XLSX
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 px-4 pt-0 pb-3">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-end">
          {/* Empresa filter */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground pl-0.5">Empresa</label>
            <Select
              value={selectedEmpresa}
              onValueChange={(val) => {
                setSelectedEmpresa(val);
                setSelectedVehicle('ALL');
                // Sync vehicles: ALL in new empresa context
                if (val === 'ALL') {
                  setSelectedVehicles(allVehicles);
                } else {
                  // will be corrected by effect below
                }
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as empresas</SelectItem>
                {allEmpresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle filter */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground pl-0.5">Veículo</label>
            <Select
              value={selectedVehicle}
              onValueChange={(val) => {
                setSelectedVehicle(val);
                syncSelectedVehicles(selectedEmpresa, val, vehiclesForEmpresa);
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todos os veículos" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="ALL">Todos os veículos</SelectItem>
                {vehiclesForEmpresa.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="flex gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground pl-0.5">De</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[130px] h-9 justify-start text-left font-normal text-xs", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground pl-0.5">Até</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[130px] h-9 justify-start text-left font-normal text-xs", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="icon" onClick={clearDates} className="h-9 w-9 mb-0">
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Quick: show all button */}
          <Button
            variant={selectedVehicles.length === allVehicles.length && !dateFrom && !dateTo ? 'default' : 'outline'}
            size="sm"
            className="h-9 self-end text-xs"
            onClick={() => {
              setSelectedEmpresa('ALL');
              setSelectedVehicle('ALL');
              setSelectedVehicles(allVehicles);
              setDateFrom(undefined);
              setDateTo(undefined);
            }}
          >
            <Truck className="w-3.5 h-3.5 mr-1.5" />
            Todos
          </Button>
        </div>

        {consolidatedRows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Truck className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium">
              {selectedVehicles.length === 0
                ? 'Selecione um veículo ou empresa para ver o histórico'
                : 'Nenhum registro encontrado para o período selecionado'}
            </p>
            <p className="text-sm mt-1">Use os filtros acima para refinar a busca</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: 'Dias com Registro', value: String(summary.totalDias), bg: 'bg-orange-50 border border-orange-300', text: 'text-orange-700' },
                { label: 'Total de Viagens', value: String(summary.totalViagens), bg: 'bg-blue-50 border border-blue-300', text: 'text-blue-700' },
                { label: 'Litros Abastecidos', value: summary.totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), bg: 'bg-green-50 border border-green-300', text: 'text-green-700' },
                { label: 'Horas Trabalhadas', value: summary.totalHorasIntervalo > 0 ? summary.totalHorasIntervalo.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'h' : '-', bg: 'bg-purple-50 border border-purple-300', text: 'text-purple-700' },
              ].map(kpi => (
                <Card key={kpi.label} className={cn("shadow-none", kpi.bg)}>
                  <CardContent className="py-1.5 px-3">
                    <p className={cn("text-[10px] uppercase tracking-wider font-semibold truncate", kpi.text)}>{kpi.label}</p>
                    <p className={cn("text-xl font-extrabold leading-tight", kpi.text)}>{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-[#1d3557]/20">
              <Table>
                <TableHeader>
                <TableRow className="bg-[#1d3557]/10 hover:bg-[#1d3557]/10 border-b-2 border-[#1d3557]/20">
                    {activeColumns.map(col => {
                      const isManut = col.group === 'manutencao';
                      return (
                      <TableHead
                        key={col.key}
                        className={cn(
                          "font-bold text-[10px] uppercase tracking-wider py-2.5 px-3 whitespace-nowrap text-center h-10 text-[#1d3557]",
                          col.key === 'data' && "cursor-pointer select-none hover:bg-[#1d3557]/15",
                          isManut && "bg-[#fef3c7]/60 text-amber-800"
                        )}
                        onClick={col.key === 'data' ? () => setDateSortAsc(prev => !prev) : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.key === 'manutencao' && '🔧 '}
                          {col.label}
                          {col.key === 'data' && <ArrowUpDown className="w-3 h-3 opacity-60" />}
                        </span>
                      </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedRows.map((r, idx) => {
                    const isEmpty = r.viagens === 0 && !r.motorista && !r.horAnterior && !r.litrosAbast && !r.manutencao;
                    return (
                    <TableRow key={idx} className={cn(
                      isEmpty ? "bg-muted/10 opacity-60" : r.manutencao ? "bg-amber-50/70 border-l-4 border-l-amber-400" : idx % 2 === 0 ? "bg-background" : "bg-muted/30",
                      "hover:bg-muted/50 transition-colors"
                    )}>
                      {activeColumns.map(col => {
                        const isManut = col.group === 'manutencao';
                        const val = getCellValue(r, col.key);
                        return (
                          <TableCell
                          key={col.key}
                          className={cn(
                            "py-1.5 px-3 text-[12px] tabular-nums text-center",
                            BOLD_COLS.includes(col.key) && "font-semibold",
                            col.key === 'data' && "font-medium whitespace-nowrap",
                            col.key === 'diaSemana' && "capitalize text-xs",
                            col.key === 'manutencao' && r.manutencao && "text-amber-700 font-bold",
                            col.key === 'horasParado' && r.horasParado > 0 && "text-red-600 font-bold",
                            col.key === 'problemaManut' && r.problemaManut && "text-left text-amber-800 max-w-[200px] truncate",
                            col.key === 'statusManut' && r.statusManut && "font-semibold",
                            col.key === 'statusManut' && r.statusManut?.toLowerCase().includes('conclu') && "text-green-700",
                            col.key === 'statusManut' && r.statusManut?.toLowerCase().includes('aberto') && "text-red-600",
                            col.key === 'statusManut' && r.statusManut?.toLowerCase().includes('andamento') && "text-amber-600",
                            isManut && r.manutencao && "bg-amber-50/40",
                          )}
                          title={col.key === 'problemaManut' ? r.problemaManut : undefined}
                        >
                          {val}
                        </TableCell>
                        );
                      })}
                    </TableRow>
                    );
                  })}
                  {/* Total row */}
                  <TableRow className="bg-[#1d3557]/5 hover:bg-[#1d3557]/5 border-t-2 border-[#1d3557]/20">
                    {activeColumns.map(col => {
                      let val = '';
                      if (col.key === 'data') val = 'TOTAL';
                      else if (col.key === 'litrosAbast') val = summary.totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
                      else if (col.key === 'intervaloH') val = summary.totalHorasIntervalo > 0 ? summary.totalHorasIntervalo.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '';
                      else if (col.key === 'totalKm') val = summary.totalKmIntervalo > 0 ? summary.totalKmIntervalo.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '';
                      else if (col.key === 'horasParado') val = formatHorasParadoTotal(summary.totalHorasParado, mediaHoras);
                      else if (col.key === 'manutencao') val = summary.diasManutencao > 0 ? `${summary.diasManutencao}d` : '';

                      return (
                        <TableCell
                          key={col.key}
                          className="py-1.5 px-3 font-bold text-[12px] tabular-nums text-center text-[#1d3557]"
                        >
                          {val}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
