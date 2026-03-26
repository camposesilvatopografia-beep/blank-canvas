import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, parse, isValid, eachDayOfInterval, startOfMonth, endOfMonth, getDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Settings2, CalendarDays, Layers, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { Loader2, RefreshCw, FileSpreadsheet, FileDown, Calculator, Pencil, Save, X, FileText, Maximize2, CalendarIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';

const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const MEDICAO_COLUMNS = [
  { key: 'data', label: 'Data', group: 'geral', alwaysVisible: true },
  { key: 'dia', label: 'Dia da Semana', group: 'geral' },
  { key: 'horInicial', label: 'Hodômetro Inicial', group: 'hodometro' },
  { key: 'horFinal', label: 'Hodômetro Final', group: 'hodometro' },
  { key: 'ht', label: 'H.T.', group: 'horas' },
  { key: 'horasTrabPagar', label: 'Horas Trab. a Pagar', group: 'horas' },
  { key: 'horasMinimas', label: 'Horas Mínimas', group: 'horas' },
  { key: 'horasMinPagar', label: 'Horas Mín. a Pagar', group: 'horas' },
  { key: 'viagens', label: 'Viagens', group: 'geral' },
  { key: 'manutencao', label: 'Manutenção', group: 'paralizacoes' },
  { key: 'operadorParada', label: 'Operador (Parada)', group: 'paralizacoes' },
  { key: 'aDisposicao', label: 'A Disposição', group: 'paralizacoes' },
  { key: 'clima', label: 'Clima', group: 'paralizacoes' },
  { key: 'qtdAbastecida', label: 'Qtd. Abastecida (L)', group: 'geral' },
  { key: 'combustivel', label: 'Cons. (L/h)', group: 'geral' },
  { key: 'desconto', label: 'Desconto (R$)', group: 'geral' },
  { key: 'observacao', label: 'Observações', group: 'geral' },
] as const;

type MedicaoColumnKey = typeof MEDICAO_COLUMNS[number]['key'];

const HIDDEN_BY_DEFAULT = new Set(['horasTrabPagar', 'horasMinimas', 'horasMinPagar', 'viagens', 'qtdAbastecida']);
const DEFAULT_VISIBLE_COLS = new Set<string>(MEDICAO_COLUMNS.filter(c => !HIDDEN_BY_DEFAULT.has(c.key)).map(c => c.key));

// Types that should auto-show viagens column
const VIAGENS_AUTO_TYPES = ['caminhão pipa', 'caminhao pipa', 'pipa', 'caminhão reboque', 'caminhao reboque', 'reboque'];

interface MedicaoRow {
  date: Date;
  diaSemana: string;
  horInicial: number;
  horFinal: number;
  ht: number;
  horasTrabPagar: number;
  horasMinimas: number;
  horasMinPagar: number;
  viagens: number;
  // Paralizações
  manutencao: number;
  operador: number;
  aDisposicao: number;
  clima: number;
  // Abastecimento
  combustivelQtd: number;
  desconto: number;
  observacao: string;
  isEdited?: boolean;
}

interface EquipmentInfo {
  prefixo: string;
  descricao: string;
  empresa: string;
  tipo: string;
  operador: string;
}

/** Remove accents, spaces, underscores and lowercase for resilient header matching */
function norm(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]/g, '').toLowerCase();
}

