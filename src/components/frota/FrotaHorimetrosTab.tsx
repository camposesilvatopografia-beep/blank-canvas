import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { format, parse, isValid, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, isAfter, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { Loader2, RefreshCw, Search, Clock, CalendarIcon, X, FileSpreadsheet, FileDown, Wrench, Truck, AlertTriangle, MessageCircle, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface HorimetroRecord {
  id: string;
  data: string;
  dateParsed: Date | null;
  veiculo: string;
  categoria: string;
  descricao: string;
  empresa: string;
  operador: string;
  horimetroAnterior: string;
  horimetroAtual: string;
  intervaloH: string;
  kmAnterior: string;
  kmAtual: string;
  totalKm: string;
  // Maintenance fields
  manutServico: string;
  manutDataEntrada: string;
  manutDataSaida: string;
  manutHoraEntrada: string;
  manutHoraSaida: string;
  manutHorasParado: string;
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

/** Parse Brazilian number format: dots as thousands, commas as decimal */
function parseBRNum(val: string | number | undefined | null): number {
  if (val == null || val === '') return NaN;
  const s = String(val).trim();
  if (!s) return NaN;
  if (s.includes('.') && s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  if (s.includes(',')) {
    return parseFloat(s.replace(',', '.'));
  }
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length >= 2 && parts[parts.length - 1].length === 3) {
      return parseFloat(s.replace(/\./g, ''));
    }
    return parseFloat(s);
  }
  return parseFloat(s);
}

export function FrotaHorimetrosTab() {
  const [records, setRecords] = useState<HorimetroRecord[]>([]);
  const [allEquipment, setAllEquipment] = useState<{ prefixo: string; descricao: string; empresa: string; tipo: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showManutModal, setShowManutModal] = useState(false);
  const [showFaltantesModal, setShowFaltantesModal] = useState(false);
  const [copiedFaltantes, setCopiedFaltantes] = useState(false);
  const [isExportingFaltantes, setIsExportingFaltantes] = useState(false);
  const [detailMonth, setDetailMonth] = useState(new Date().getMonth());
  const [detailYear, setDetailYear] = useState(new Date().getFullYear());
  const faltantesTableRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const { readSheet } = useGoogleSheets();
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, manutData, frotaGeralData] = await Promise.all([
        readSheet('Horimetros'),
        readSheet('Manutenções'),
        readSheet('Frota Geral'),
      ]);

      // --- Helper: find column with multiple synonyms (normalized) ---
      const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      const findCol = (headers: string[], ...synonyms: string[]) => {
        for (const syn of synonyms) {
          const idx = headers.findIndex(h => norm(h).includes(norm(syn)));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      // Parse Frota Geral to get all registered equipment
      const frotaMap = new Map<string, { descricao: string; empresa: string; tipo: string }>();
      if (frotaGeralData && frotaGeralData.length > 1) {
        const fHeaders = (frotaGeralData[0] as string[]).map(h => String(h || '').trim());
        const fPrefixoIdx = findCol(fHeaders, 'codigo', 'prefixo', 'cod');
        const fDescIdx = findCol(fHeaders, 'descricao', 'descri', 'equipamento');
        const fEmpresaIdx = findCol(fHeaders, 'empresa');
        const fTipoIdx = findCol(fHeaders, 'categoria', 'tipo');
        const fStatusIdx = findCol(fHeaders, 'status');

        console.log('[Horímetros] Frota Geral headers:', fHeaders);
        console.log('[Horímetros] Frota Geral indices:', { fPrefixoIdx, fDescIdx, fEmpresaIdx, fTipoIdx, fStatusIdx });

        const excludedEmpresas = ['obra saneamento', 'outros'];
        frotaGeralData.slice(1).forEach(row => {
          const prefixo = String(row[fPrefixoIdx] || '').trim();
          const status = String(row[fStatusIdx] || '').trim().toLowerCase();
          const empresa = String(row[fEmpresaIdx] || '').trim();
          if (!prefixo) return;
          // Keep ALL vehicles in the map (even desmobilizados) for reference matching
          const normP = norm(prefixo);
          if (!frotaMap.has(normP)) {
            frotaMap.set(normP, {
              descricao: String(row[fDescIdx] || '').trim(),
              empresa,
              tipo: String(row[fTipoIdx] || '').trim(),
            });
          }
        });

        // For the equipment list filter, only active ones
        const equips = frotaGeralData.slice(1)
          .filter(row => {
            const prefixo = String(row[fPrefixoIdx] || '').trim();
            const status = String(row[fStatusIdx] || '').trim().toLowerCase();
            const empresa = String(row[fEmpresaIdx] || '').trim().toLowerCase();
            return prefixo && status !== 'desmobilizado' && status !== 'inativo' && !excludedEmpresas.includes(empresa);
          })
          .map(row => ({
            prefixo: String(row[fPrefixoIdx] || '').trim(),
            descricao: String(row[fDescIdx] || '').trim(),
            empresa: String(row[fEmpresaIdx] || '').trim(),
            tipo: String(row[fTipoIdx] || '').trim(),
          }));
        setAllEquipment(equips);
        console.log('[Horímetros] Frota Geral loaded:', equips.length, 'equipamentos mobilizados. frotaMap total:', frotaMap.size);
      }

      // Parse maintenance data
      const manutMap = new Map<string, { servico: string; dataEntrada: string; dataSaida: string; horaEntrada: string; horaSaida: string; horasParado: string }>();
      if (manutData.length > 1) {
        const mHdrs = (manutData[0] as string[]).map(h => String(h || '').trim());
        const mVeiculoIdx = findCol(mHdrs, 'veiculo', 'prefixo', 'codigo', 'equipamento');
        const mServicoIdx = findCol(mHdrs, 'servico', 'servi', 'tipo_servico');
        const mDataEntradaIdx = findCol(mHdrs, 'data_entrada', 'data entrada', 'dt entrada', 'dataentrada');
        const mDataSaidaIdx = findCol(mHdrs, 'data_saida', 'data saida', 'data sa', 'datasaida');
        const mHoraEntradaIdx = findCol(mHdrs, 'hora_entrada', 'hora entrada', 'horaentrada');
        const mHoraSaidaIdx = findCol(mHdrs, 'hora_saida', 'hora saida', 'hora sa', 'horasaida');
        const mHorasParadoIdx = findCol(mHdrs, 'horas_parado', 'horas parado', 'horasparado', 'hrs parado');

        console.log('[Horímetros] Manutenções headers:', mHdrs);
        console.log('[Horímetros] Manutenções indices:', { mVeiculoIdx, mServicoIdx, mDataEntradaIdx, mDataSaidaIdx, mHoraEntradaIdx, mHoraSaidaIdx, mHorasParadoIdx });

        manutData.slice(1).forEach(row => {
          const veiculo = String(row[mVeiculoIdx] || '').trim();
          const dataEntrada = String(row[mDataEntradaIdx] || '').trim();
          if (!veiculo || !dataEntrada) return;
          const parsed = parseDate(dataEntrada);
          const dateKey = parsed ? format(parsed, 'dd/MM/yyyy') : dataEntrada;
          // Use normalized key for better matching
          const key = `${norm(veiculo)}|${dateKey}`;
          manutMap.set(key, {
            servico: String(row[mServicoIdx] || '').trim(),
            dataEntrada,
            dataSaida: mDataSaidaIdx >= 0 ? String(row[mDataSaidaIdx] || '').trim() : '',
            horaEntrada: mHoraEntradaIdx >= 0 ? String(row[mHoraEntradaIdx] || '').trim() : '',
            horaSaida: mHoraSaidaIdx >= 0 ? String(row[mHoraSaidaIdx] || '').trim() : '',
            horasParado: mHorasParadoIdx >= 0 ? String(row[mHorasParadoIdx] || '').trim() : '',
          });
        });
        console.log('[Horímetros] Manutenções map size:', manutMap.size);
      }

      if (data.length > 1) {
        const hdrs = (data[0] as string[]).map(h => String(h || '').trim());

        const idIdx = findCol(hdrs, 'id');
        const dataIdx = findCol(hdrs, 'data');
        const veiculoIdx = findCol(hdrs, 'veiculo', 'prefixo', 'codigo', 'equipamento');
        const categoriaIdx = findCol(hdrs, 'categoria', 'tipo');
        const descricaoIdx = findCol(hdrs, 'descricao', 'descri', 'equipamento');
        const empresaIdx = findCol(hdrs, 'empresa');
        const operadorIdx = findCol(hdrs, 'operador', 'motorista');
        let horAntIdx = findCol(hdrs, 'horimetro anterior', 'horimetroanterior', 'hor anterior', 'horimetro_anterior');
        if (horAntIdx < 0) horAntIdx = hdrs.findIndex(h => norm(h).includes('horimetro') && norm(h).includes('anterior'));
        let horAtualIdx = findCol(hdrs, 'horimetro atual', 'horimetroa tual', 'hor atual', 'horimetro_atual');
        if (horAtualIdx < 0) horAtualIdx = hdrs.findIndex(h => norm(h).includes('horimetro') && norm(h).includes('atual'));
        const intervaloIdx = findCol(hdrs, 'intervalo');
        let kmAntIdx = findCol(hdrs, 'km anterior', 'kmanterior', 'km_anterior');
        if (kmAntIdx < 0) kmAntIdx = hdrs.findIndex(h => norm(h).includes('km') && norm(h).includes('anterior'));
        let kmAtualIdx = findCol(hdrs, 'km atual', 'kmatual', 'km_atual');
        if (kmAtualIdx < 0) kmAtualIdx = hdrs.findIndex(h => norm(h).includes('km') && norm(h).includes('atual'));
        const totalKmIdx = findCol(hdrs, 'total km', 'totalkm', 'km total');

        console.log('[Horímetros] Headers:', hdrs);
        console.log('[Horímetros] Indices:', { idIdx, dataIdx, veiculoIdx, categoriaIdx, descricaoIdx, empresaIdx, operadorIdx, horAntIdx, horAtualIdx, kmAntIdx, kmAtualIdx });

        const parsed = data.slice(1)
          .filter(row => (veiculoIdx >= 0 && row[veiculoIdx]) || (idIdx >= 0 && row[idIdx]))
          .map(row => {
            const dataStr = row[dataIdx] || '';
            const horAnt = parseBRNum(row[horAntIdx]);
            const horAtual = parseBRNum(row[horAtualIdx]);
            const kmAnt = parseBRNum(row[kmAntIdx]);
            const kmAtual = parseBRNum(row[kmAtualIdx]);

            const intervalo = (!isNaN(horAtual) && !isNaN(horAnt) && horAtual >= horAnt)
              ? Math.round((horAtual - horAnt) * 100) / 100
              : NaN;
            const totalKm = (!isNaN(kmAtual) && !isNaN(kmAnt) && kmAtual >= kmAnt)
              ? Math.round((kmAtual - kmAnt) * 100) / 100
              : NaN;

            const veiculo = String(row[veiculoIdx] || '').trim();
            const dateParsed = parseDate(dataStr);
            const dateKey = dateParsed ? format(dateParsed, 'dd/MM/yyyy') : dataStr;
            const manutKey = `${norm(veiculo)}|${dateKey}`;
            const manut = manutMap.get(manutKey);

            // Enrich with Frota Geral data if fields are empty
            const frotaInfo = frotaMap.get(norm(veiculo));
            const descricao = String(row[descricaoIdx] || '').trim() || frotaInfo?.descricao || '';
            const empresa = String(row[empresaIdx] || '').trim() || frotaInfo?.empresa || '';
            const categoria = String(row[categoriaIdx] || '').trim() || frotaInfo?.tipo || '';

            return {
              id: idIdx >= 0 ? String(row[idIdx] || '') : '',
              data: dataStr,
              dateParsed,
              veiculo,
              categoria,
              descricao,
              empresa,
              operador: operadorIdx >= 0 ? String(row[operadorIdx] || '') : '',
              horimetroAnterior: horAntIdx >= 0 ? String(row[horAntIdx] || '') : '',
              horimetroAtual: horAtualIdx >= 0 ? String(row[horAtualIdx] || '') : '',
              intervaloH: !isNaN(intervalo) ? intervalo.toFixed(2).replace('.', ',') : '',
              kmAnterior: kmAntIdx >= 0 ? String(row[kmAntIdx] || '') : '',
              kmAtual: kmAtualIdx >= 0 ? String(row[kmAtualIdx] || '') : '',
              totalKm: !isNaN(totalKm) ? totalKm.toFixed(2).replace('.', ',') : '',
              manutServico: manut?.servico || '',
              manutDataEntrada: manut?.dataEntrada || '',
              manutDataSaida: manut?.dataSaida || '',
              manutHoraEntrada: manut?.horaEntrada || '',
              manutHoraSaida: manut?.horaSaida || '',
              manutHorasParado: manut?.horasParado || '',
            };
          });

        setRecords(parsed);
        console.log('[Horímetros] Total parsed records:', parsed.length);

        // Log orphan vehicles (in horímetros but not in frota)
        const orphans = new Set<string>();
        parsed.forEach(r => {
          if (r.veiculo && !frotaMap.has(norm(r.veiculo))) {
            orphans.add(r.veiculo);
          }
        });
        if (orphans.size > 0) {
          console.warn('[Horímetros] Veículos SEM correspondência na Frota Geral:', Array.from(orphans));
        }

        const dates = parsed.map(r => r.dateParsed).filter(Boolean) as Date[];
        if (dates.length > 0) {
          // Set to current month range by default
          const now = new Date();
          setDateFrom(startOfMonth(now));
          setDateTo(endOfMonth(now));
        }
      }
    } catch (error) {
      console.error('Error loading horímetros:', error);
    } finally {
      setIsLoading(false);
    }
  }, [readSheet]);

  useEffect(() => {
    loadData();
  }, []);

  // Unique vehicles list
  const vehicleOptions = useMemo(() => {
    const vehicles = Array.from(new Set(records.map(r => r.veiculo).filter(Boolean))).sort();
    return vehicles;
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Vehicle filter
      if (selectedVehicle && selectedVehicle !== 'all') {
        if (r.veiculo !== selectedVehicle) return false;
      }
      // Date filter
      if (dateFrom && r.dateParsed) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (r.dateParsed < from) return false;
      }
      if (dateTo && r.dateParsed) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (r.dateParsed > to) return false;
      }
      // Text filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          r.veiculo.toLowerCase().includes(term) ||
          r.descricao.toLowerCase().includes(term) ||
          r.empresa.toLowerCase().includes(term) ||
          r.operador.toLowerCase().includes(term) ||
          r.data.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [records, searchTerm, dateFrom, dateTo, selectedVehicle]);
  const horiSort = useTableSort(filteredRecords);

  const formatNumber = (val: string) => {
    if (!val) return '-';
    return val;
  };

  // ─── Maintenance KPI stats ───
  const manutStats = useMemo(() => {
    const withManut = filteredRecords.filter(r => r.manutServico);
    const uniqueVehicles = new Set(withManut.map(r => r.veiculo));
    const byVehicle = new Map<string, HorimetroRecord[]>();
    withManut.forEach(r => {
      if (!byVehicle.has(r.veiculo)) byVehicle.set(r.veiculo, []);
      byVehicle.get(r.veiculo)!.push(r);
    });
    return {
      totalRegistros: withManut.length,
      totalVeiculos: uniqueVehicles.size,
      byVehicle: Array.from(byVehicle.entries()).sort((a, b) => b[1].length - a[1].length),
    };
  }, [filteredRecords]);

  // ─── Total hours KPI: most recent horímetro minus initial per vehicle ───
  const totalHorasKpi = useMemo(() => {
    const vehicleMap = new Map<string, { min: number; max: number }>();
    filteredRecords.forEach(r => {
      const atual = parseBRNum(r.horimetroAtual);
      const anterior = parseBRNum(r.horimetroAnterior);
      if (isNaN(atual) && isNaN(anterior)) return;
      const vals = [atual, anterior].filter(v => !isNaN(v));
      if (vals.length === 0) return;
      const minVal = Math.min(...vals);
      const maxVal = Math.max(...vals);
      const existing = vehicleMap.get(r.veiculo);
      if (existing) {
        existing.min = Math.min(existing.min, minVal);
        existing.max = Math.max(existing.max, maxVal);
      } else {
        vehicleMap.set(r.veiculo, { min: minVal, max: maxVal });
      }
    });
    let total = 0;
    vehicleMap.forEach(({ min, max }) => { total += max - min; });
    return Math.round(total * 100) / 100;
  }, [filteredRecords]);

  const clearDates = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // ─── Duplicate detection: same vehicle on same date ───
  const { duplicateKeys, duplicateCount } = useMemo(() => {
    const countMap = new Map<string, number>();
    filteredRecords.forEach(r => {
      const key = `${r.veiculo}|${r.data}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });
    const dupes = new Set<string>();
    let count = 0;
    countMap.forEach((c, key) => {
      if (c > 1) { dupes.add(key); count += c; }
    });
    return { duplicateKeys: dupes, duplicateCount: count };
  }, [filteredRecords]);

  const getExportLabel = () => {
    const parts: string[] = [];
    if (selectedVehicle && selectedVehicle !== 'all') parts.push(selectedVehicle);
    if (dateFrom) parts.push(format(dateFrom, 'dd-MM-yyyy'));
    if (dateTo && dateTo !== dateFrom) parts.push(`a_${format(dateTo, 'dd-MM-yyyy')}`);
    return parts.length > 0 ? parts.join('_') : 'todos';
  };

  const handleExportXLSX = () => {
    const headers = ['Data', 'Veículo', 'Categoria', 'Descrição', 'Empresa', 'Operador', 'Hor. Anterior', 'Hor. Atual', 'Intervalo H', 'Km Anterior', 'Km Atual', 'Total Km', 'Serviço', 'Dt. Entrada', 'Dt. Saída', 'Hr. Entrada', 'Hr. Saída', 'Hrs Parado'];
    const rows = filteredRecords.map(r => [
      r.data,
      r.veiculo,
      r.categoria,
      r.descricao,
      r.empresa,
      r.operador,
      r.horimetroAnterior,
      r.horimetroAtual,
      r.intervaloH,
      r.kmAnterior,
      r.kmAtual,
      r.totalKm,
      r.manutServico,
      r.manutDataEntrada,
      r.manutDataSaida,
      r.manutHoraEntrada,
      r.manutHoraSaida,
      r.manutHorasParado,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [10, 16, 14, 20, 16, 16, 12, 12, 12, 12, 12, 12, 20, 12, 12, 10, 10, 10].map(w => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Horímetros');
    XLSX.writeFile(wb, `horimetros_${getExportLabel()}.xlsx`);
  };

  const handleExportPDF = async () => {
    if (!tableRef.current) return;
    setIsExporting(true);
    try {
      const A4_W = 297;
      const A4_H = 210;
      const MARGIN = 8;
      const CONTENT_W = A4_W - MARGIN * 2;
      const HEADER_H = 22;

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // --- Header ---
      pdf.setFillColor(29, 53, 87);
      pdf.roundedRect(MARGIN, MARGIN, CONTENT_W, HEADER_H, 2, 2, 'F');

      // Logo
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          logoImg.onload = () => resolve();
          logoImg.onerror = () => resolve();
          logoImg.src = activeLogo;
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const logoH = HEADER_H - 4;
          const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(MARGIN + 3, MARGIN + 2, logoW + 3, logoH, 1.5, 1.5, 'F');
          pdf.addImage(logoImg, 'PNG', MARGIN + 4.5, MARGIN + 2, logoW, logoH);
        }
      } catch { /* ignore */ }

      const textX = CONTENT_W / 2 + MARGIN;
      let textY = MARGIN + 7;
      if (obraConfig.nome) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        pdf.text(obraConfig.nome, textX, textY, { align: 'center' });
        textY += 4;
      }
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('HORÍMETROS / KM', textX, textY, { align: 'center' });
      textY += 4;

      const subtitleParts: string[] = [];
      if (selectedVehicle && selectedVehicle !== 'all') subtitleParts.push(selectedVehicle);
      if (dateFrom) subtitleParts.push(format(dateFrom, 'dd/MM/yyyy'));
      if (dateTo && format(dateTo, 'dd/MM/yyyy') !== format(dateFrom!, 'dd/MM/yyyy')) subtitleParts.push(`a ${format(dateTo, 'dd/MM/yyyy')}`);
      subtitleParts.push(`${filteredRecords.length} registros`);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(180, 195, 215);
      pdf.text(subtitleParts.join(' | '), textX, textY, { align: 'center' });

      // --- KPI summary bar ---
      const kpiY = MARGIN + HEADER_H + 2;
      const kpiH = 8;
      const kpiW = CONTENT_W / 3;
      const kpis = [
        { label: 'Registros', value: String(filteredRecords.length), bg: [29, 53, 87] },
        { label: 'Total Horas', value: `${totalHorasKpi.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}h`, bg: [59, 130, 246] },
        { label: 'Manutenção', value: String(manutStats.totalVeiculos), bg: [245, 158, 11] },
      ];
      kpis.forEach((kpi, i) => {
        const x = MARGIN + i * kpiW;
        pdf.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
        pdf.roundedRect(x + 0.5, kpiY, kpiW - 1, kpiH, 1.5, 1.5, 'F');
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(255, 255, 255);
        pdf.text(kpi.label, x + kpiW / 2, kpiY + 3, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(kpi.value, x + kpiW / 2, kpiY + 7, { align: 'center' });
      });

      // --- Table content ---
      const canvas = await html2canvas(tableRef.current, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1400,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgW = canvas.width / 2.5;
      const imgH = canvas.height / 2.5;
      const scaleFactor = CONTENT_W / imgW;
      const scaledH = imgH * scaleFactor;

      const startY = kpiY + kpiH + 2;
      const availH = A4_H - startY - MARGIN;

      if (scaledH <= availH) {
        pdf.addImage(imgData, 'PNG', MARGIN, startY, CONTENT_W, scaledH);
      } else {
        const rowsPerPage = Math.floor(availH / scaleFactor);
        const totalRows = imgH;
        let yOffset = 0;
        let isFirst = true;

        while (yOffset < totalRows) {
          const sliceH = Math.min(rowsPerPage, totalRows - yOffset);
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = sliceH * 2.5;
          const ctx = sliceCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, -(yOffset * 2.5));
          const sliceData = sliceCanvas.toDataURL('image/png');
          const sliceScaledH = sliceH * scaleFactor;

          if (!isFirst) {
            pdf.addPage();
            pdf.addImage(sliceData, 'PNG', MARGIN, MARGIN, CONTENT_W, sliceScaledH);
          } else {
            pdf.addImage(sliceData, 'PNG', MARGIN, startY, CONTENT_W, sliceScaledH);
            isFirst = false;
          }
          yOffset += sliceH;
        }
      }

      pdf.save(`horimetros_${getExportLabel()}.pdf`);
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
    } finally {
      setIsExporting(false);
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-2 px-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4 text-primary" />
          Horímetros ({filteredRecords.length})
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportXLSX} disabled={filteredRecords.length === 0} className="gap-1.5 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="text-emerald-700 font-medium">XLSX</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={filteredRecords.length === 0 || isExporting} className="gap-1.5 border-red-200 hover:bg-red-50 hover:border-red-300">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <FileDown className="w-4 h-4 text-red-500" />}
            <span className="text-red-600 font-medium">PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pt-0 pb-3">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Vehicle select */}
          <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
            <SelectTrigger className="w-full sm:w-52 h-9 text-sm">
              <SelectValue placeholder="Todos os veículos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os veículos</SelectItem>
              {vehicleOptions.map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Date range */}
          <div className="flex gap-1.5 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[136px] h-9 justify-start text-left font-normal text-sm", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1.5 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Data início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-xs">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[136px] h-9 justify-start text-left font-normal text-sm", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1.5 h-4 w-4" />
                  {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Data fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clearDates} title="Limpar datas">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {(searchTerm || selectedVehicle !== 'all' || dateFrom || dateTo) && (
            <Button variant="outline" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setSearchTerm(''); setSelectedVehicle('all'); clearDates(); }}>
              <X className="w-3.5 h-3.5 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
            <CardContent className="p-3">
              <p className="text-[10px] font-medium opacity-80">Total Registros</p>
              <p className="text-2xl font-bold">{filteredRecords.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 opacity-80" />
                <p className="text-[10px] font-medium opacity-80">Total de Horas</p>
              </div>
              <p className="text-2xl font-bold">{totalHorasKpi.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}h</p>
              <p className="text-[10px] opacity-70">Recente − Inicial</p>
            </CardContent>
          </Card>
          <Card
            className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 cursor-pointer hover:from-amber-600 hover:to-amber-700 transition-colors"
            onClick={() => manutStats.totalVeiculos > 0 && setShowManutModal(true)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 opacity-80" />
                <p className="text-[10px] font-medium opacity-80">Em Manutenção</p>
              </div>
              <p className="text-2xl font-bold">{manutStats.totalVeiculos}</p>
              <p className="text-[10px] opacity-70">{manutStats.totalRegistros} reg. • Detalhes</p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Detail Panel - when vehicle selected */}
        {selectedVehicle && selectedVehicle !== 'all' && (() => {
          const MESES_LABEL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
          const monthStart = startOfMonth(new Date(detailYear, detailMonth, 1));
          const monthEnd = endOfMonth(monthStart);
          const today = startOfDay(new Date());
          const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
          
          const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
          const selectedNorm = norm(selectedVehicle);
          
          // Build a map of date -> record for this vehicle
          const vehicleRecords = records.filter(r => norm(r.veiculo) === selectedNorm);
          const dateMap = new Map<string, typeof records[0]>();
          vehicleRecords.forEach(r => {
            if (r.dateParsed) {
              const key = format(r.dateParsed, 'yyyy-MM-dd');
              dateMap.set(key, r);
            }
          });
          
          const filledDays = daysInMonth.filter(d => !isAfter(d, today) && dateMap.has(format(d, 'yyyy-MM-dd'))).length;
          const pastDays = daysInMonth.filter(d => !isAfter(d, today) && getDay(d) !== 0).length; // exclude sundays
          const missingDays = pastDays - filledDays;
          
          const prevMonth = () => {
            if (detailMonth === 0) { setDetailMonth(11); setDetailYear(y => y - 1); }
            else setDetailMonth(m => m - 1);
          };
          const nextMonth = () => {
            if (detailMonth === 11) { setDetailMonth(0); setDetailYear(y => y + 1); }
            else setDetailMonth(m => m + 1);
          };
          
          return (
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-primary" />
                      Detalhamento Mensal — {selectedVehicle}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {filledDays} preenchido{filledDays !== 1 ? 's' : ''} · {missingDays > 0 ? <span className="text-destructive font-semibold">{missingDays} pendente{missingDays !== 1 ? 's' : ''}</span> : <span className="text-emerald-600 font-semibold">Completo</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={prevMonth}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-sm font-medium min-w-[130px] text-center">{MESES_LABEL[detailMonth]} {detailYear}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={nextMonth}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-[10px] font-bold w-10 text-center">Dia</TableHead>
                        <TableHead className="text-[10px] font-bold w-14">Sem.</TableHead>
                        <TableHead className="text-[10px] font-bold">Operador</TableHead>
                        <TableHead className="text-[10px] font-bold text-right">Hor. Ant.</TableHead>
                        <TableHead className="text-[10px] font-bold text-right">Hor. Atual</TableHead>
                        <TableHead className="text-[10px] font-bold text-right">Intervalo</TableHead>
                        <TableHead className="text-[10px] font-bold text-right">Km Ant.</TableHead>
                        <TableHead className="text-[10px] font-bold text-right">Km Atual</TableHead>
                        <TableHead className="text-[10px] font-bold text-right">Total Km</TableHead>
                        <TableHead className="text-[10px] font-bold text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daysInMonth.map((day, idx) => {
                        const key = format(day, 'yyyy-MM-dd');
                        const rec = dateMap.get(key);
                        const isFuture = isAfter(day, today);
                        const isSunday = getDay(day) === 0;
                        const isToday = isSameDay(day, today);
                        const isPending = !isFuture && !isSunday && !rec;
                        const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
                        
                        return (
                          <TableRow 
                            key={key} 
                            className={cn(
                              idx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                              isPending && 'bg-destructive/8',
                              isSunday && 'bg-muted/40 opacity-60',
                              isFuture && 'opacity-40',
                              isToday && 'ring-1 ring-inset ring-primary/30'
                            )}
                          >
                            <TableCell className="py-1 px-2 text-[11px] font-bold text-center tabular-nums">
                              {format(day, 'dd')}
                            </TableCell>
                            <TableCell className={cn("py-1 px-2 text-[10px]", isSunday && "text-destructive font-medium")}>
                              {DIAS_SEMANA[getDay(day)]}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-[11px]">
                              {rec?.operador || (isSunday ? '' : isFuture ? '' : '—')}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums">
                              {rec?.horimetroAnterior || ''}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums font-medium">
                              {rec?.horimetroAtual || ''}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums font-semibold text-foreground">
                              {rec?.intervaloH || ''}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums">
                              {rec?.kmAnterior || ''}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums font-medium">
                              {rec?.kmAtual || ''}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums font-semibold text-foreground">
                              {rec?.totalKm || ''}
                            </TableCell>
                            <TableCell className="py-1 px-2 text-center">
                              {isFuture ? (
                                <span className="text-[9px] text-muted-foreground">—</span>
                              ) : isSunday ? (
                                <span className="text-[9px] text-muted-foreground">Dom</span>
                              ) : rec ? (
                                <Badge className="text-[8px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20">
                                  ✓
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[8px] px-1.5 py-0 h-4">
                                  Pendente
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <div className="overflow-x-auto" ref={tableRef}>
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow className="bg-[#1d3557]/10 hover:bg-[#1d3557]/10 border-b-2 border-[#1d3557]/20">
                <TableHead className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] whitespace-nowrap w-10 text-center">Item</TableHead>
                <SortableTableHead sortKey="data" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] whitespace-nowrap">Data</SortableTableHead>
                <SortableTableHead sortKey="veiculo" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] whitespace-nowrap">Veículo</SortableTableHead>
                <SortableTableHead sortKey="descricao" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] whitespace-nowrap">Descrição</SortableTableHead>
                <SortableTableHead sortKey="empresa" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] whitespace-nowrap">Empresa</SortableTableHead>
                <SortableTableHead sortKey="operador" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] whitespace-nowrap">Operador</SortableTableHead>
                <SortableTableHead sortKey="horimetroAnterior" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] text-right whitespace-nowrap">Hor. Ant.</SortableTableHead>
                <SortableTableHead sortKey="horimetroAtual" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] text-right whitespace-nowrap">Hor. Atual</SortableTableHead>
                <SortableTableHead sortKey="intervaloH" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] text-right whitespace-nowrap">Interv. H</SortableTableHead>
                <SortableTableHead sortKey="kmAnterior" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] text-right whitespace-nowrap">Km Ant.</SortableTableHead>
                <SortableTableHead sortKey="kmAtual" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] text-right whitespace-nowrap">Km Atual</SortableTableHead>
                <SortableTableHead sortKey="totalKm" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-[#1d3557] text-right whitespace-nowrap">Total Km</SortableTableHead>
                <SortableTableHead sortKey="manutServico" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-amber-700 bg-amber-50/50 whitespace-nowrap">🔧 Serviço</SortableTableHead>
                <SortableTableHead sortKey="manutDataEntrada" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-amber-700 bg-amber-50/50 text-center whitespace-nowrap">Dt. Entr.</SortableTableHead>
                <SortableTableHead sortKey="manutDataSaida" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-amber-700 bg-amber-50/50 text-center whitespace-nowrap">Dt. Saída</SortableTableHead>
                <TableHead className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-amber-700 bg-amber-50/50 text-center whitespace-nowrap">Hr. Entr.</TableHead>
                <TableHead className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-amber-700 bg-amber-50/50 text-center whitespace-nowrap">Hr. Saída</TableHead>
                <SortableTableHead sortKey="manutHorasParado" sortConfig={horiSort.sortConfig} onSort={horiSort.requestSort} className="py-2 px-2 text-[10px] font-bold uppercase tracking-wider h-9 text-amber-700 bg-amber-50/50 text-center whitespace-nowrap">Hrs Parado</SortableTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {horiSort.sortedData.map((r, idx) => {
                const hasManut = !!r.manutServico;
                const isDuplicate = duplicateKeys.has(`${r.veiculo}|${r.data}`);
                return (
                <TableRow key={r.id || idx} className={cn(
                  idx % 2 === 0 ? 'bg-background' : 'bg-muted/30',
                  hasManut && 'border-l-4 border-l-amber-400',
                  isDuplicate && 'bg-rose-100 dark:bg-rose-900/30 border-l-4 border-l-rose-400'
                )}>
                  <TableCell className="py-1 px-2 text-[11px] font-bold text-center tabular-nums">{idx + 1}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] whitespace-nowrap">{r.data}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] font-semibold text-[#e76f51] whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {r.veiculo}
                      {isDuplicate && <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3.5 leading-none">DUP</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="py-1 px-2 text-[11px] max-w-[120px] truncate" title={r.descricao}>{r.descricao || '-'}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] whitespace-nowrap">{r.empresa || '-'}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] max-w-[100px] truncate" title={r.operador}>{r.operador || '-'}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums whitespace-nowrap">{formatNumber(r.horimetroAnterior)}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums whitespace-nowrap">{formatNumber(r.horimetroAtual)}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums font-semibold text-[#1d3557] whitespace-nowrap">{formatNumber(r.intervaloH)}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums whitespace-nowrap">{formatNumber(r.kmAnterior)}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums whitespace-nowrap">{formatNumber(r.kmAtual)}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-right tabular-nums font-semibold text-[#1d3557] whitespace-nowrap">{formatNumber(r.totalKm)}</TableCell>
                  <TableCell className={cn("py-1 px-2 text-[11px] max-w-[130px] truncate", hasManut && "text-amber-800 font-medium")} title={r.manutServico}>{r.manutServico || '-'}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-center whitespace-nowrap">{r.manutDataEntrada || '-'}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-center whitespace-nowrap">{r.manutDataSaida || '-'}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-center whitespace-nowrap">{r.manutHoraEntrada || '-'}</TableCell>
                  <TableCell className="py-1 px-2 text-[11px] text-center whitespace-nowrap">{r.manutHoraSaida || '-'}</TableCell>
                  <TableCell className={cn("py-1 px-2 text-[11px] text-center font-semibold whitespace-nowrap", r.manutHorasParado && r.manutHorasParado !== '0h' && r.manutHorasParado !== '-' ? 'text-red-600' : '')}>{r.manutHorasParado || '-'}</TableCell>
                </TableRow>
                );
              })}
              {filteredRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={18} className="text-center text-muted-foreground py-8">
                    Nenhum registro de horímetro encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filteredRecords.length > 500 && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Exibindo {filteredRecords.length} registros. Use os filtros para refinar.
            </p>
          )}
        </div>

        {/* Maintenance Detail Modal */}
        <Dialog open={showManutModal} onOpenChange={setShowManutModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-600" />
                Veículos em Manutenção ({manutStats.totalVeiculos})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {manutStats.byVehicle.map(([veiculo, items]) => (
                <Card key={veiculo} className="border-l-4 border-l-amber-400">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-primary">{veiculo}</span>
                      <Badge variant="secondary" className="text-xs">{items.length} registro(s)</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((item, i) => (
                        <div key={i} className="text-xs bg-muted/40 rounded p-2 grid grid-cols-2 gap-x-4 gap-y-1">
                          <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{item.data}</span></div>
                          <div><span className="text-muted-foreground">Serviço:</span> <span className="font-medium text-amber-800">{item.manutServico}</span></div>
                          <div><span className="text-muted-foreground">Entrada:</span> <span>{item.manutDataEntrada} {item.manutHoraEntrada}</span></div>
                          <div><span className="text-muted-foreground">Saída:</span> <span>{item.manutDataSaida} {item.manutHoraSaida}</span></div>
                          <div><span className="text-muted-foreground">Hrs Parado:</span> <span className="font-semibold text-destructive">{item.manutHorasParado || '-'}</span></div>
                          <div><span className="text-muted-foreground">Empresa:</span> <span>{item.empresa}</span></div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {manutStats.byVehicle.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Nenhum veículo com manutenção no período.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>



      </CardContent>
    </Card>
  );
}