/** Normalize a vehicle prefix for consistent matching: keep only letters/numbers */
function normPrefixo(s: string): string {
  return (s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Find column index by normalized partial match; supports multiple candidates */
function findCol(headers: string[], ...candidates: string[]): number {
  const normed = headers.map(norm);
  for (const c of candidates) {
    const cn = norm(c);
    // exact match first
    const exact = normed.findIndex(h => h === cn);
    if (exact >= 0) return exact;
    // partial match
    const partial = normed.findIndex(h => h.includes(cn));
    if (partial >= 0) return partial;
  }
  return -1;
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  let d = parse(val, 'dd/MM/yyyy', new Date());
  if (isValid(d)) return d;
  d = parse(val, 'MM/dd/yyyy', new Date());
  if (isValid(d)) return d;
  d = parse(val, 'yyyy-MM-dd', new Date());
  if (isValid(d)) return d;
  d = new Date(val);
  return isValid(d) ? d : null;
}

function parseBRNum(val: string | number | undefined | null): number {
  if (val == null || val === '') return 0;
  const s = String(val).trim();
  if (!s) return 0;
  if (s.includes('.') && s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  if (s.includes(',')) return parseFloat(s.replace(',', '.'));
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length >= 2 && parts[parts.length - 1].length === 3) return parseFloat(s.replace(/\./g, ''));
    return parseFloat(s);
  }
  return parseFloat(s);
}

function fmtNum(n: number, decimals = 1): string {
  if (isNaN(n) || n === 0) return '-';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number): string {
  if (isNaN(n) || n === 0) return '-';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function MedicaoEquipamentosTab() {
  const [records, setRecords] = useState<any[]>([]);
  const [manutMap, setManutMap] = useState<Map<string, any>>(new Map());
  const [abastMap, setAbastMap] = useState<Map<string, number>>(new Map());
  const [pluvioMap, setPluvioMap] = useState<Map<string, number>>(new Map());
  const [mobilizacaoMap, setMobilizacaoMap] = useState<Map<string, number>>(new Map());
  const [viagensMap, setViagensMap] = useState<Map<string, number>>(new Map());
  const [allEquipment, setAllEquipment] = useState<EquipmentInfo[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [medicaoAte, setMedicaoAte] = useState<Date | undefined>(undefined); // cutoff date for measurement period
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [equipComboOpen, setEquipComboOpen] = useState(false);
  const [selectedEmpresaTab, setSelectedEmpresaTab] = useState<string>('todas');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => new Set(DEFAULT_VISIBLE_COLS));
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  
  // Multi-vehicle mode
  const [multiMode, setMultiMode] = useState(false);
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [multiFilterTipo, setMultiFilterTipo] = useState<string>('todos');

  const isColVisible = useCallback((key: string) => visibleCols.has(key), [visibleCols]);
  const toggleCol = useCallback((key: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  
  // Editable config per vehicle
  const [valorLocacaoMensal, setValorLocacaoMensal] = useState(25000);
  const [valorHT, setValorHT] = useState(125);
  const [horasMinMes, setHorasMinMes] = useState(200); // Total target hours/month
  const [horasMinDia, setHorasMinDia] = useState(9.09);
  const [valorHoraMinDia, setValorHoraMinDia] = useState(1136.36);
  
  // Working days selection (dias úteis)
  const [diasUteis, setDiasUteis] = useState<Set<string>>(new Set());
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Editable overrides
  const [editedRows, setEditedRows] = useState<Map<string, Partial<MedicaoRow>>>(new Map());
  
  // Toggle to apply/ignore discounts
  const [aplicarDesconto, setAplicarDesconto] = useState(true);
  
  const tableRef = useRef<HTMLDivElement>(null);
  const { readSheet } = useGoogleSheets();
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, manutData, frotaGeralData, abastData, pluvioData, mobilData, pipasData, cargaData, descargaData] = await Promise.all([
        readSheet('Horimetros'),
        readSheet('Manutenções'),
        readSheet('Frota Geral'),
        readSheet('Abastecimentos'),
        readSheet('Pluviometria'),
        readSheet('Mobilização'),
        readSheet('Apontamento_Pipa').catch(() => []),
        readSheet('Carga').catch(() => []),
        readSheet('Descarga').catch(() => []),
      ]);

      const horimetroVehicles = new Set<string>();
      if (data && data.length > 1) {
        const hHeaders = (data[0] as string[]).map(h => String(h || '').trim());
        const hVeiculoIdx = findCol(hHeaders, 'Veiculo', 'Veículo', 'Prefixo', 'veiculo', 'prefixo');
        if (hVeiculoIdx >= 0) {
          data.slice(1).forEach(row => {
            const veic = normPrefixo(row[hVeiculoIdx]);
            if (veic) horimetroVehicles.add(veic);
          });
        }
      }

      // Parse Frota Geral
      if (frotaGeralData && frotaGeralData.length > 1) {
        const fHeaders = (frotaGeralData[0] as string[]).map(h => String(h || '').trim());
        const fPrefixoIdx = findCol(fHeaders, 'Codigo', 'Prefixo', 'codigo');
        const fDescIdx = findCol(fHeaders, 'Descricao', 'Descrição', 'descricao');
        const fEmpresaIdx = findCol(fHeaders, 'Empresa', 'empresa');
        const fTipoIdx = findCol(fHeaders, 'Categoria', 'Tipo', 'tipo');
        const fStatusIdx = findCol(fHeaders, 'Status', 'status');
        const fOperadorIdx = findCol(fHeaders, 'Operador', 'Motorista', 'operador', 'motorista');

        console.log('[Medicao] Frota Geral headers:', fHeaders, '→ operador:', fOperadorIdx);

        const excludedEmpresas = ['obra saneamento', 'outros'];
        const equips = frotaGeralData.slice(1)
          .filter(row => {
            const prefixo = String(row[fPrefixoIdx] || '').trim();
            const empresa = String(row[fEmpresaIdx] || '').trim().toLowerCase();
            const statusNorm = norm(String(row[fStatusIdx] || ''));
            const isInactive = statusNorm.includes('desmobilizado') || statusNorm.includes('inativo');
            const hasHorimetroHistory = horimetroVehicles.has(normPrefixo(prefixo));
            return prefixo && !excludedEmpresas.includes(empresa) && (!isInactive || hasHorimetroHistory);
          })
          .map(row => ({
            prefixo: String(row[fPrefixoIdx] || '').trim(),
            descricao: String(row[fDescIdx] || '').trim(),
            empresa: String(row[fEmpresaIdx] || '').trim(),
            tipo: String(row[fTipoIdx] || '').trim(),
            operador: fOperadorIdx >= 0 ? String(row[fOperadorIdx] || '').trim() : '',
          }));
        setAllEquipment(equips);
        if (!selectedVehicle && equips.length > 0) setSelectedVehicle(equips[0].prefixo);
      }

      // Parse maintenance — align with FrotaHistoricoVeiculoTab mapping
      const mMap = new Map<string, { servico: string; horasParado: string }>();
      if (manutData && manutData.length > 1) {
        const mHdrs = (manutData[0] as string[]).map(h => String(h || '').trim());
        const mVeiculoIdx = findCol(mHdrs, 'Veiculo', 'Veículo', 'Prefixo', 'Codigo', 'Código', 'veiculo', 'prefixo', 'codigo');
        const mResumoIdx = findCol(mHdrs, 'Problema_Simplificado', 'Problema Simplificado', 'Tag', 'Tags');
        const mProblemaIdx = findCol(mHdrs, 'Problema', 'problema', 'Defeito', 'Falha');
        const mServicoIdx = findCol(mHdrs, 'Servico', 'Serviço', 'servico', 'Tipo_Servico', 'Tipo Servico');
        const mDataIdx = findCol(mHdrs, 'Data', 'data');
        const mDataEntradaIdx = findCol(mHdrs, 'Data_Entrada', 'Data Entrada', 'Data_entrada');
        const mHorasParadoIdx = findCol(mHdrs, 'Horas_Parado', 'Horas Parado', 'horas_parado', 'Hrs_Parado', 'Tempo_Parado', 'Tempo Parado');
        const mHoraEntIdx = findCol(mHdrs, 'Hora_Entrada', 'Hora Entrada', 'hora_entrada');
        const mHoraSaiIdx = findCol(mHdrs, 'Hora_Saida', 'Hora Saida', 'Hora Saída', 'hora_saida');
        const mDataSaiIdx = findCol(mHdrs, 'Data_Saida', 'Data Saida', 'Data Saída', 'data_saida');
        // Prefer 'Data' column, fallback to 'Data_Entrada'
        const bestDateIdx = mDataIdx >= 0 ? mDataIdx : mDataEntradaIdx;

        const summarizeManut = (...values: string[]) => {
          const normalizeResumo = (v: string) => String(v || '')
            .replace(/^manutenc[aã]o\s*:?\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();

          const tokens = values
            .flatMap(v => String(v || '').split(/[;|/]+/g))
            .map(normalizeResumo)
            .filter(Boolean);

          const unique = Array.from(new Map(tokens.map(t => [norm(t), t])).values());
          return unique.slice(0, 2).join('; ');
        };

        console.log('[Medicao] Manutenções headers:', mHdrs);
        console.log('[Medicao] Manutenções col indexes:', { veiculo: mVeiculoIdx, data: bestDateIdx, resumo: mResumoIdx, problema: mProblemaIdx, servico: mServicoIdx, hrsParado: mHorasParadoIdx, horaEnt: mHoraEntIdx, horaSai: mHoraSaiIdx });

        manutData.slice(1).forEach(row => {
          const veiculo = normPrefixo(row[mVeiculoIdx]);
          const dataStr = String(row[bestDateIdx] || '').trim();
          if (!veiculo || !dataStr) return;
          const parsed = parseDate(dataStr);
          const dateKey = parsed ? format(parsed, 'yyyy-MM-dd') : dataStr;

          // Determine concise description: prefer simplified tag, fallback to problem, then service
          const resumo = mResumoIdx >= 0 ? String(row[mResumoIdx] || '').trim() : '';
          const problema = mProblemaIdx >= 0 ? String(row[mProblemaIdx] || '').trim() : '';
          const servico = mServicoIdx >= 0 ? String(row[mServicoIdx] || '').trim() : '';
          const descricaoManut = summarizeManut(resumo, problema, servico);

          // Calculate horas parado: prefer direct field, then hora_entrada/hora_saida, then data_entrada/data_saida
          let horasParadoVal = mHorasParadoIdx >= 0 ? String(row[mHorasParadoIdx] || '').trim() : '';
          if (!horasParadoVal && mHoraEntIdx >= 0 && mHoraSaiIdx >= 0) {
            try {
              const entStr = String(row[mHoraEntIdx] || '').trim();
              const saiStr = String(row[mHoraSaiIdx] || '').trim();
              if (entStr && saiStr) {
                const [hE, mE] = entStr.split(':').map(Number);
                const [hS, mS] = saiStr.split(':').map(Number);
                if (!isNaN(hE) && !isNaN(hS)) {
                  const diffMin = (hS * 60 + (mS || 0)) - (hE * 60 + (mE || 0));
                  if (diffMin > 0) horasParadoVal = (diffMin / 60).toFixed(1);
                }
              }
            } catch { /* ignore */ }
          }
          if (!horasParadoVal && mDataEntradaIdx >= 0 && mDataSaiIdx >= 0) {
            try {
              const entDate = parseDate(String(row[mDataEntradaIdx] || ''));
              const saiDate = parseDate(String(row[mDataSaiIdx] || ''));
              if (entDate && saiDate) {
                const diffHours = (saiDate.getTime() - entDate.getTime()) / (1000 * 60 * 60);
                if (diffHours > 0) horasParadoVal = diffHours.toFixed(1);
              }
            } catch { /* ignore */ }
          }
          const key = `${veiculo}|${dateKey}`;
          const existing = mMap.get(key);
          if (existing) {
            // Accumulate hours and combine descriptions for multiple entries per day
            const prevHrs = parseBRNum(existing.horasParado);
            const newHrs = parseBRNum(horasParadoVal);
            const combinedHrs = prevHrs + newHrs;
            const combinedDesc = summarizeManut(existing.servico, descricaoManut);
            mMap.set(key, {
              servico: combinedDesc,
              horasParado: combinedHrs > 0 ? combinedHrs.toFixed(1) : '',
            });
          } else {
            mMap.set(key, {
              servico: descricaoManut,
              horasParado: horasParadoVal,
            });
          }
        });
        console.log(`[Medicao] Manutenções parsed ${mMap.size} entries`);
      }
      setManutMap(mMap);

      // Parse Abastecimentos — match Volume, Quantidade, Litros etc.
      const aMap = new Map<string, number>();
      if (abastData && abastData.length > 1) {
        const aHdrs = (abastData[0] as string[]).map(h => String(h || '').trim());
        const aDataIdx = findCol(aHdrs, 'Data', 'data');
        const aVeiculoIdx = findCol(aHdrs, 'Veiculo', 'Veículo', 'Prefixo', 'veiculo', 'prefixo');
        const aQtdIdx = findCol(aHdrs, 'Volume', 'Quantidade', 'Litros', 'Qtd', 'quantidade', 'volume');

        console.log('[Medicao] Abastecimentos headers:', aHdrs, '→ data:', aDataIdx, 'veiculo:', aVeiculoIdx, 'qtd:', aQtdIdx);

        abastData.slice(1).forEach(row => {
          const veiculo = normPrefixo(row[aVeiculoIdx]);
          const dataStr = String(row[aDataIdx] || '').trim();
          const qtd = parseBRNum(row[aQtdIdx]);
          if (!veiculo || !dataStr || isNaN(qtd) || qtd <= 0) return;
          const parsed = parseDate(dataStr);
          const dateKey = parsed ? format(parsed, 'yyyy-MM-dd') : dataStr;
          const key = `${veiculo}|${dateKey}`;
          aMap.set(key, (aMap.get(key) || 0) + qtd);
        });
      }
      setAbastMap(aMap);

      // Parse Pluviometria
      const pMap = new Map<string, number>();
      if (pluvioData && pluvioData.length > 1) {
        const pHdrs = (pluvioData[0] as string[]).map(h => String(h || '').trim());
        const pDataIdx = findCol(pHdrs, 'Data', 'data');
        const pPrecipIdx = findCol(pHdrs, 'Precipitacao', 'Precipitação', 'precipitacao', 'mm', 'Chuva', 'chuva', 'Acumulado_Dia');

        console.log('[Medicao] Pluviometria headers:', pHdrs, '→ data:', pDataIdx, 'precip:', pPrecipIdx);

        pluvioData.slice(1).forEach(row => {
          const dataStr = String(row[pDataIdx] || '').trim();
          const precip = parseBRNum(row[pPrecipIdx]);
          if (!dataStr || isNaN(precip) || precip <= 0) return;
          const parsed = parseDate(dataStr);
          const dateKey = parsed ? format(parsed, 'yyyy-MM-dd') : dataStr;
          pMap.set(dateKey, (pMap.get(dateKey) || 0) + precip);
        });
      }
      // Parse Mobilização — get valor locação mensal per vehicle code
      const mobMap = new Map<string, number>();
      if (mobilData && mobilData.length > 1) {
        const mobHdrs = (mobilData[0] as string[]).map(h => String(h || '').trim());
        const mobCodigoIdx = findCol(mobHdrs, 'Codigo', 'Código', 'TAG', 'codigo');
        const mobValorIdx = findCol(mobHdrs, 'Valor', 'Valor_Locacao', 'Valor Locação', 'valor');

        console.log('[Medicao] Mobilização headers:', mobHdrs, '→ codigo:', mobCodigoIdx, 'valor:', mobValorIdx);

        if (mobCodigoIdx >= 0 && mobValorIdx >= 0) {
          mobilData.slice(1).forEach(row => {
            const codigo = normPrefixo(row[mobCodigoIdx]);
            const rawValor = String(row[mobValorIdx] || '').trim();
            if (!codigo || !rawValor) return;
            // Parse BRL currency: "R$ 25.000,00" or "25000" etc.
            const cleaned = rawValor.replace(/[R$\s.]/g, '').replace(',', '.');
            const num = parseFloat(cleaned);
            if (!isNaN(num) && num > 0) {
              mobMap.set(codigo, num);
            }
          });
        }
      }
      setMobilizacaoMap(mobMap);

      // Parse Viagens — from Pipas, Carga, Descarga
      const vMap = new Map<string, number>();
      const parseTripsSheet = (sheetData: any[][], prefixoSynonyms: string[], dataSynonyms: string[], viagensSynonyms: string[]) => {
        if (!sheetData || sheetData.length < 2) return;
        const sHdrs = (sheetData[0] as string[]).map(h => String(h || '').trim());
        const sPrefIdx = findCol(sHdrs, ...prefixoSynonyms);
        const sDataIdx = findCol(sHdrs, ...dataSynonyms);
        const sViagensIdx = findCol(sHdrs, ...viagensSynonyms);
        if (sPrefIdx < 0 || sDataIdx < 0) return;
        sheetData.slice(1).forEach(row => {
          const prefixo = normPrefixo(row[sPrefIdx]);
          const dataStr = String(row[sDataIdx] || '').trim();
          if (!prefixo || !dataStr) return;
          const parsed = parseDate(dataStr);
          const dateKey = parsed ? format(parsed, 'yyyy-MM-dd') : dataStr;
          const key = `${prefixo}|${dateKey}`;
          const viagens = sViagensIdx >= 0 ? parseBRNum(row[sViagensIdx]) : 1;
          vMap.set(key, (vMap.get(key) || 0) + (viagens > 0 ? viagens : 1));
        });
      };
      // Pipas: columns ID_Pipa, Data, Prefixo, ..., N_Viagens
      parseTripsSheet(pipasData, ['Prefixo', 'Veiculo', 'Veículo', 'prefixo'], ['Data', 'data'], ['N_Viagens', 'Viagens', 'viagens', 'Num_Viagens']);
      // Carga: each row = 1 trip
      parseTripsSheet(cargaData, ['Prefixo', 'Veiculo', 'Veículo', 'Codigo', 'prefixo', 'Caminhão', 'Caminhao'], ['Data', 'data'], ['Viagens', 'viagens', 'N_Viagens']);
      // Descarga: each row = 1 trip
      parseTripsSheet(descargaData, ['Prefixo', 'Veiculo', 'Veículo', 'Codigo', 'prefixo', 'Caminhão', 'Caminhao'], ['Data', 'data'], ['Viagens', 'viagens', 'N_Viagens']);
      setViagensMap(vMap);

      // Parse Horimetros
      if (data && data.length > 1) {
        const hdrs = (data[0] as string[]).map(h => String(h || '').trim());
        const dataIdx = findCol(hdrs, 'Data', 'data');
        const veiculoIdx = findCol(hdrs, 'Veiculo', 'Veículo', 'Prefixo', 'veiculo');
        const descricaoIdx = findCol(hdrs, 'Descricao', 'Descrição', 'descricao');
        const empresaIdx = findCol(hdrs, 'Empresa', 'empresa');
        const operadorIdx = findCol(hdrs, 'Operador', 'Motorista', 'operador');
        const horAntIdx = findCol(hdrs, 'Horimetro_Anterior', 'Horimetro Anterior', 'Horímetro Anterior', 'horimetro anterior', 'Hor_Anterior');
        const horAtualIdx = findCol(hdrs, 'Horimetro_Atual', 'Horimetro Atual', 'Horímetro Atual', 'horimetro atual', 'Hor_Atual');
        const kmAntIdx = findCol(hdrs, 'Km_Anterior', 'Km Anterior', 'KM Anterior', 'km anterior', 'Quilometragem_Anterior', 'Quilometragem Anterior', 'Odometro_Anterior', 'Odômetro Anterior');
        const kmAtualIdx = findCol(hdrs, 'Km_Atual', 'Km Atual', 'KM Atual', 'km atual', 'Quilometragem_Atual', 'Quilometragem Atual', 'Odometro_Atual', 'Odômetro Atual');

        console.log('[Medicao] Horimetros headers:', hdrs, '→ data:', dataIdx, 'veiculo:', veiculoIdx, 'horAnt:', horAntIdx, 'horAtual:', horAtualIdx, 'kmAnt:', kmAntIdx, 'kmAtual:', kmAtualIdx);

        const parsed = data.slice(1)
          .filter(row => row[veiculoIdx])
          .map(row => {
            const horAnterior = parseBRNum(row[horAntIdx]);
            const horAtual = parseBRNum(row[horAtualIdx]);
            const kmAnterior = kmAntIdx >= 0 ? parseBRNum(row[kmAntIdx]) : 0;
            const kmAtual = kmAtualIdx >= 0 ? parseBRNum(row[kmAtualIdx]) : 0;
            // Use horímetro if available, otherwise fallback to KM
            const useKm = (horAnterior === 0 && horAtual === 0 && (kmAnterior > 0 || kmAtual > 0));
            return {
              data: row[dataIdx] || '',
              dateParsed: parseDate(row[dataIdx] || ''),
              veiculo: String(row[veiculoIdx] || '').trim(),
              descricao: String(row[descricaoIdx] || '').trim(),
              empresa: String(row[empresaIdx] || '').trim(),
              operador: String(row[operadorIdx] || '').trim(),
              horAnterior: useKm ? kmAnterior : horAnterior,
              horAtual: useKm ? kmAtual : horAtual,
              isKm: useKm,
            };
          });
        setRecords(parsed);

        // Update equipment operadores
        setAllEquipment(prev => {
          const opMap = new Map<string, string>();
          parsed.forEach(r => { if (r.operador) opMap.set(r.veiculo, r.operador); });
          return prev.map(eq => ({ ...eq, operador: eq.operador || opMap.get(eq.prefixo) || '' }));
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [readSheet]);

  useEffect(() => { loadData(); }, []);

  // Auto-set valorLocacaoMensal from Mobilização sheet when vehicle changes
  useEffect(() => {
    if (selectedVehicle && mobilizacaoMap.size > 0) {
      const valor = mobilizacaoMap.get(normPrefixo(selectedVehicle));
      if (valor && valor > 0) {
        setValorLocacaoMensal(valor);
      }
    }
  }, [selectedVehicle, mobilizacaoMap]);

  // Auto-initialize diasUteis with 24 working days (default) when month changes
  const DEFAULT_DIAS_UTEIS = 24;
  useEffect(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end });
    // Collect all non-Sunday days (Mon-Sat)
    const nonSundays = days.filter(d => getDay(d) !== 0);
    // If more than DEFAULT_DIAS_UTEIS, remove Saturdays from the end until we reach the target
    let selected = [...nonSundays];
    if (selected.length > DEFAULT_DIAS_UTEIS) {
      // Remove Saturdays starting from the last one
      const saturdays = selected.filter(d => getDay(d) === 6).reverse();
      let toRemove = selected.length - DEFAULT_DIAS_UTEIS;
      const removeSet = new Set<string>();
      for (const sat of saturdays) {
        if (toRemove <= 0) break;
        removeSet.add(format(sat, 'yyyy-MM-dd'));
        toRemove--;
      }
      selected = selected.filter(d => !removeSet.has(format(d, 'yyyy-MM-dd')));
    }
    setDiasUteis(new Set(selected.map(d => format(d, 'yyyy-MM-dd'))));
    // Reset cutoff to end of month
    setMedicaoAte(end);
  }, [selectedMonth]);

  // Auto-calculate horasMinDia from horasMinMes and dias úteis; valorHoraMinDia from locação
  useEffect(() => {
    if (diasUteis.size > 0) {
      const calcHorasMin = Math.round((horasMinMes / diasUteis.size) * 100) / 100;
      setHorasMinDia(calcHorasMin);
      if (valorLocacaoMensal > 0) {
        setValorHoraMinDia(Math.round((valorLocacaoMensal / diasUteis.size) * 100) / 100);
      }
    }
  }, [diasUteis.size, horasMinMes, valorLocacaoMensal]);

  // Auto-show viagens column for Pipa/Reboque types
  useEffect(() => {
    if (selectedVehicle && allEquipment.length > 0) {
      const eq = allEquipment.find(e => e.prefixo === selectedVehicle);
      if (eq) {
        const tipoNorm = norm(eq.tipo);
        const descNorm = norm(eq.descricao);
        const shouldShowViagens = VIAGENS_AUTO_TYPES.some(t => tipoNorm.includes(norm(t)) || descNorm.includes(norm(t)));
        setVisibleCols(prev => {
          const next = new Set(prev);
          if (shouldShowViagens) next.add('viagens');
          else next.delete('viagens');
          return next;
        });
      }
    }
  }, [selectedVehicle, allEquipment]);

  const EMPRESA_TABS = [
    { key: 'todas', label: 'Todas' },
    { key: 'engemat', label: 'Engemat' },
    { key: 'barreto', label: 'A. Barreto' },
    { key: 'pereira', label: 'L. Pereira' },
    { key: 'terceiros', label: 'Terceiros' },
  ];

  const KNOWN_EMPRESAS = ['engemat', 'barreto', 'pereira'];

  function matchEmpresaTab(empresa: string, tab: string): boolean {
    if (tab === 'todas') return true;
    const e = norm(empresa);
    if (tab === 'engemat') return e.includes('engemat');
    if (tab === 'barreto') return e.includes('barreto');
    if (tab === 'pereira') return e.includes('pereira');
    if (tab === 'terceiros') return !KNOWN_EMPRESAS.some(k => e.includes(k));
    return true;
  }

  const filteredEquipment = useMemo(() => {
    return allEquipment
      .filter(eq => matchEmpresaTab(eq.empresa, selectedEmpresaTab))
      .sort((a, b) => {
        // Sort by tipo then prefixo
        const tipoCompare = a.tipo.localeCompare(b.tipo);
        if (tipoCompare !== 0) return tipoCompare;
        return a.prefixo.localeCompare(b.prefixo, undefined, { numeric: true });
      });
  }, [allEquipment, selectedEmpresaTab]);

  // Group equipment by descrição for organized display
  const groupedEquipment = useMemo(() => {
    const groups = new Map<string, EquipmentInfo[]>();
    const sorted = [...filteredEquipment].sort((a, b) => a.descricao.localeCompare(b.descricao));
    sorted.forEach(eq => {
      const desc = eq.descricao || 'Outros';
      if (!groups.has(desc)) groups.set(desc, []);
      groups.get(desc)!.push(eq);
    });
    return groups;
  }, [filteredEquipment]);

  // Auto-select first vehicle of filtered list when tab changes
  useEffect(() => {
    if (filteredEquipment.length > 0 && !filteredEquipment.find(eq => eq.prefixo === selectedVehicle)) {
      setSelectedVehicle(filteredEquipment[0].prefixo);
    }
  }, [filteredEquipment, selectedVehicle]);

  // Reusable function to build measurement rows for any vehicle
  const buildVehicleRows = useCallback((vehiclePrefixo: string) => {
    if (!vehiclePrefixo || !selectedMonth) return { rows: [] as MedicaoRow[], totals: null as any, equipInfo: null as EquipmentInfo | null, vehicleUsesKm: false };
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const endFull = endOfMonth(start);
    const end = medicaoAte && isSameMonth(medicaoAte, start) ? (medicaoAte < endFull ? medicaoAte : endFull) : endFull;
    const days = eachDayOfInterval({ start, end });
    
    const eqInfo = allEquipment.find(e => e.prefixo === vehiclePrefixo) || null;
    const selectedNorm = normPrefixo(vehiclePrefixo);
    const vehicleRecords = records.filter(r => normPrefixo(r.veiculo) === selectedNorm);
    
    const dateMap = new Map<string, any>();
    vehicleRecords.forEach(r => {
      if (r.dateParsed) dateMap.set(format(r.dateParsed, 'yyyy-MM-dd'), r);
    });

    const usesKm = vehicleRecords.some(r => r.isKm === true);

    // Get mobilização value for this vehicle
    const veicLocacao = mobilizacaoMap.get(selectedNorm) || valorLocacaoMensal;
    const veicHorasMinDia = diasUteis.size > 0 ? Math.round((horasMinMes / diasUteis.size) * 100) / 100 : horasMinDia;
    const veicValorHoraMinDia = diasUteis.size > 0 ? Math.round((veicLocacao / diasUteis.size) * 100) / 100 : valorHoraMinDia;

    let totalHT = 0, totalHorasTrabPagar = 0, totalHorasMinimas = 0, totalHorasMinPagar = 0;
    let totalManut = 0, totalOperador = 0, totalDisposicao = 0, totalClima = 0;
    let totalCombustivel = 0, totalDesconto = 0, totalViagens = 0;

    let manutCarryOver = 0;
    const rowsResult: MedicaoRow[] = [];

    for (const day of days) {
      const dayKey = format(day, 'yyyy-MM-dd');
      const rec = dateMap.get(dayKey);
      const diaSemana = DIAS_SEMANA[getDay(day)];
      const isDomingo = getDay(day) === 0;
      
      const horInicial = rec ? rec.horAnterior : 0;
      const horFinal = rec ? rec.horAtual : 0;
      const ht = (horFinal > horInicial) ? Math.round((horFinal - horInicial) * 100) / 100 : 0;
      const horasTrabPagar = ht > 0 ? Math.round(ht * valorHT * 100) / 100 : 0;
      
      const hasData = horFinal > 0;
      const isDiaUtil = diasUteis.has(dayKey);
      const horasMinimas = (isDiaUtil && hasData) ? veicHorasMinDia : 0;
      const horasMinPagar = (isDiaUtil && hasData) ? veicValorHoraMinDia : 0;
      
      const manutInfo = manutMap.get(`${selectedNorm}|${dayKey}`);
      let rawManut = (manutInfo && !isDomingo) ? parseBRNum(manutInfo.horasParado) : 0;
      rawManut += manutCarryOver;
      manutCarryOver = 0;

      let manutHoras = rawManut;
      if (veicHorasMinDia > 0 && manutHoras > veicHorasMinDia) {
        manutCarryOver = Math.round((manutHoras - veicHorasMinDia) * 100) / 100;
        manutHoras = veicHorasMinDia;
      }

      const combustivelQtd = abastMap.get(`${selectedNorm}|${dayKey}`) || 0;
      const viagensDia = viagensMap.get(`${selectedNorm}|${dayKey}`) || 0;
      const precipMm = pluvioMap.get(dayKey) || 0;
      
      const autoDesconto = manutHoras > 0 ? Math.round(manutHoras * valorHT * 100) / 100 : 0;

      const manutResumo = manutInfo?.servico || '';
      let autoObs = manutResumo;
      const effectiveHorasMin = (isDiaUtil && hasData) ? veicHorasMinDia : 0;
      if (ht > 0 && ht < effectiveHorasMin) {
        const parts: string[] = [];
        if (manutResumo) parts.push(manutHoras > 0 ? `Manutenção: ${manutResumo} (${fmtNum(manutHoras, 2)}h)` : `Manutenção: ${manutResumo}`);
        else if (manutHoras > 0) parts.push(`Manutenção: ${fmtNum(manutHoras, 2)}h`);
        if (precipMm > 0) parts.push(`Chuva: ${fmtNum(precipMm, 1)}mm`);
        if (manutCarryOver > 0) parts.push(`Excedente: ${fmtNum(manutCarryOver, 2)}h → próx. dia`);
        autoObs = parts.join(' | ');
      }

      const row: MedicaoRow = {
        date: day, diaSemana,
        horInicial, horFinal, ht, horasTrabPagar, horasMinimas, horasMinPagar,
        viagens: viagensDia, manutencao: manutHoras, operador: 0, aDisposicao: 0,
        clima: precipMm, combustivelQtd, desconto: autoDesconto, observacao: autoObs,
      };
      
      totalHT += row.ht;
      totalHorasTrabPagar += row.horasTrabPagar;
      totalHorasMinimas += row.horasMinimas;
      totalHorasMinPagar += row.horasMinPagar;
      totalViagens += row.viagens;
      totalManut += row.manutencao;
      totalOperador += row.operador;
      totalDisposicao += row.aDisposicao;
      totalClima += row.clima;
      totalCombustivel += row.combustivelQtd;
      totalDesconto += row.desconto;
      
      rowsResult.push(row);
    }
    
    return {
      rows: rowsResult,
      totals: {
        ht: totalHT, horasTrabPagar: totalHorasTrabPagar, horasMinimas: totalHorasMinimas,
        horasMinPagar: totalHorasMinPagar, viagens: totalViagens, manutencao: totalManut,
        operador: totalOperador, aDisposicao: totalDisposicao, clima: totalClima,
        combustivel: totalCombustivel, desconto: totalDesconto,
        valorMedicao: Math.max(totalHorasTrabPagar, totalHorasMinPagar),
        valorHorasParadas: totalManut * valorHT,
      },
      equipInfo: eqInfo,
      vehicleUsesKm: usesKm,
      locacaoMensal: veicLocacao,
      horasMinDiaCalc: veicHorasMinDia,
      valorHoraMinDiaCalc: veicValorHoraMinDia,
    };
  }, [selectedMonth, records, allEquipment, manutMap, abastMap, pluvioMap, viagensMap, mobilizacaoMap, valorHT, horasMinDia, valorHoraMinDia, valorLocacaoMensal, diasUteis, medicaoAte]);

  // Build measurement rows for selected vehicle + month
  const { medicaoRows, totals, equipInfo, vehicleUsesKm } = useMemo(() => {
    if (!selectedVehicle || !selectedMonth) return { medicaoRows: [], totals: null, equipInfo: null, vehicleUsesKm: false };
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const endFull = endOfMonth(start);
    // Apply cutoff date if set and within the same month
    const end = medicaoAte && isSameMonth(medicaoAte, start) ? (medicaoAte < endFull ? medicaoAte : endFull) : endFull;
    const days = eachDayOfInterval({ start, end });
    
    const equipInfo = allEquipment.find(e => e.prefixo === selectedVehicle) || null;
    
    // Filter records for this vehicle - use normPrefixo for resilient matching
    const selectedNorm = normPrefixo(selectedVehicle);
    const vehicleRecords = records.filter(r => normPrefixo(r.veiculo) === selectedNorm);
    
    console.log(`[Medicao] Vehicle: ${selectedVehicle} → norm: "${selectedNorm}", matched records: ${vehicleRecords.length}/${records.length}`);
    
    // Build a map: date -> record
    const dateMap = new Map<string, any>();
    vehicleRecords.forEach(r => {
      if (r.dateParsed) {
        const key = format(r.dateParsed, 'yyyy-MM-dd');
        dateMap.set(key, r);
      }
    });

    // Detect if this vehicle uses KM instead of horímetro
    const usesKm = vehicleRecords.some(r => r.isKm === true);

    let totalHT = 0, totalHorasTrabPagar = 0, totalHorasMinimas = 0, totalHorasMinPagar = 0;
    let totalManut = 0, totalOperador = 0, totalDisposicao = 0, totalClima = 0;
    let totalCombustivel = 0, totalDesconto = 0, totalViagens = 0;

    // First pass: collect raw maintenance hours per day
    let manutCarryOver = 0; // hours carried from previous day
    const rows: MedicaoRow[] = [];

    for (const day of days) {
      const dayKey = format(day, 'yyyy-MM-dd');
      const rec = dateMap.get(dayKey);
      const edited = editedRows.get(dayKey);
      const diaSemana = DIAS_SEMANA[getDay(day)];
      const isDomingo = getDay(day) === 0;
      
      const horInicial = rec ? rec.horAnterior : 0;
      const horFinal = rec ? rec.horAtual : 0;
      const ht = (horFinal > horInicial) ? Math.round((horFinal - horInicial) * 100) / 100 : 0;
      
      const horasTrabPagar = ht > 0 ? Math.round(ht * valorHT * 100) / 100 : 0;
      
      const hasData = horFinal > 0;
      const isDiaUtil = diasUteis.has(dayKey);
      const horasMinimas = (isDiaUtil && hasData) ? horasMinDia : 0;
      const horasMinPagar = (isDiaUtil && hasData) ? valorHoraMinDia : 0;
      
      // Raw maintenance from map + carry-over from previous day
      const manutInfo = manutMap.get(`${selectedNorm}|${dayKey}`);
      let rawManut = (manutInfo && !isDomingo) ? parseBRNum(manutInfo.horasParado) : 0;
      rawManut += manutCarryOver;
      manutCarryOver = 0;

      // Cap maintenance at horasMinDia; excess carries to next day
      let manutHoras = rawManut;
      if (horasMinDia > 0 && manutHoras > horasMinDia) {
        manutCarryOver = Math.round((manutHoras - horasMinDia) * 100) / 100;
        manutHoras = horasMinDia;
      }
      
      const combustivelQtd = abastMap.get(`${selectedNorm}|${dayKey}`) || 0;
      const viagensDia = viagensMap.get(`${selectedNorm}|${dayKey}`) || 0;
      const precipMm = pluvioMap.get(dayKey) || 0;
      
      // Auto-calculate desconto = manutHoras * valorHT
      const autoDesconto = manutHoras > 0 ? Math.round(manutHoras * valorHT * 100) / 100 : 0;

      const manutResumo = manutInfo?.servico || '';
      let autoObs = manutResumo;
      const effectiveHorasMin = (isDiaUtil && hasData) ? horasMinDia : 0;
      if (ht > 0 && ht < effectiveHorasMin) {
        const parts: string[] = [];
        if (manutResumo) {
          parts.push(manutHoras > 0 ? `Manutenção: ${manutResumo} (${fmtNum(manutHoras, 2)}h)` : `Manutenção: ${manutResumo}`);
        } else if (manutHoras > 0) {
          parts.push(`Manutenção: ${fmtNum(manutHoras, 2)}h`);
        }
        if (precipMm > 0) {
          parts.push(`Chuva: ${fmtNum(precipMm, 1)}mm`);
        }
        if (manutCarryOver > 0) {
          parts.push(`Excedente: ${fmtNum(manutCarryOver, 2)}h → próx. dia`);
        }
        autoObs = parts.join(' | ');
      }

      const row: MedicaoRow = {
        date: day,
        diaSemana,
        horInicial: edited?.horInicial ?? horInicial,
        horFinal: edited?.horFinal ?? horFinal,
        ht: edited?.ht ?? ht,
        horasTrabPagar: edited?.horasTrabPagar ?? horasTrabPagar,
        horasMinimas: edited?.horasMinimas ?? horasMinimas,
        horasMinPagar: edited?.horasMinPagar ?? horasMinPagar,
        viagens: edited?.viagens ?? viagensDia,
        manutencao: edited?.manutencao ?? manutHoras,
        operador: edited?.operador ?? 0,
        aDisposicao: edited?.aDisposicao ?? 0,
        clima: edited?.clima ?? precipMm,
        combustivelQtd: edited?.combustivelQtd ?? combustivelQtd,
        desconto: edited?.desconto ?? autoDesconto,
        observacao: edited?.observacao ?? autoObs,
        isEdited: !!edited,
      };
      
      totalHT += row.ht;
      totalHorasTrabPagar += row.horasTrabPagar;
      totalHorasMinimas += row.horasMinimas;
      totalHorasMinPagar += row.horasMinPagar;
      totalViagens += row.viagens;
      totalManut += row.manutencao;
      totalOperador += row.operador;
      totalDisposicao += row.aDisposicao;
      totalClima += row.clima;
      totalCombustivel += row.combustivelQtd;
      totalDesconto += row.desconto;
      
      rows.push(row);
    }
    
    return {
      medicaoRows: rows,
      totals: {
        ht: totalHT,
        horasTrabPagar: totalHorasTrabPagar,
        horasMinimas: totalHorasMinimas,
        horasMinPagar: totalHorasMinPagar,
        viagens: totalViagens,
        manutencao: totalManut,
        operador: totalOperador,
        aDisposicao: totalDisposicao,
        clima: totalClima,
        combustivel: totalCombustivel,
        desconto: totalDesconto,
        valorMedicao: Math.max(totalHorasTrabPagar, totalHorasMinPagar),
        valorHorasParadas: totalManut * valorHT,
      },
      equipInfo,
      vehicleUsesKm: usesKm,
    };
  }, [selectedVehicle, selectedMonth, records, allEquipment, manutMap, abastMap, pluvioMap, viagensMap, editedRows, valorHT, horasMinDia, valorHoraMinDia, diasUteis, medicaoAte]);

  // Multi-mode: compute rows for all selected vehicles
  const multiVehicleData = useMemo(() => {
    if (!multiMode || selectedVehicles.size === 0) return [];
    return Array.from(selectedVehicles).map(prefixo => {
      const result = buildVehicleRows(prefixo);
      return { prefixo, ...result };
    }).filter(d => d.rows.length > 0);
  }, [multiMode, selectedVehicles, buildVehicleRows]);

  // Available tipos for multi-mode filter
  const availableTipos = useMemo(() => {
    const tipos = new Set<string>();
    filteredEquipment.forEach(eq => { if (eq.tipo) tipos.add(eq.tipo); });
    return Array.from(tipos).sort();
  }, [filteredEquipment]);

  const toggleTipoSelection = useCallback((tipo: string) => {
    const veicsOfTipo = filteredEquipment.filter(eq => eq.tipo === tipo).map(eq => eq.prefixo);
    setSelectedVehicles(prev => {
      const next = new Set(prev);
      const allSelected = veicsOfTipo.every(p => next.has(p));
      if (allSelected) veicsOfTipo.forEach(p => next.delete(p));
      else veicsOfTipo.forEach(p => next.add(p));
      return next;
    });
  }, [filteredEquipment]);

  const toggleVehicleSelection = useCallback((prefixo: string) => {
    setSelectedVehicles(prev => {
      const next = new Set(prev);
      if (next.has(prefixo)) next.delete(prefixo);
      else next.add(prefixo);
      return next;
    });
  }, []);

  const handleEditCell = (dayKey: string, field: string, value: number | string) => {
    setEditedRows(prev => {
      const next = new Map(prev);
      const existing = next.get(dayKey) || {};
      next.set(dayKey, { ...existing, [field]: value });
      return next;
    });
  };

  const [isShorteningObs, setIsShorteningObs] = useState(false);

  const handleShortenObservations = async () => {
    const obsToShorten = medicaoRows
      .filter(r => r.observacao && r.observacao.trim().length > 0)
      .map(r => ({
        key: format(r.date, 'yyyy-MM-dd'),
        text: r.observacao,
      }));

    if (obsToShorten.length === 0) {
      toast.info('Nenhuma observação para resumir.');
      return;
    }

    setIsShorteningObs(true);
    try {
      const { data, error } = await supabase.functions.invoke('shorten-observations', {
        body: { observations: obsToShorten },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const results = data?.results as Array<{ key: string; shortened: string }>;
      if (results && results.length > 0) {
        setEditedRows(prev => {
          const next = new Map(prev);
          results.forEach(r => {
            const existing = next.get(r.key) || {};
            next.set(r.key, { ...existing, observacao: r.shortened });
          });
          return next;
        });
        toast.success(`${results.length} observações resumidas com IA!`);
      }
    } catch (err: any) {
      console.error('Shorten obs error:', err);
      toast.error(err.message || 'Erro ao resumir observações');
    } finally {
      setIsShorteningObs(false);
    }
  };

  
  const monthOptions = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = -6; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(format(d, 'yyyy-MM'));
    }
    return months;
  }, []);

  // Export XLSX
  const handleExportXLSX = () => {
    const headers = ['Data', 'Dia', vehicleUsesKm ? 'Km Inicial' : 'Hodômetro Inicial', vehicleUsesKm ? 'Km Final' : 'Hodômetro Final', vehicleUsesKm ? 'Km/Dia' : 'H.T.', 'Horas Trab. a Pagar', 'Horas Mínimas', 'Horas Mín. a Pagar', 'Manutenção', 'Operador', 'A Disposição', 'Clima', 'Combustível (L)', 'Observações'];
    const rows = medicaoRows.map(r => [
      format(r.date, 'dd/MM/yy'),
      r.diaSemana,
      r.horInicial || '-',
      r.horFinal || '-',
      r.ht || '-',
      r.horasTrabPagar || '-',
      r.horasMinimas || '-',
      r.horasMinPagar || '-',
      r.manutencao || '',
      r.operador || '',
      r.aDisposicao || '',
      r.clima || '',
      r.combustivelQtd || '',
      r.observacao || '',
    ]);
    
    // Add totals row
    if (totals) {
      rows.push([
        '', '', '', '',
        totals.ht, totals.horasTrabPagar, totals.horasMinimas, totals.horasMinPagar,
        totals.manutencao, totals.operador, totals.aDisposicao, totals.clima, totals.combustivel, ''
      ]);
      rows.push([]);
      rows.push(['', '', '', 'VALOR HORA TRABALHADA', '', fmtCurrency(totals.horasTrabPagar), '', 'VALOR MEDIÇÃO', '', fmtCurrency(totals.valorMedicao)]);
      rows.push(['', '', '', 'VALOR HORA MÍNIMA', '', fmtCurrency(totals.horasMinPagar)]);
    }

    // Header info
    const info = [
      ['CONTROLE DE HORÍMETRO E ABASTECIMENTO'],
      [],
      ['VALOR DA LOCAÇÃO', '', 'PROPRIETÁRIO:', equipInfo?.empresa || '', '', 'OBRA:', obraConfig.nome || ''],
      ['MENSAL', 'H.T.', 'EQUIPAMENTO:', `${equipInfo?.descricao || ''} - ${selectedVehicle}`, '', '', `PERÍODO: ${(() => { const [y,m] = selectedMonth.split('-').map(Number); return format(new Date(y,m-1,1), 'MM/yyyy'); })()}`],
      [fmtCurrency(valorLocacaoMensal), fmtCurrency(valorHT), 'OPERADOR:', equipInfo?.operador || ''],
      [],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...info, headers, ...rows]);
    ws['!cols'] = [12, 14, 14, 14, 8, 16, 14, 16, 12, 10, 12, 8, 30].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Medição');
    XLSX.writeFile(wb, `medicao_${selectedVehicle}_${selectedMonth}.xlsx`);
  };

  // Export PDF - Portrait, single page
  const handleExportPDF = async () => {
    if (!tableRef.current) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const A4_W = 297, A4_H = 210, MARGIN = 4;
      const CONTENT_W = A4_W - MARGIN * 2;

      // Header compact
      pdf.setFillColor(29, 53, 87);
      pdf.roundedRect(MARGIN, MARGIN, CONTENT_W, 18, 1.5, 1.5, 'F');

      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => resolve();
          logoImg.src = activeLogo;
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const logoH = 13;
          const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(MARGIN + 2, MARGIN + 2.5, logoW + 2, logoH, 1, 1, 'F');
          pdf.addImage(logoImg, 'PNG', MARGIN + 3, MARGIN + 2.5, logoW, logoH);
        }
      } catch { /* */ }

      const cx = CONTENT_W / 2 + MARGIN;
      pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 255, 255);
      pdf.text('CONTROLE DE HORÍMETRO E ABASTECIMENTO', cx, MARGIN + 7, { align: 'center' });
      
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(200, 210, 230);
      pdf.text(`${equipInfo?.descricao || ''} - ${selectedVehicle} | ${equipInfo?.empresa || ''} | ${(() => { const [y,m] = selectedMonth.split('-').map(Number); return format(new Date(y,m-1,1), 'MMMM yyyy', { locale: ptBR }); })()}${obraConfig.nome ? ` | Obra: ${obraConfig.nome}` : ''}`, cx, MARGIN + 12, { align: 'center' });

      // Config bar compact
      const cfgY = MARGIN + 20;
      pdf.setFillColor(240, 240, 240);
      pdf.roundedRect(MARGIN, cfgY, CONTENT_W, 6, 1, 1, 'F');
      pdf.setFontSize(5.5); pdf.setTextColor(60, 60, 60); pdf.setFont('helvetica', 'normal');
      pdf.text(`Locação: ${fmtCurrency(valorLocacaoMensal)}  |  H.T.: ${fmtCurrency(valorHT)}  |  Hrs Mín./dia: ${horasMinDia}  |  Vlr Hora Mín.: ${fmtCurrency(valorHoraMinDia)}`, cx, cfgY + 4, { align: 'center' });

      // Table - render at higher scale for quality, then fit to page
      const canvas = await html2canvas(tableRef.current, {
        scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 1500,
      });
      const imgData = canvas.toDataURL('image/png');
      const startY = cfgY + 8;
      const availH = A4_H - startY - MARGIN;
      const imgAspect = canvas.width / canvas.height;
      
      // Fit to available width and height - pick the smaller scale
      let finalW = CONTENT_W;
      let finalH = finalW / imgAspect;
      
      if (finalH > availH) {
        finalH = availH;
        finalW = finalH * imgAspect;
      }
      
      const offsetX = MARGIN + (CONTENT_W - finalW) / 2;
      pdf.addImage(imgData, 'PNG', offsetX, startY, finalW, finalH);

      pdf.save(`medicao_${selectedVehicle}_${selectedMonth}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenRascunhoTab = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const mesStart = new Date(y, m - 1, 1);
    const mesEnd = endOfMonth(mesStart);
    const monthLabel = format(mesStart, 'MMMM yyyy', { locale: ptBR });
    const periodoInicio = format(mesStart, 'dd/MM/yyyy');
    const periodoFim = format(mesEnd, 'dd/MM/yyyy');

    const v = (k: string) => visibleCols.has(k);
    const rowsHtml = medicaoRows.map(row => {
      const isDomingo = getDay(row.date) === 0;
      const isSabado = getDay(row.date) === 6;
      const hasData = row.horFinal > 0;
      const bgStyle = isDomingo ? 'background:#f3f4f6;' : isSabado ? 'background:#eff6ff;' : '';
      return `<tr style="${bgStyle}">
        ${v('data') ? `<td>${format(row.date, 'dd/MM/yy')}</td>` : ''}
        ${v('dia') ? `<td style="text-transform:capitalize">${row.diaSemana}</td>` : ''}
        ${v('horInicial') ? `<td class="num">${row.horInicial ? fmtNum(row.horInicial) : '-'}</td>` : ''}
        ${v('horFinal') ? `<td class="num">${row.horFinal ? fmtNum(row.horFinal) : '-'}</td>` : ''}
        ${v('ht') ? `<td class="num" style="font-weight:600">${isDomingo && !hasData ? '-' : (hasData ? row.ht.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-')}</td>` : ''}
        ${v('horasTrabPagar') ? `<td class="num">${row.horasTrabPagar > 0 ? fmtNum(row.horasTrabPagar, 2) : '-'}</td>` : ''}
        ${v('horasMinimas') ? `<td class="num">${row.horasMinimas > 0 ? fmtNum(row.horasMinimas, 2) : '-'}</td>` : ''}
        ${v('horasMinPagar') ? `<td class="num">${row.horasMinPagar > 0 ? fmtCurrency(row.horasMinPagar) : '-'}</td>` : ''}
        ${v('viagens') ? `<td class="num">${row.viagens > 0 ? row.viagens : ''}</td>` : ''}
        ${v('manutencao') ? `<td class="num">${row.manutencao > 0 ? fmtNum(row.manutencao, 2) : ''}</td>` : ''}
        ${v('operadorParada') ? `<td class="num">${row.operador > 0 ? fmtNum(row.operador, 2) : ''}</td>` : ''}
        ${v('aDisposicao') ? `<td class="num">${row.aDisposicao > 0 ? fmtNum(row.aDisposicao, 2) : ''}</td>` : ''}
        ${v('clima') ? `<td class="num">${row.clima > 0 ? fmtNum(row.clima, 1) + 'mm' : ''}</td>` : ''}
        ${v('qtdAbastecida') ? `<td class="num">${row.combustivelQtd > 0 ? fmtNum(row.combustivelQtd, 1) : ''}</td>` : ''}
        ${v('combustivel') ? `<td class="num">${row.combustivelQtd > 0 && row.ht > 0 ? fmtNum(row.combustivelQtd / row.ht, 1) : ''}</td>` : ''}
        ${v('desconto') ? `<td class="num">${row.desconto > 0 ? `<span style="color:#dc2626;font-weight:600">${fmtCurrency(row.desconto)}</span>` : ''}</td>` : ''}
        ${v('observacao') ? `<td class="obs-cell">${row.observacao || ''}</td>` : ''}
      </tr>`;
    }).join('');

    const firstColsCount = [v('data'), v('dia'), v('horInicial'), v('horFinal')].filter(Boolean).length;
    const diasTrabRascunho = medicaoRows.filter(r => r.ht > 0).length;
    const totalHorasMinTrabRasc = Math.round(diasTrabRascunho * horasMinDia * 100) / 100;
    const totalValorMinTrabRasc = Math.round(diasTrabRascunho * valorHoraMinDia * 100) / 100;

    const totalsHtml = totals ? `
      <tr style="background:#e8ecf1;font-weight:700;border-top:2px solid #1d3557">
        <td colspan="${firstColsCount}" style="text-align:center">TOTAIS</td>
        ${v('ht') ? `<td class="num">${fmtNum(totals.ht)}</td>` : ''}
        ${v('horasTrabPagar') ? `<td class="num">${fmtNum(totals.horasTrabPagar, 2)}</td>` : ''}
        ${v('horasMinimas') ? `<td class="num">${fmtNum(totals.horasMinimas, 2)}</td>` : ''}
        ${v('horasMinPagar') ? `<td class="num">${fmtCurrency(totals.horasMinPagar)}</td>` : ''}
        ${v('viagens') ? `<td class="num">${totals.viagens > 0 ? totals.viagens : '-'}</td>` : ''}
        ${v('manutencao') ? `<td class="num">${fmtNum(totals.manutencao, 2)}</td>` : ''}
        ${v('operadorParada') ? `<td class="num">${fmtNum(totals.operador, 2)}</td>` : ''}
        ${v('aDisposicao') ? `<td class="num">${fmtNum(totals.aDisposicao, 2)}</td>` : ''}
        ${v('clima') ? `<td class="num">${fmtNum(totals.clima, 1)}</td>` : ''}
        ${v('qtdAbastecida') ? `<td class="num">${totals.combustivel > 0 ? fmtNum(totals.combustivel, 1) : '-'}</td>` : ''}
        ${v('combustivel') ? `<td class="num">${totals.combustivel > 0 && totals.ht > 0 ? fmtNum(totals.combustivel / totals.ht, 1) : '-'}</td>` : ''}
        ${v('desconto') ? `<td class="num" style="color:#dc2626">${totals.desconto > 0 ? fmtCurrency(totals.desconto) : '-'}</td>` : ''}
        ${v('observacao') ? `<td class="obs-cell"></td>` : ''}
      </tr>
      ${!vehicleUsesKm ? `<tr style="background:#eff6ff;font-weight:700;">
        <td colspan="${firstColsCount}" style="text-align:center;color:#1d4ed8;font-size:10px;">TOTAL HORAS MÍN. TRABALHADAS</td>
        ${v('ht') ? `<td class="num" style="color:#1d4ed8">${fmtNum(totalHorasMinTrabRasc, 2)}</td>` : ''}
        ${v('horasTrabPagar') ? `<td class="num" style="color:#1d4ed8">${fmtCurrency(totalValorMinTrabRasc)}</td>` : ''}
        ${v('horasMinimas') ? `<td></td>` : ''}
        ${v('horasMinPagar') ? `<td></td>` : ''}
        ${v('viagens') ? `<td></td>` : ''}
        ${v('manutencao') ? `<td></td>` : ''}
        ${v('operadorParada') ? `<td></td>` : ''}
        ${v('aDisposicao') ? `<td></td>` : ''}
        ${v('clima') ? `<td></td>` : ''}
        ${v('qtdAbastecida') ? `<td></td>` : ''}
        ${v('combustivel') ? `<td></td>` : ''}
        ${v('desconto') ? `<td></td>` : ''}
        ${v('observacao') ? `<td class="obs-cell" style="font-size:9px;color:#888;font-style:italic;">${diasTrabRascunho} dias × ${fmtNum(horasMinDia, 2)}h</td>` : ''}
      </tr>` : ''}
    ` : '';

    const descontoTotal = (totals && aplicarDesconto) ? totals.valorHorasParadas + totals.desconto : 0;
    const totalAPagar = totals ? Math.max(0, totals.valorMedicao - descontoTotal) : 0;

    const valorMedicaoHtml = totals ? `
      <div style="display:flex;gap:6px;margin-top:8px;font-family:Arial,sans-serif;font-size:11px;">
        <!-- Resumo de Totais -->
        <div style="flex:1;border:1.5px solid #1d3557;border-radius:4px;padding:6px 10px;">
          <div style="font-weight:700;color:#1d3557;font-size:10px;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #ddd;padding-bottom:3px;">Resumo de Totais</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>Total Horas Trabalhadas</span><span style="font-weight:700">${fmtNum(totals.ht, 1)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>Total Combustível (L)</span><span style="font-weight:700">${fmtNum(totals.combustivel, 1)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>Consumo Médio (L/h)</span><span style="font-weight:700;color:#ea580c">${totals.ht > 0 ? fmtNum(totals.combustivel / totals.ht, 2) : '-'}</span></div>
          <div style="border-top:1px solid #ddd;margin-top:3px;padding-top:3px;display:flex;justify-content:space-between;"><span>Valor Hora Trabalhada</span><span style="font-weight:700;color:#2563eb">${fmtCurrency(totals.horasTrabPagar)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Valor Hora Mínima</span><span style="font-weight:700;color:#2563eb">${fmtCurrency(totals.horasMinPagar)}</span></div>
        </div>
        <!-- Descontos -->
        <div style="flex:1;border:1.5px solid #fca5a5;border-radius:4px;padding:6px 10px;">
          <div style="font-weight:700;color:#b91c1c;font-size:10px;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #fecaca;padding-bottom:3px;">Descontos (Horas Paradas)</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>Horas em Manutenção</span><span style="font-weight:700">${fmtNum(totals.manutencao, 1)}h</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>Horas Operador (Parada)</span><span style="font-weight:700">${fmtNum(totals.operador, 1)}h</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>Horas A Disposição</span><span style="font-weight:700">${fmtNum(totals.aDisposicao, 1)}h</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>Horas Clima</span><span style="font-weight:700">${fmtNum(totals.clima, 1)}h</span></div>
          <div style="border-top:1px solid #fecaca;margin-top:3px;padding-top:3px;display:flex;justify-content:space-between;"><span style="font-weight:600">Valor Horas Paradas (Manut.)</span><span style="font-weight:700;color:#dc2626">${fmtCurrency(totals.valorHorasParadas)}</span></div>
          <div style="font-size:9px;color:#888;font-style:italic;">(${fmtNum(totals.manutencao, 1)}h × ${fmtCurrency(valorHT)} = ${fmtCurrency(totals.valorHorasParadas)})</div>
          ${totals.desconto > 0 ? `<div style="border-top:1px solid #fecaca;margin-top:3px;padding-top:3px;display:flex;justify-content:space-between;"><span style="font-weight:600">Descontos Manuais</span><span style="font-weight:700;color:#dc2626">${fmtCurrency(totals.desconto)}</span></div>` : ''}
        </div>
        <!-- Total a Pagar -->
        <div style="flex:1;border:1.5px solid #6ee7b7;border-radius:4px;padding:6px 10px;background:#f0fdf4;">
          <div style="font-weight:700;color:#15803d;font-size:10px;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #bbf7d0;padding-bottom:3px;">Total a Pagar</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>Valor Medição</span><span style="font-weight:700">${fmtCurrency(totals.valorMedicao)}</span></div>
          ${aplicarDesconto ? `
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>(-) Desconto Horas Paradas</span><span style="font-weight:700;color:#dc2626">- ${fmtCurrency(totals.valorHorasParadas)}</span></div>
          ${totals.desconto > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span>(-) Descontos Manuais</span><span style="font-weight:700;color:#dc2626">- ${fmtCurrency(totals.desconto)}</span></div>` : ''}
          ` : `<div style="font-size:10px;color:#888;font-style:italic;margin:4px 0;">Descontos não aplicados</div>`}
          <div style="border-top:2px solid #6ee7b7;margin-top:3px;padding-top:4px;display:flex;justify-content:space-between;font-size:13px;"><span style="font-weight:700;color:#166534;">TOTAL A PAGAR</span><span style="font-weight:800;color:#15803d;">${fmtCurrency(totalAPagar)}</span></div>
        </div>
      </div>
    ` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Medição - ${selectedVehicle} - ${monthLabel}</title>
<style>
  @media print { @page { size: landscape; margin: 5mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; overflow-x:hidden; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; padding: 6px; background: #fff; color: #222; display:flex; flex-direction:column; min-height:100vh; }
  .content-wrapper { flex:1; display:flex; flex-direction:column; }
  .header-table { width:100%; border-collapse:collapse; margin-bottom:4px; table-layout:fixed; }
  .header-table td { border:1px solid #999; padding:3px 5px; font-size:10px; vertical-align:middle; overflow:hidden; text-overflow:ellipsis; }
  .header-table .title-cell { text-align:center; font-weight:700; font-size:13px; background:#f0f0f0; }
  .header-table .label { font-weight:700; font-size:9px; color:#555; }
  .header-table .value { font-weight:700; font-size:11px; }
  table.main { width:100%; border-collapse:collapse; margin-top:4px; table-layout:fixed; flex:1; }
  table.main th { background:#1d3557; color:#fff; font-size:9px; font-weight:700; padding:3px 3px; border:1px solid #1d3557; text-align:center; white-space:nowrap; overflow:hidden; }
  table.main td { border:1px solid #ccc; padding:2px 3px; font-size:10px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  table.main td.num { font-variant-numeric:tabular-nums; text-align:center; }
  table.main td.obs-cell { text-align:left; white-space:normal; word-wrap:break-word; overflow-wrap:break-word; font-size:9px; min-width:180px; line-height:1.3; }
  .print-btn { position:fixed; top:12px; right:12px; padding:8px 20px; background:#1d3557; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer; z-index:999; }
  .print-btn:hover { background:#2a4a7f; }
  @media print { .print-btn { display:none; } }
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Imprimir / PDF</button>

<table class="header-table">
  <tr>
    <td rowspan="3" style="width:60px;text-align:center;padding:4px">
      <img src="${activeLogo}" style="height:40px;max-width:80px;object-fit:contain" onerror="this.style.display='none'" />
    </td>
    <td colspan="5" class="title-cell">CONTROLE DE HORÍMETRO E ABASTECIMENTO</td>
    <td colspan="2">
      <span class="label">OBRA:</span><br/>
      <span class="value">${obraConfig.nome || '-'}</span>
    </td>
    <td>
      <span class="label">PERÍODO:</span><br/>
      <span class="value">${periodoInicio} à ${periodoFim}</span>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <span class="label">VALOR DA LOCAÇÃO</span>
    </td>
    <td colspan="3">
      <span class="label">PROPRIETÁRIO:</span> <span class="value">${equipInfo?.empresa || '-'}</span>
    </td>
    <td colspan="3" rowspan="2">
      <span class="label">OPERADOR:</span> <span class="value">${equipInfo?.operador || '-'}</span>
    </td>
  </tr>
  <tr>
    <td><span class="label">MENSAL</span><br/><span class="value">${fmtCurrency(valorLocacaoMensal)}</span></td>
    <td><span class="label">H.T.</span><br/><span class="value">${fmtCurrency(valorHT)}</span></td>
    <td colspan="3">
      <span class="label">EQUIPAMENTO:</span> <span class="value">${equipInfo?.descricao || '-'} - ${selectedVehicle}</span>
    </td>
  </tr>
</table>

<table class="main">
  <thead>
    <tr>
      ${v('data') ? '<th rowspan="2">DATA</th>' : ''}
      ${v('dia') ? '<th rowspan="2" style="min-width:80px"></th>' : ''}
      ${(v('horInicial') || v('horFinal')) ? `<th colspan="${[v('horInicial'), v('horFinal')].filter(Boolean).length}">CONTROLE DE HODÔMETRO</th>` : ''}
      ${v('ht') ? '<th rowspan="2">H.T.</th>' : ''}
      ${v('horasTrabPagar') ? '<th rowspan="2">HORAS<br/>TRABALHADAS<br/>A PAGAR</th>' : ''}
      ${v('horasMinimas') ? '<th rowspan="2">HORAS<br/>MÍNIMAS</th>' : ''}
      ${v('horasMinPagar') ? '<th rowspan="2">HORAS<br/>MÍNIMAS A<br/>PAGAR</th>' : ''}
      ${v('viagens') ? '<th rowspan="2">VIAGENS</th>' : ''}
      ${(() => { const pc = [v('manutencao'), v('operadorParada'), v('aDisposicao'), v('clima')].filter(Boolean).length; return pc > 0 ? `<th colspan="${pc}">HORAS DE PARALIZAÇÕES</th>` : ''; })()}
      ${v('qtdAbastecida') ? '<th rowspan="2">QTD.<br/>ABAST. (L)</th>' : ''}
      ${v('combustivel') ? '<th rowspan="2">CONS.<br/>(L/h)</th>' : ''}
      ${v('desconto') ? '<th rowspan="2">DESCONTO<br/>(R$)</th>' : ''}
      ${v('observacao') ? '<th rowspan="2" style="min-width:140px">OBSERVAÇÕES</th>' : ''}
    </tr>
    <tr>
      ${v('horInicial') ? '<th>INICIAL</th>' : ''}
      ${v('horFinal') ? '<th>FINAL</th>' : ''}
      ${v('manutencao') ? '<th>MANUTENÇÃO</th>' : ''}
      ${v('operadorParada') ? '<th>OPERADOR</th>' : ''}
      ${v('aDisposicao') ? '<th>A DISPOSIÇÃO</th>' : ''}
      ${v('clima') ? '<th>CLIMA</th>' : ''}
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
    ${totalsHtml}
  </tbody>
</table>

${valorMedicaoHtml}

</body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  if (isLoading && records.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Calculator className="w-4 h-4 text-primary" />
          Medição de Equipamentos
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={multiMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setMultiMode(!multiMode); setSelectedVehicles(new Set()); }}
            className="gap-1.5 h-8 text-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            {multiMode ? 'Individual' : 'Múltipla'}
          </Button>
          <Button variant="default" size="sm" onClick={handleOpenRascunhoTab} disabled={medicaoRows.length === 0} className="gap-1.5 h-8 text-xs bg-orange-500 hover:bg-orange-600">
            <FileText className="w-3.5 h-3.5" />
            Rascunho
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleShortenObservations}
            disabled={medicaoRows.length === 0 || isShorteningObs}
            className="gap-1.5 h-8 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"
          >
            {isShorteningObs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isShorteningObs ? 'Resumindo...' : 'Resumir Obs.'}
          </Button>
          <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={() => setEditMode(!editMode)} className="gap-1.5 h-8 text-xs">
            {editMode ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editMode ? 'Salvar' : 'Editar'}
          </Button>
          <div className="h-5 w-px bg-border mx-0.5" />
          <Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={medicaoRows.length === 0} className="gap-1 h-8 text-xs px-2">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-700 font-medium">XLSX</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={medicaoRows.length === 0 || isExporting} className="gap-1 h-8 text-xs px-2">
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" /> : <FileDown className="w-3.5 h-3.5 text-red-500" />}
            <span className="text-red-600 font-medium">PDF</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Popover open={colSettingsOpen} onOpenChange={setColSettingsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Colunas">
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Colunas Visíveis</p>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {MEDICAO_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={visibleCols.has(col.key)}
                      disabled={'alwaysVisible' in col && col.alwaysVisible}
                      onCheckedChange={() => toggleCol(col.key)}
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* ── Filtros + Seleção ── */}
      <Card className="shadow-sm">
        <CardContent className="p-3 space-y-3">
          {/* Empresa Tabs */}
          <Tabs value={selectedEmpresaTab} onValueChange={setSelectedEmpresaTab} className="w-full">
            <TabsList className="h-8">
              {EMPRESA_TABS.map(tab => {
                const count = allEquipment.filter(eq => matchEmpresaTab(eq.empresa, tab.key)).length;
                return (
                  <TabsTrigger key={tab.key} value={tab.key} className="text-[11px] gap-1 px-2.5 h-7">
                    {tab.label}
                    <span className="text-[10px] bg-muted px-1.5 rounded-full font-semibold">{count}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>

          {/* Equipamento + Período + Medição até — uma linha */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_160px] gap-2 items-end">
            <div className="space-y-0.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Equipamento</label>
              <Popover open={equipComboOpen} onOpenChange={setEquipComboOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={equipComboOpen} className="w-full h-9 text-sm justify-between font-normal">
                    {selectedVehicle
                      ? (() => { const eq = allEquipment.find(e => e.prefixo === selectedVehicle); return eq ? `${eq.prefixo} - ${eq.descricao} (${eq.empresa})` : selectedVehicle; })()
                      : 'Selecione o equipamento...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-0" align="start">
                  <Command filter={(value, search) => {
                    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    return norm(value).includes(norm(search)) ? 1 : 0;
                  }}>
                    <CommandInput placeholder="Prefixo, descrição ou empresa..." />
                    <CommandList className="max-h-[400px]">
                      <CommandEmpty>Nenhum equipamento encontrado.</CommandEmpty>
                      {Array.from(groupedEquipment.entries()).map(([tipo, equips]) => (
                        <CommandGroup key={tipo} heading={`${tipo} (${equips.length})`}>
                          {equips.map(eq => (
                            <CommandItem
                              key={eq.prefixo}
                              value={`${eq.prefixo} ${eq.descricao} ${eq.empresa} ${eq.tipo}`}
                              onSelect={() => { setSelectedVehicle(eq.prefixo); setEquipComboOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 flex-shrink-0", selectedVehicle === eq.prefixo ? "opacity-100" : "opacity-0")} />
                              <span className="font-mono text-xs font-semibold mr-1.5">{eq.prefixo}</span>
                              <span className="truncate text-sm">{eq.descricao}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">{eq.empresa}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Período</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => (
                    <SelectItem key={m} value={m}>
                      {(() => { const [y,mo] = m.split('-').map(Number); return format(new Date(y,mo-1,1), 'MMMM yyyy', { locale: ptBR }); })()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Medição até</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-9 text-sm justify-start text-left font-normal", !medicaoAte && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {medicaoAte ? format(medicaoAte, 'dd/MM/yyyy') : 'Mês inteiro'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={medicaoAte}
                    onSelect={(d) => setMedicaoAte(d || undefined)}
                    defaultMonth={(() => { const [y,m] = selectedMonth.split('-').map(Number); return new Date(y,m-1,1); })()}
                    disabled={(date) => {
                      const [y,m] = selectedMonth.split('-').map(Number);
                      const s = startOfMonth(new Date(y,m-1));
                      const e = endOfMonth(s);
                      return date < s || date > e;
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Configuração de Valores — grid compacto */}
          <div className="border border-border/50 rounded-lg p-2.5 bg-muted/20">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 items-end">
              <div className="space-y-0.5">
                <label className="text-[9px] font-medium text-muted-foreground uppercase">Locação Mensal</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={valorLocacaoMensal > 0 ? valorLocacaoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    if (raw === '') { setValorLocacaoMensal(0); return; }
                    setValorLocacaoMensal(parseInt(raw, 10) / 100);
                  }}
                  placeholder="0,00"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-medium text-muted-foreground uppercase">Valor H.T.</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={valorHT > 0 ? valorHT.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, '');
                    if (raw === '') { setValorHT(0); return; }
                    setValorHT(parseInt(raw, 10) / 100);
                  }}
                  placeholder="0,00"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-medium text-muted-foreground uppercase">Hrs Mín./Mês</label>
                <Input type="number" step="1" value={horasMinMes} onChange={e => setHorasMinMes(Number(e.target.value) || 0)} placeholder="200" className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-medium text-muted-foreground uppercase">Hrs Mín./Dia</label>
                <Input type="text" value={horasMinDia > 0 ? horasMinDia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} readOnly className="h-8 text-xs bg-muted/50 cursor-default" />
                <p className="text-[8px] text-muted-foreground/60">{horasMinMes}h ÷ {diasUteis.size}d</p>
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-medium text-muted-foreground uppercase">Vlr Hora Mín.</label>
                <Input type="text" value={valorHoraMinDia > 0 ? valorHoraMinDia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'} readOnly className="h-8 text-xs bg-muted/50 cursor-default" />
                <p className="text-[8px] text-muted-foreground/60">{fmtCurrency(valorLocacaoMensal)} ÷ {diasUteis.size}d</p>
              </div>

              {/* KPIs compactos */}
              {(() => {
                const diasTrabalhados = medicaoRows.filter(r => r.ht > 0).length;
                return (
                  <>
                    <div className="bg-primary/5 border border-primary/20 rounded-md px-2 py-1 text-center h-[52px] flex flex-col justify-center">
                      <div className="text-[8px] font-medium text-muted-foreground uppercase leading-tight">Dias Trab.</div>
                      <div className="text-lg font-bold text-primary tabular-nums leading-none">{diasTrabalhados}</div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1 text-center h-[52px] flex flex-col justify-center">
                      <div className="text-[8px] font-medium text-muted-foreground uppercase leading-tight">Dias no Mês</div>
                      <div className="text-lg font-bold text-blue-600 tabular-nums leading-none">{diasUteis.size}</div>
                    </div>
                  </>
                );
              })()}

              {/* Dias Úteis calendar trigger */}
              <Popover open={showCalendar} onOpenChange={setShowCalendar}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs w-full">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Dias Úteis
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        {(() => { const [y,m] = selectedMonth.split('-').map(Number); return format(new Date(y,m-1,1), 'MMMM yyyy', { locale: ptBR }); })()}
                      </span>
                      <span className="text-xs font-bold text-blue-600">{diasUteis.size} dias</span>
                    </div>
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                      {['D','S','T','Q','Q','S','S'].map((d, i) => (
                        <div key={i} className="text-[9px] font-bold text-muted-foreground w-8 h-5 flex items-center justify-center">{d}</div>
                      ))}
                      {(() => {
                        const [year, month] = selectedMonth.split('-').map(Number);
                        const start = startOfMonth(new Date(year, month - 1));
                        const end = endOfMonth(start);
                        const days = eachDayOfInterval({ start, end });
                        const firstDayOfWeek = getDay(start);
                        const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => (
                          <div key={`blank-${i}`} className="w-8 h-8" />
                        ));
                        const dayCells = days.map(day => {
                          const key = format(day, 'yyyy-MM-dd');
                          const isSelected = diasUteis.has(key);
                          const isDomingo = getDay(day) === 0;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                setDiasUteis(prev => {
                                  const next = new Set(prev);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  return next;
                                });
                              }}
                              className={cn(
                                'w-8 h-8 rounded text-xs font-medium transition-colors',
                                isSelected && 'bg-blue-600 text-white hover:bg-blue-700',
                                !isSelected && 'bg-muted/30 text-muted-foreground hover:bg-muted',
                                isDomingo && !isSelected && 'text-red-400',
                              )}
                            >
                              {format(day, 'd')}
                            </button>
                          );
                        });
                        return [...blanks, ...dayCells];
                      })()}
                    </div>
                    <div className="flex gap-1.5 pt-1 border-t">
                      <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => {
                        const [year, month] = selectedMonth.split('-').map(Number);
                        const start = startOfMonth(new Date(year, month - 1));
                        const end = endOfMonth(start);
                        const days = eachDayOfInterval({ start, end });
                        const weekdays = new Set<string>();
                        days.forEach(d => { if (getDay(d) !== 0) weekdays.add(format(d, 'yyyy-MM-dd')); });
                        setDiasUteis(weekdays);
                      }}>Seg-Sáb</Button>
                      <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => {
                        const [year, month] = selectedMonth.split('-').map(Number);
                        const start = startOfMonth(new Date(year, month - 1));
                        const end = endOfMonth(start);
                        const days = eachDayOfInterval({ start, end });
                        const weekdays = new Set<string>();
                        days.forEach(d => { const dow = getDay(d); if (dow >= 1 && dow <= 5) weekdays.add(format(d, 'yyyy-MM-dd')); });
                        setDiasUteis(weekdays);
                      }}>Seg-Sex</Button>
                      <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => {
                        const [year, month] = selectedMonth.split('-').map(Number);
                        const start = startOfMonth(new Date(year, month - 1));
                        const end = endOfMonth(start);
                        const days = eachDayOfInterval({ start, end });
                        setDiasUteis(new Set(days.map(d => format(d, 'yyyy-MM-dd'))));
                      }}>Todos</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Info bar — equipamento selecionado */}
          {equipInfo && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border/40 pt-2 text-[11px]">
              <div><span className="text-muted-foreground">Proprietário:</span> <span className="font-bold">{equipInfo.empresa}</span></div>
              <div><span className="text-muted-foreground">Equipamento:</span> <span className="font-bold">{equipInfo.descricao} - {selectedVehicle}</span></div>
              <div><span className="text-muted-foreground">Operador:</span> <span className="font-bold">{equipInfo.operador || '-'}</span></div>
              <div className="ml-auto"><span className="text-muted-foreground">Período:</span> <span className="font-bold">{(() => { const [y,m] = selectedMonth.split('-').map(Number); const s = new Date(y,m-1,1); return `${format(s,'dd/MM/yyyy')} à ${format(endOfMonth(s),'dd/MM/yyyy')}`; })()}</span></div>
            </div>
          )}
        </CardContent>
      </Card>

          {/* Table */}
          <div ref={tableRef}>
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-[#1d3557] hover:bg-[#1d3557]">
                  {(isColVisible('data') || isColVisible('dia')) && (
                    <TableHead colSpan={[isColVisible('data'), isColVisible('dia')].filter(Boolean).length} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1"></TableHead>
                  )}
                  {(isColVisible('horInicial') || isColVisible('horFinal')) && (
                    <TableHead colSpan={[isColVisible('horInicial'), isColVisible('horFinal')].filter(Boolean).length} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1">{vehicleUsesKm ? 'CONTROLE DE KM' : 'CONTROLE DE HODÔMETRO'}</TableHead>
                  )}
                  {isColVisible('ht') && <TableHead rowSpan={2} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1 align-bottom">{vehicleUsesKm ? 'KM/DIA' : 'H.T.'}</TableHead>}
                  {isColVisible('horasTrabPagar') && <TableHead rowSpan={2} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1 align-bottom">HORAS TRAB. A PAGAR</TableHead>}
                  {isColVisible('horasMinimas') && <TableHead rowSpan={2} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1 align-bottom">HORAS MÍNIMAS</TableHead>}
                  {isColVisible('horasMinPagar') && <TableHead rowSpan={2} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1 align-bottom">HORAS MÍN. A PAGAR</TableHead>}
                  {isColVisible('viagens') && <TableHead rowSpan={2} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1 align-bottom">VIAGENS</TableHead>}
                  {(() => {
                    const paraCols = ['manutencao', 'operadorParada', 'aDisposicao', 'clima'].filter(k => isColVisible(k));
                    return paraCols.length > 0 ? (
                      <TableHead colSpan={paraCols.length} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1">HORAS DE PARALIZAÇÕES</TableHead>
                    ) : null;
                  })()}
                  {isColVisible('qtdAbastecida') && <TableHead rowSpan={2} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1 align-bottom">QTD. ABAST. (L)</TableHead>}
                  {isColVisible('combustivel') && <TableHead rowSpan={2} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1 align-bottom">CONS. (L/h)</TableHead>}
                  {isColVisible('desconto') && <TableHead rowSpan={2} className="text-white text-[10px] font-bold text-center border-r border-white/20 py-1 align-bottom">DESCONTO (R$)</TableHead>}
                  {isColVisible('observacao') && <TableHead rowSpan={2} className="text-white text-[10px] font-bold text-center py-1 align-bottom">OBSERVAÇÕES</TableHead>}
                </TableRow>
                <TableRow className="bg-[#1d3557]/90 hover:bg-[#1d3557]/90">
                  {isColVisible('data') && <TableHead className="text-white/90 text-[9px] font-bold text-center border-r border-white/10 py-1 w-20">DATA</TableHead>}
                  {isColVisible('dia') && <TableHead className="text-white/90 text-[9px] font-bold text-center border-r border-white/10 py-1 w-24">DIA</TableHead>}
                  {isColVisible('horInicial') && <TableHead className="text-white/90 text-[9px] font-bold text-center border-r border-white/10 py-1">INICIAL</TableHead>}
                  {isColVisible('horFinal') && <TableHead className="text-white/90 text-[9px] font-bold text-center border-r border-white/10 py-1">FINAL</TableHead>}
                  {isColVisible('manutencao') && <TableHead className="text-white/90 text-[9px] font-bold text-center border-r border-white/10 py-1">MANUTENÇÃO</TableHead>}
                  {isColVisible('operadorParada') && <TableHead className="text-white/90 text-[9px] font-bold text-center border-r border-white/10 py-1">OPERADOR</TableHead>}
                  {isColVisible('aDisposicao') && <TableHead className="text-white/90 text-[9px] font-bold text-center border-r border-white/10 py-1">A DISPOSIÇÃO</TableHead>}
                  {isColVisible('clima') && <TableHead className="text-white/90 text-[9px] font-bold text-center border-r border-white/10 py-1">CLIMA</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicaoRows.map((row, idx) => {
                  const isDomingo = getDay(row.date) === 0;
                  const isSabado = getDay(row.date) === 6;
                  const dayKey = format(row.date, 'yyyy-MM-dd');
                  const hasData = row.horFinal > 0;
                  
                  return (
                    <TableRow key={dayKey} className={cn(
                      'hover:bg-muted/50',
                      isDomingo && 'bg-gray-100 dark:bg-gray-800/30',
                      isSabado && 'bg-blue-50/30 dark:bg-blue-900/10',
                      row.isEdited && 'bg-yellow-50 dark:bg-yellow-900/10',
                    )}>
                      {isColVisible('data') && <TableCell className="py-1 px-2 text-[11px] text-center whitespace-nowrap border-r border-border/30">{format(row.date, 'dd/MM/yy')}</TableCell>}
                      {isColVisible('dia') && <TableCell className="py-1 px-2 text-[11px] text-center whitespace-nowrap border-r border-border/30 capitalize">{row.diaSemana}</TableCell>}
                      {isColVisible('horInicial') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums border-r border-border/30">
                          {editMode ? <Input type="number" step="0.1" value={row.horInicial || ''} onChange={e => handleEditCell(dayKey, 'horInicial', Number(e.target.value))} className="h-6 w-20 text-[10px] text-center p-0.5 mx-auto" /> : (row.horInicial ? fmtNum(row.horInicial) : '-')}
                        </TableCell>
                      )}
                      {isColVisible('horFinal') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums border-r border-border/30">
                          {editMode ? <Input type="number" step="0.1" value={row.horFinal || ''} onChange={e => handleEditCell(dayKey, 'horFinal', Number(e.target.value))} className="h-6 w-20 text-[10px] text-center p-0.5 mx-auto" /> : (row.horFinal ? fmtNum(row.horFinal) : '-')}
                        </TableCell>
                      )}
                      {isColVisible('ht') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums font-semibold border-r border-border/30">
                          {editMode ? <Input type="number" step="0.1" value={row.ht || ''} onChange={e => handleEditCell(dayKey, 'ht', Number(e.target.value))} className="h-6 w-16 text-[10px] text-center p-0.5 mx-auto" /> : (isDomingo && !hasData ? '-' : (hasData ? row.ht.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-'))}
                        </TableCell>
                      )}
                      {isColVisible('horasTrabPagar') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums border-r border-border/30">
                          {editMode ? <Input type="number" step="0.01" value={row.horasTrabPagar || ''} onChange={e => handleEditCell(dayKey, 'horasTrabPagar', Number(e.target.value))} className="h-6 w-16 text-[10px] text-center p-0.5 mx-auto" /> : (row.horasTrabPagar > 0 ? fmtNum(row.horasTrabPagar, 0) : '-')}
                        </TableCell>
                      )}
                      {isColVisible('horasMinimas') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums border-r border-border/30">
                          {editMode ? <Input type="number" step="0.01" value={row.horasMinimas || ''} onChange={e => handleEditCell(dayKey, 'horasMinimas', Number(e.target.value))} className="h-6 w-16 text-[10px] text-center p-0.5 mx-auto" /> : (row.horasMinimas > 0 ? fmtNum(row.horasMinimas, 2) : '-')}
                        </TableCell>
                      )}
                      {isColVisible('horasMinPagar') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums border-r border-border/30">
                          {editMode ? <Input type="number" step="0.01" value={row.horasMinPagar || ''} onChange={e => handleEditCell(dayKey, 'horasMinPagar', Number(e.target.value))} className="h-6 w-16 text-[10px] text-center p-0.5 mx-auto" /> : (row.horasMinPagar > 0 ? fmtCurrency(row.horasMinPagar) : '-')}
                        </TableCell>
                      )}
                      {isColVisible('viagens') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums font-semibold border-r border-border/30 text-cyan-600">
                          {editMode ? <Input type="number" step="1" value={row.viagens || ''} onChange={e => handleEditCell(dayKey, 'viagens', Number(e.target.value))} className="h-6 w-14 text-[10px] text-center p-0.5 mx-auto" /> : (row.viagens > 0 ? row.viagens : '')}
                        </TableCell>
                      )}
                      {isColVisible('manutencao') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center border-r border-border/30">
                          {editMode ? <Input type="number" step="0.5" value={row.manutencao || ''} onChange={e => handleEditCell(dayKey, 'manutencao', Number(e.target.value))} className="h-6 w-16 text-[10px] text-center p-0.5 mx-auto" /> : (row.manutencao > 0 ? fmtNum(row.manutencao, 2) : '')}
                        </TableCell>
                      )}
                      {isColVisible('operadorParada') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center border-r border-border/30">
                          {editMode ? <Input type="number" step="0.5" value={row.operador || ''} onChange={e => handleEditCell(dayKey, 'operador', Number(e.target.value))} className="h-6 w-16 text-[10px] text-center p-0.5 mx-auto" /> : (row.operador > 0 ? fmtNum(row.operador, 2) : '')}
                        </TableCell>
                      )}
                      {isColVisible('aDisposicao') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center border-r border-border/30">
                          {editMode ? <Input type="number" step="0.5" value={row.aDisposicao || ''} onChange={e => handleEditCell(dayKey, 'aDisposicao', Number(e.target.value))} className="h-6 w-16 text-[10px] text-center p-0.5 mx-auto" /> : (row.aDisposicao > 0 ? fmtNum(row.aDisposicao, 2) : '')}
                        </TableCell>
                      )}
                      {isColVisible('clima') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center border-r border-border/30">
                          {editMode ? <Input type="number" step="0.5" value={row.clima || ''} onChange={e => handleEditCell(dayKey, 'clima', Number(e.target.value))} className="h-6 w-16 text-[10px] text-center p-0.5 mx-auto" /> : (row.clima > 0 ? fmtNum(row.clima, 2) : '')}
                        </TableCell>
                      )}
                      {isColVisible('qtdAbastecida') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums font-medium border-r border-border/30 text-amber-600">
                          {editMode ? <Input type="number" step="0.1" value={row.combustivelQtd || ''} onChange={e => handleEditCell(dayKey, 'combustivelQtd', Number(e.target.value))} className="h-6 w-16 text-[10px] text-center p-0.5 mx-auto" /> : (row.combustivelQtd > 0 ? fmtNum(row.combustivelQtd, 1) : '')}
                        </TableCell>
                      )}
                      {isColVisible('combustivel') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums font-medium border-r border-border/30 text-orange-600">
                          {row.combustivelQtd > 0 && row.ht > 0 ? fmtNum(row.combustivelQtd / row.ht, 1) : (row.combustivelQtd > 0 ? fmtNum(row.combustivelQtd, 1) + 'L' : '')}
                        </TableCell>
                      )}
                      {isColVisible('desconto') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-center tabular-nums border-r border-border/30">
                          {editMode ? (
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={row.desconto > 0 ? row.desconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                              onChange={e => {
                                const raw = e.target.value.replace(/\D/g, '');
                                handleEditCell(dayKey, 'desconto', raw === '' ? 0 : parseInt(raw, 10) / 100);
                              }}
                              placeholder="0,00"
                              className="h-6 w-20 text-[10px] text-center p-0.5 mx-auto"
                            />
                          ) : (row.desconto > 0 ? <span className="text-red-600 font-semibold">{fmtCurrency(row.desconto)}</span> : '')}
                        </TableCell>
                      )}
                      {isColVisible('observacao') && (
                        <TableCell className="py-0.5 px-1 text-[11px] text-left">
                          {editMode ? <Input value={row.observacao} onChange={e => handleEditCell(dayKey, 'observacao', e.target.value)} className="h-6 text-[10px] p-0.5 min-w-[150px]" /> : <span className="whitespace-normal break-words text-left block text-[10px] leading-tight">{row.observacao || ''}</span>}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}

                {/* Totals row */}
                {totals && (
                  <>
                  <TableRow className="bg-[#1d3557]/10 hover:bg-[#1d3557]/10 font-bold border-t-2 border-[#1d3557]/30">
                    <TableCell colSpan={[isColVisible('data'), isColVisible('dia'), isColVisible('horInicial'), isColVisible('horFinal')].filter(Boolean).length || 1} className="py-1.5 px-2 text-[11px] text-center font-bold">TOTAIS</TableCell>
                    {isColVisible('ht') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums">{fmtNum(totals.ht)}</TableCell>}
                    {isColVisible('horasTrabPagar') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums">{fmtNum(totals.horasTrabPagar, 2)}</TableCell>}
                    {isColVisible('horasMinimas') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums">{fmtNum(totals.horasMinimas, 2)}</TableCell>}
                    {isColVisible('horasMinPagar') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums">{fmtCurrency(totals.horasMinPagar)}</TableCell>}
                    {isColVisible('viagens') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums text-cyan-600">{totals.viagens > 0 ? totals.viagens : '-'}</TableCell>}
                    {isColVisible('manutencao') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums">{fmtNum(totals.manutencao, 2)}</TableCell>}
                    {isColVisible('operadorParada') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums">{fmtNum(totals.operador, 2)}</TableCell>}
                    {isColVisible('aDisposicao') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums">{fmtNum(totals.aDisposicao, 2)}</TableCell>}
                    {isColVisible('clima') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums">{fmtNum(totals.clima, 2)}</TableCell>}
                    {isColVisible('qtdAbastecida') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums text-amber-600">{totals.combustivel > 0 ? fmtNum(totals.combustivel, 1) : '-'}</TableCell>}
                    {isColVisible('combustivel') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums text-orange-600">{totals.combustivel > 0 && totals.ht > 0 ? fmtNum(totals.combustivel / totals.ht, 1) : '-'}</TableCell>}
                    {isColVisible('desconto') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums text-red-600">{totals.desconto > 0 ? fmtCurrency(totals.desconto) : '-'}</TableCell>}
                    {isColVisible('observacao') && <TableCell></TableCell>}
                  </TableRow>
                  {/* Total Horas Mínimas Trabalhadas row - only for horímetro equipment */}
                  {!vehicleUsesKm && (() => {
                    const diasTrabalhados = medicaoRows.filter(r => r.ht > 0).length;
                    const totalHorasMinTrab = Math.round(diasTrabalhados * horasMinDia * 100) / 100;
                    const totalValorMinTrab = Math.round(diasTrabalhados * valorHoraMinDia * 100) / 100;
                    return (
                      <TableRow className="bg-blue-50/50 dark:bg-blue-950/10 hover:bg-blue-50/50 font-bold">
                        <TableCell colSpan={[isColVisible('data'), isColVisible('dia'), isColVisible('horInicial'), isColVisible('horFinal')].filter(Boolean).length || 1} className="py-1.5 px-2 text-[11px] text-center font-bold text-blue-700">TOTAL HORAS MÍN. TRABALHADAS</TableCell>
                        {isColVisible('ht') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums text-blue-700">{fmtNum(totalHorasMinTrab, 2)}</TableCell>}
                        {isColVisible('horasTrabPagar') && <TableCell className="py-1.5 px-2 text-[11px] text-center font-bold tabular-nums text-blue-700">{fmtCurrency(totalValorMinTrab)}</TableCell>}
                        {isColVisible('horasMinimas') && <TableCell></TableCell>}
                        {isColVisible('horasMinPagar') && <TableCell></TableCell>}
                        {isColVisible('viagens') && <TableCell></TableCell>}
                        {isColVisible('manutencao') && <TableCell></TableCell>}
                        {isColVisible('operadorParada') && <TableCell></TableCell>}
                        {isColVisible('aDisposicao') && <TableCell></TableCell>}
                        {isColVisible('clima') && <TableCell></TableCell>}
                        {isColVisible('qtdAbastecida') && <TableCell></TableCell>}
                        {isColVisible('combustivel') && <TableCell></TableCell>}
                        {isColVisible('desconto') && <TableCell></TableCell>}
                        {isColVisible('observacao') && <TableCell className="py-1.5 px-2 text-[9px] text-muted-foreground italic">{diasTrabalhados} dias × {fmtNum(horasMinDia, 2)}h</TableCell>}
                      </TableRow>
                    );
                  })()}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Resumo de Totais, Descontos e Total a Pagar */}
          {totals && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              {/* Toggle aplicar desconto */}
              <div className="md:col-span-3 flex items-center gap-2">
                <Switch checked={aplicarDesconto} onCheckedChange={setAplicarDesconto} id="aplicar-desconto" />
                <label htmlFor="aplicar-desconto" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Aplicar descontos (horas paradas) no cálculo final
                </label>
              </div>
              {/* Resumo de Totais */}
              <Card className="border-[#1d3557]/20">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-bold text-[#1d3557] uppercase">Resumo de Totais</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Total Horas Trabalhadas</span>
                    <span className="font-bold tabular-nums">{fmtNum(totals.ht, 1)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Total Combustível (L)</span>
                    <span className="font-bold tabular-nums">{fmtNum(totals.combustivel, 1)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Consumo Médio (L/h)</span>
                    <span className="font-bold tabular-nums text-orange-600">{totals.ht > 0 ? fmtNum(totals.combustivel / totals.ht, 2) : '-'}</span>
                  </div>
                  <div className="border-t pt-1.5 flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Valor Hora Trabalhada</span>
                    <span className="font-bold tabular-nums text-blue-600">{fmtCurrency(totals.horasTrabPagar)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Valor Hora Mínima</span>
                    <span className="font-bold tabular-nums text-blue-600">{fmtCurrency(totals.horasMinPagar)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Descontos (Horas Paradas) */}
              <Card className="border-red-200">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-bold text-red-700 uppercase">Descontos (Horas Paradas)</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Horas em Manutenção</span>
                    <span className="font-bold tabular-nums">{fmtNum(totals.manutencao, 1)}h</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Horas Operador (Parada)</span>
                    <span className="font-bold tabular-nums">{fmtNum(totals.operador, 1)}h</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Horas A Disposição</span>
                    <span className="font-bold tabular-nums">{fmtNum(totals.aDisposicao, 1)}h</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Horas Clima</span>
                    <span className="font-bold tabular-nums">{fmtNum(totals.clima, 1)}h</span>
                  </div>
                  <div className="border-t pt-1.5 flex justify-between text-[11px]">
                    <span className="text-muted-foreground font-semibold">Valor Horas Paradas (Manut.)</span>
                    <span className="font-bold tabular-nums text-red-600">{fmtCurrency(totals.valorHorasParadas)}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground italic">({fmtNum(totals.manutencao, 1)}h × {fmtCurrency(valorHT)} = {fmtCurrency(totals.valorHorasParadas)})</div>
                  {totals.desconto > 0 && (
                    <div className="border-t pt-1.5 flex justify-between text-[11px]">
                      <span className="text-muted-foreground font-semibold">Descontos Manuais</span>
                      <span className="font-bold tabular-nums text-red-600">{fmtCurrency(totals.desconto)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Total a Pagar */}
              <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/10">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-bold text-emerald-700 uppercase">Total a Pagar</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Valor Medição</span>
                    <span className="font-bold tabular-nums">{fmtCurrency(totals.valorMedicao)}</span>
                  </div>
                  {aplicarDesconto && (
                    <>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">(-) Desconto Horas Paradas</span>
                        <span className="font-bold tabular-nums text-red-600">- {fmtCurrency(totals.valorHorasParadas)}</span>
                      </div>
                      {totals.desconto > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">(-) Descontos Manuais</span>
                          <span className="font-bold tabular-nums text-red-600">- {fmtCurrency(totals.desconto)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {!aplicarDesconto && (
                    <div className="text-[10px] text-muted-foreground italic py-1">Descontos não aplicados</div>
                  )}
                  <div className="border-t-2 border-emerald-300 pt-2 flex justify-between text-sm">
                    <span className="font-bold text-emerald-800">TOTAL A PAGAR</span>
                    <span className="font-extrabold tabular-nums text-emerald-700 text-base">
                      {fmtCurrency(Math.max(0, totals.valorMedicao - (aplicarDesconto ? totals.valorHorasParadas + totals.desconto : 0)))}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

      {/* Multi-mode: Vehicle Selection + Stacked Tables */}
      {multiMode && (
        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Selecionar Equipamentos — Medição Múltipla
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {selectedVehicles.size} selecionado(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Quick select by tipo */}
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase self-center mr-1">Por Tipo:</span>
              {availableTipos.map(tipo => {
                const veicsOfTipo = filteredEquipment.filter(eq => eq.tipo === tipo);
                const selectedCount = veicsOfTipo.filter(eq => selectedVehicles.has(eq.prefixo)).length;
                const allSelected = selectedCount === veicsOfTipo.length;
                return (
                  <Button
                    key={tipo}
                    variant={allSelected ? 'default' : selectedCount > 0 ? 'secondary' : 'outline'}
                    size="sm"
                    className="text-xs h-7 gap-1"
                    onClick={() => toggleTipoSelection(tipo)}
                  >
                    {tipo}
                    <span className="text-[10px] bg-background/30 px-1 rounded">{selectedCount}/{veicsOfTipo.length}</span>
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setSelectedVehicles(new Set(filteredEquipment.map(eq => eq.prefixo)))}
              >Selecionar Todos</Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => setSelectedVehicles(new Set())}
              >Limpar</Button>
            </div>

            {/* Individual vehicle checkboxes grouped by tipo */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 max-h-[200px] overflow-y-auto border rounded-lg p-2">
              {Array.from(groupedEquipment.entries()).map(([tipo, equips]) => (
                <div key={tipo}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">{tipo}</p>
                  {equips.map(eq => (
                    <label key={eq.prefixo} className="flex items-center gap-1.5 text-[11px] cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                      <Checkbox
                        checked={selectedVehicles.has(eq.prefixo)}
                        onCheckedChange={() => toggleVehicleSelection(eq.prefixo)}
                      />
                      <span className="font-mono font-semibold">{eq.prefixo}</span>
                      <span className="truncate text-muted-foreground">{eq.descricao}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Multi-mode: Stacked measurement tables */}
      {multiMode && multiVehicleData.length > 0 && (
        <div className="space-y-4">
          {/* Config summary banner */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-2 px-4">
              <div className="flex flex-wrap gap-4 text-[11px]">
                <span>Valor H.T.: <strong>{fmtCurrency(valorHT)}</strong></span>
                <span>Horas Mín./Mês: <strong>{horasMinMes}h</strong></span>
                <span>Horas Mín./Dia: <strong>{fmtNum(horasMinDia, 2)}h</strong></span>
                <span>Dias Trab. no Mês: <strong>{diasUteis.size}</strong></span>
                <span>Desconto Horas Paradas: <strong>{aplicarDesconto ? 'Sim' : 'Não'}</strong></span>
              </div>
            </CardContent>
          </Card>

          {multiVehicleData.map(({ prefixo, rows, totals: vTotals, equipInfo: vEquip, vehicleUsesKm: vUsesKm, locacaoMensal, horasMinDiaCalc, valorHoraMinDiaCalc }) => {
            if (!vTotals) return null;
            const diasTrab = rows.filter(r => r.ht > 0).length;
            const totalHrsMinTrab = Math.round(diasTrab * horasMinDiaCalc * 100) / 100;
            const totalValMinTrab = Math.round(diasTrab * valorHoraMinDiaCalc * 100) / 100;
            const totalAPagar = Math.max(0, vTotals.valorMedicao - (aplicarDesconto ? vTotals.valorHorasParadas + vTotals.desconto : 0));
            return (
              <Card key={prefixo} className="border-primary/20 overflow-hidden">
                {/* Vehicle header with KPIs */}
                <CardHeader className="py-2 px-4 bg-[#1d3557] text-white">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-white">
                      <span className="font-mono font-bold">{prefixo}</span>
                      <span className="font-normal">{vEquip?.descricao}</span>
                      <span className="text-xs text-white/70">({vEquip?.empresa})</span>
                    </CardTitle>
                    <div className="flex gap-3 text-[10px] text-white/90">
                      <span>Locação: <strong>{fmtCurrency(locacaoMensal)}</strong></span>
                      <span>Hrs Mín/dia: <strong>{fmtNum(horasMinDiaCalc, 2)}</strong></span>
                      <span>Dias Trab: <strong>{diasTrab}/{diasUteis.size}</strong></span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-0 pb-0 pt-0">
                  <div className="overflow-auto">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="bg-[#1d3557]/80 hover:bg-[#1d3557]/80">
                        <TableHead className="text-white text-[9px] font-bold text-center py-1 w-16">DATA</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1 w-12">DIA</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1">{vUsesKm ? 'KM INI' : 'HOD INI'}</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1">{vUsesKm ? 'KM FIN' : 'HOD FIN'}</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1">{vUsesKm ? 'KM/DIA' : 'H.T.'}</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1">H.T. PAGAR</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1">HRS MÍN.</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1">HRS MÍN. PAGAR</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1">MANUT.</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1">DESC. R$</TableHead>
                        <TableHead className="text-white text-[9px] font-bold text-center py-1">OBS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, idx) => {
                        const isDomingo = getDay(row.date) === 0;
                        const isSabado = getDay(row.date) === 6;
                        const hasData = row.horFinal > 0;
                        return (
                          <TableRow key={idx} className={cn(
                            'hover:bg-muted/50',
                            isDomingo && 'bg-gray-100 dark:bg-gray-800/30',
                            isSabado && 'bg-blue-50/30 dark:bg-blue-900/10',
                          )}>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center">{format(row.date, 'dd/MM')}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center capitalize">{row.diaSemana.substring(0, 3)}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center tabular-nums">{row.horInicial ? fmtNum(row.horInicial) : '-'}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center tabular-nums">{row.horFinal ? fmtNum(row.horFinal) : '-'}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center tabular-nums font-semibold">{hasData ? fmtNum(row.ht, 1) : '-'}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center tabular-nums">{row.horasTrabPagar > 0 ? fmtCurrency(row.horasTrabPagar) : '-'}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center tabular-nums">{row.horasMinimas > 0 ? fmtNum(row.horasMinimas, 2) : '-'}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center tabular-nums">{row.horasMinPagar > 0 ? fmtCurrency(row.horasMinPagar) : '-'}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center">{row.manutencao > 0 ? fmtNum(row.manutencao, 2) : ''}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[10px] text-center tabular-nums text-red-600 font-semibold">{row.desconto > 0 ? fmtCurrency(row.desconto) : ''}</TableCell>
                            <TableCell className="py-0.5 px-1 text-[9px] text-left truncate max-w-[150px]">{row.observacao}</TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals */}
                      <TableRow className="bg-[#1d3557]/10 hover:bg-[#1d3557]/10 font-bold border-t-2 border-[#1d3557]/30">
                        <TableCell colSpan={4} className="py-1 px-2 text-[10px] text-center font-bold">TOTAIS</TableCell>
                        <TableCell className="py-1 px-2 text-[10px] text-center font-bold tabular-nums">{fmtNum(vTotals.ht, 1)}</TableCell>
                        <TableCell className="py-1 px-2 text-[10px] text-center font-bold tabular-nums">{fmtCurrency(vTotals.horasTrabPagar)}</TableCell>
                        <TableCell className="py-1 px-2 text-[10px] text-center font-bold tabular-nums">{fmtNum(vTotals.horasMinimas, 2)}</TableCell>
                        <TableCell className="py-1 px-2 text-[10px] text-center font-bold tabular-nums">{fmtCurrency(vTotals.horasMinPagar)}</TableCell>
                        <TableCell className="py-1 px-2 text-[10px] text-center font-bold tabular-nums">{fmtNum(vTotals.manutencao, 2)}</TableCell>
                        <TableCell className="py-1 px-2 text-[10px] text-center font-bold tabular-nums text-red-600">{vTotals.desconto > 0 ? fmtCurrency(vTotals.desconto) : '-'}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {/* Horas Mín Trabalhadas - only for horímetro equipment */}
                      {!vUsesKm && (
                      <TableRow className="bg-blue-50/50 dark:bg-blue-950/10 hover:bg-blue-50/50 font-bold">
                        <TableCell colSpan={4} className="py-1 px-2 text-[10px] text-center font-bold text-blue-700">TOTAL HRS MÍN. TRAB.</TableCell>
                        <TableCell className="py-1 px-2 text-[10px] text-center font-bold tabular-nums text-blue-700">{fmtNum(totalHrsMinTrab, 2)}</TableCell>
                        <TableCell className="py-1 px-2 text-[10px] text-center font-bold tabular-nums text-blue-700">{fmtCurrency(totalValMinTrab)}</TableCell>
                        <TableCell colSpan={5} className="py-1 px-2 text-[9px] text-muted-foreground italic">{diasTrab} dias × {fmtNum(horasMinDiaCalc, 2)}h</TableCell>
                      </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  </div>
                  {/* Summary cards inline */}
                  <div className="grid grid-cols-3 gap-2 p-3 border-t bg-muted/20">
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase">Valor Medição</p>
                      <p className="text-sm font-bold text-primary tabular-nums">{fmtCurrency(vTotals.valorMedicao)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase">Descontos</p>
                      <p className="text-sm font-bold text-red-600 tabular-nums">
                        {aplicarDesconto ? fmtCurrency(vTotals.valorHorasParadas + vTotals.desconto) : '-'}
                      </p>
                      {aplicarDesconto && <p className="text-[8px] text-muted-foreground">Hrs Paradas: {fmtCurrency(vTotals.valorHorasParadas)} + Manual: {fmtCurrency(vTotals.desconto)}</p>}
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted-foreground uppercase">Total a Pagar</p>
                      <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{fmtCurrency(totalAPagar)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Grand total */}
          {multiVehicleData.length > 1 && (
            <Card className="border-emerald-300 bg-emerald-50/30 dark:bg-emerald-900/10">
              <CardContent className="py-4 px-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <span className="font-bold text-emerald-800 text-sm">TOTAL GERAL — {multiVehicleData.length} equipamentos</span>
                  <div className="flex gap-6 text-sm flex-wrap">
                    <span>H.T. Total: <strong>{fmtNum(multiVehicleData.reduce((s, d) => s + (d.totals?.ht || 0), 0), 1)}</strong></span>
                    <span>Medição: <strong className="text-primary">{fmtCurrency(multiVehicleData.reduce((s, d) => s + (d.totals?.valorMedicao || 0), 0))}</strong></span>
                    {aplicarDesconto && (
                      <span>Descontos: <strong className="text-red-600">{fmtCurrency(multiVehicleData.reduce((s, d) => s + (d.totals?.valorHorasParadas || 0) + (d.totals?.desconto || 0), 0))}</strong></span>
                    )}
                    <span className="font-bold text-emerald-700 text-base">
                      A Pagar: {fmtCurrency(multiVehicleData.reduce((s, d) => {
                        const med = d.totals?.valorMedicao || 0;
                        const desc = aplicarDesconto ? (d.totals?.valorHorasParadas || 0) + (d.totals?.desconto || 0) : 0;
                        return s + Math.max(0, med - desc);
                      }, 0))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}
