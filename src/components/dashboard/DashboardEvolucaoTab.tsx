import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, BarChart3, Grid3X3, Layers, MapPin, TrendingUp, CheckCircle2, Clock, Trash2, Pencil, Plane, PieChart, Activity, Ruler, Zap, Save, Eye, LayoutGrid, AlertTriangle, FileDown, MessageCircle, X, Loader2 } from 'lucide-react';
import { useReportHeaderConfig } from '@/hooks/useReportHeaderConfig';
import { useObraConfig } from '@/hooks/useObraConfig';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RPieChart, Pie, Legend } from 'recharts';


// ── Project Data (Aeroporto Maragogi) ──
interface Eixo {
  id: string;
  nome: string;
  estaca_inicial: number;
  comprimento: number;
  estaca_intervalo: number;
  faixas: number;
  faixa_largura: number;
  estaca_display_offset?: number;
}

const EIXOS: Eixo[] = [
  { id: 'ppd', nome: 'PPD (Pista)', estaca_inicial: -300, comprimento: 2460, estaca_intervalo: 20, faixas: 6, faixa_largura: 10, estaca_display_offset: 300 },
  { id: 'taxi_a', nome: 'TAXI A', estaca_inicial: 0, comprimento: 450.36, estaca_intervalo: 20, faixas: 4, faixa_largura: 10 },
  { id: 'taxi_b', nome: 'TAXI B', estaca_inicial: 0, comprimento: 450.36, estaca_intervalo: 20, faixas: 4, faixa_largura: 10 },
  { id: 'patio_aeronaves', nome: 'Pátio de Aeronaves', estaca_inicial: -80, comprimento: 412.20, estaca_intervalo: 20, faixas: 6, faixa_largura: 10, estaca_display_offset: 80 },
];

const getEixoEstacas = (eixo: Eixo) => {
  const totalEstacas = Math.ceil(eixo.comprimento / eixo.estaca_intervalo) + 1;
  return Array.from({ length: totalEstacas }, (_, i) => eixo.estaca_inicial + i);
};

const displayEstaca = (eixo: Eixo, estaca: number) => {
  const offset = eixo.estaca_display_offset || 0;
  return `E-${estaca + offset}`;
};

const getEixoCellArea = (eixo: Eixo) => eixo.estaca_intervalo * eixo.faixa_largura;

interface Camada {
  id: string;
  nome: string;
  espessura: number;
  totalCamadas: number;
  cor: string;
}

const CAMADAS: Camada[] = [
  { id: 'solo_local', nome: 'Solo Local', espessura: 0.20, totalCamadas: 3, cor: '#92400e' },
  { id: 'bgs', nome: 'BGS', espessura: 0.15, totalCamadas: 2, cor: '#1d4ed8' },
  { id: 'bgtc', nome: 'BGTC', espessura: 0.17, totalCamadas: 1, cor: '#059669' },
];

const ALL_LAYERS = CAMADAS.flatMap(c =>
  Array.from({ length: c.totalCamadas }, (_, i) => ({
    key: `${c.id}_${i + 1}`,
    label: c.totalCamadas > 1 ? `${c.nome} ${i + 1}` : c.nome,
    camada: c,
    numero: i + 1,
  }))
);

const TOTAL_LAYERS = ALL_LAYERS.length;

interface Execucao {
  id: string;
  estaca_inicio: number;
  estaca_fim: number;
  faixa: number;
  camada: string;
  camada_numero: number;
  data: string;
  area_executada: number;
  volume_executado: number;
  observacoes: string | null;
}

const STATUS_COLORS = {
  nao_iniciado: 'hsl(var(--muted))',
  em_andamento: 'hsl(45, 93%, 47%)',
  concluido: 'hsl(142, 71%, 45%)',
};

const formatNum = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export const DashboardEvolucaoTab = () => {
  const { toast } = useToast();
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEixo, setSelectedEixo] = useState(EIXOS[0].id);
  const [selectedCamada, setSelectedCamada] = useState(ALL_LAYERS[0].key);
  const [gridViewMode, setGridViewMode] = useState<'camada' | 'geral'>('geral');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showCellModal, setShowCellModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ estaca: number; faixa: number } | null>(null);
  const [editingExec, setEditingExec] = useState<Execucao | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [gridSelection, setGridSelection] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [savingGrid, setSavingGrid] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [kpiEixoFilter, setKpiEixoFilter] = useState<string>('ppd');
  const [selectedLayerDetails, setSelectedLayerDetails] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    estacaInicio: 0,
    estacaFim: 0,
    faixas: [] as number[],
    camadaKeys: [ALL_LAYERS[0].key] as string[],
    eixoId: EIXOS[0].id,
    data: new Date(),
    observacoes: '',
  });

  const toggleCamada = (key: string) => {
    setFormData(prev => ({
      ...prev,
      camadaKeys: prev.camadaKeys.includes(key)
        ? prev.camadaKeys.filter(k => k !== key)
        : [...prev.camadaKeys, key],
    }));
  };

  const eixo = useMemo(() => EIXOS.find(e => e.id === selectedEixo)!, [selectedEixo]);
  const estacas = useMemo(() => getEixoEstacas(eixo), [eixo]);
  const cellArea = useMemo(() => getEixoCellArea(eixo), [eixo]);
  const currentLayer = useMemo(() => ALL_LAYERS.find(l => l.key === selectedCamada)!, [selectedCamada]);

  // ── Load data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let allData: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await (supabase as any)
          .from('evolucao_obra_execucoes')
          .select('*')
          .order('data', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) {
          console.error(error);
          toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
          break;
        }
        allData = allData.concat(data || []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      setExecucoes(allData);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ──
  const execMap = useMemo(() => {
    const map = new Map<string, Execucao>();
    execucoes.forEach(e => {
      const key = `${e.estaca_inicio}_${e.faixa}_${e.camada}_${e.camada_numero}`;
      map.set(key, e);
    });
    return map;
  }, [execucoes]);

  const getCellStatus = useCallback((estaca: number, faixa: number) => {
    const key = `${estaca}_${faixa}_${currentLayer.camada.id}_${currentLayer.numero}`;
    const exec = execMap.get(key);
    if (!exec) return 'nao_iniciado';
    return exec.area_executada >= cellArea ? 'concluido' : 'em_andamento';
  }, [execMap, currentLayer, cellArea]);

  // Cell completion count for "geral" view: how many of 6 total layers are done
  const getCellLayerCount = useCallback((estaca: number, faixa: number) => {
    let done = 0;
    ALL_LAYERS.forEach(l => {
      const key = `${estaca}_${faixa}_${l.camada.id}_${l.numero}`;
      const exec = execMap.get(key);
      if (exec && exec.area_executada >= cellArea) done++;
    });
    return done;
  }, [execMap, cellArea]);

  // ── Per-eixo stats ──
  const eixoStats = useMemo(() => {
    return EIXOS.map(ex => {
      const eixoEstacas = getEixoEstacas(ex);
      const area = getEixoCellArea(ex);
      const totalCells = eixoEstacas.length * ex.faixas * TOTAL_LAYERS;
      const totalArea = totalCells * area;
      const minEst = eixoEstacas[0];
      const maxEst = eixoEstacas[eixoEstacas.length - 1];
      let doneCount = 0;
      let areaExec = 0;
      let volExec = 0;
      execucoes.forEach(e => {
        if (e.estaca_inicio >= minEst && e.estaca_inicio <= maxEst) {
          areaExec += e.area_executada;
          volExec += e.volume_executado;
          if (e.area_executada >= area) doneCount++;
        }
      });
      const pct = totalArea > 0 ? (areaExec / totalArea) * 100 : 0;
      return { ...ex, totalCells, totalArea: Math.round(totalArea), areaExec: Math.round(areaExec), volExec: Math.round(volExec * 10) / 10, pct: Math.round(pct * 10) / 10, doneCount, pendingCount: totalCells - doneCount };
    });
  }, [execucoes]);

  // ── Global stats ──
  const stats = useMemo(() => {
    let totalAreaExec = 0;
    let totalVolExec = 0;
    let totalAreaPrev = 0;
    let totalCellsAll = 0;

    const perLayer = new Map<string, { area: number; vol: number; total: number }>();
    ALL_LAYERS.forEach(l => perLayer.set(l.key, { area: 0, vol: 0, total: 0 }));

    EIXOS.forEach(ex => {
      const eixoEstacas = getEixoEstacas(ex);
      const area = getEixoCellArea(ex);
      const cellsPerEixo = eixoEstacas.length * ex.faixas;
      totalAreaPrev += cellsPerEixo * area * TOTAL_LAYERS;
      totalCellsAll += cellsPerEixo * TOTAL_LAYERS;
      ALL_LAYERS.forEach(l => {
        const cur = perLayer.get(l.key)!;
        cur.total += cellsPerEixo * area;
      });
    });

    execucoes.forEach(e => {
      totalAreaExec += e.area_executada;
      totalVolExec += e.volume_executado;
      const lk = `${e.camada}_${e.camada_numero}`;
      const cur = perLayer.get(lk);
      if (cur) { cur.area += e.area_executada; cur.vol += e.volume_executado; }
    });

    const completedCells = execucoes.filter(e => e.area_executada >= getEixoCellArea(EIXOS[0])).length;

    return { totalAreaExec, totalVolExec, totalAreaPrev, pctGeral: totalAreaPrev > 0 ? (totalAreaExec / totalAreaPrev) * 100 : 0, completedCells, pendingCells: totalCellsAll - completedCells, perLayer };
  }, [execucoes]);

  // ── Filtered stats (when clicking an eixo) ──
  const filteredStats = useMemo(() => {
    if (kpiEixoFilter === 'geral') return stats;
    const ex = EIXOS.find(e => e.id === kpiEixoFilter)!;
    const eixoEstacas = getEixoEstacas(ex);
    const area = getEixoCellArea(ex);
    const totalCellsEixo = eixoEstacas.length * ex.faixas;
    const totalAreaPrev = totalCellsEixo * area * TOTAL_LAYERS;
    let totalAreaExec = 0, totalVolExec = 0;
    const perLayer = new Map<string, { area: number; vol: number; total: number }>();
    ALL_LAYERS.forEach(l => perLayer.set(l.key, { area: 0, vol: 0, total: totalCellsEixo * area }));
    let completedCells = 0;
    const minEst = eixoEstacas[0];
    const maxEst = eixoEstacas[eixoEstacas.length - 1];
    execucoes.forEach(e => {
      if (e.estaca_inicio >= minEst && e.estaca_inicio <= maxEst) {
        totalAreaExec += e.area_executada;
        totalVolExec += e.volume_executado;
        const lk = `${e.camada}_${e.camada_numero}`;
        const cur = perLayer.get(lk);
        if (cur) { cur.area += e.area_executada; cur.vol += e.volume_executado; }
        if (e.area_executada >= area) completedCells++;
      }
    });
    const totalCellsAll = totalCellsEixo * TOTAL_LAYERS;
    return { totalAreaExec, totalVolExec, totalAreaPrev, pctGeral: totalAreaPrev > 0 ? (totalAreaExec / totalAreaPrev) * 100 : 0, completedCells, pendingCells: totalCellsAll - completedCells, perLayer };
  }, [kpiEixoFilter, execucoes, stats]);

  const kpiLabel = kpiEixoFilter === 'geral' ? 'Geral' : EIXOS.find(e => e.id === kpiEixoFilter)?.nome || 'Geral';

  // ── Export functions ──
  const generateWhatsAppSummary = () => {
    const s = filteredStats;
    const header = kpiEixoFilter ? `📊 *${EIXOS.find(e => e.id === kpiEixoFilter)?.nome}*` : '📊 *Evolução Geral - Aeroporto Maragogi*';
    let msg = `${header}\n📅 ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n\n`;
    msg += `✅ Progresso: *${formatNum(s.pctGeral)}%*\n`;
    msg += `📐 Área Exec: *${formatNum(s.totalAreaExec)} m²*\n`;
    msg += `📦 Volume Exec: *${formatNum(s.totalVolExec)} m³*\n`;
    msg += `🟢 Concluídas: *${s.completedCells}*\n`;
    msg += `🟡 Pendentes: *${s.pendingCells}*\n\n`;
    msg += `*Progresso por Eixo:*\n`;
    eixoStats.forEach(es => { msg += `  • ${es.nome}: *${es.pct}%* (${formatNum(es.areaExec)} m²)\n`; });
    msg += `\n*Progresso por Camada:*\n`;
    ALL_LAYERS.forEach(l => {
      const d = s.perLayer.get(l.key);
      const pct = d && d.total > 0 ? Math.round((d.area / d.total) * 1000) / 10 : 0;
      msg += `  • ${l.label}: *${pct}%*\n`;
    });
    return msg;
  };

  const handleWhatsAppExport = () => {
    const msg = generateWhatsAppSummary();
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handlePdfExport = async () => {
    toast({ title: 'Gerando PDF...' });
    try {
      const el = document.getElementById('evolucao-dashboard-content');
      if (!el) return;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      const imgW = pW - 20;
      const imgH = imgW / ratio;
      if (imgH > pH - 20) {
        const pages = Math.ceil(imgH / (pH - 20));
        for (let i = 0; i < pages; i++) {
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 10, 10 - i * (pH - 20), imgW, imgH);
        }
      } else {
        pdf.addImage(imgData, 'JPEG', 10, 10, imgW, imgH);
      }
      pdf.save(`Evolucao_Obra_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast({ title: 'PDF exportado com sucesso!' });
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
    }
  };

  const chartDataCamadas = useMemo(() => [...ALL_LAYERS].reverse().map(l => {
    const d = filteredStats.perLayer.get(l.key);
    const pct = d && d.total > 0 ? (d.area / d.total) * 100 : 0;
    return { layerKey: l.key, name: l.label, pct: Math.round(pct * 10) / 10, fill: l.camada.cor, areaExec: Math.round(d?.area || 0), volExec: Math.round((d?.vol || 0) * 10) / 10, areaTotal: Math.round(d?.total || 0), cor: l.camada.cor };
  }), [filteredStats]);

  // ── Detailed per-eixo per-camada breakdown ──
  const detailedEixoCamada = useMemo(() => {
    return EIXOS.map(ex => {
      const eixoEstacas = getEixoEstacas(ex);
      const area = getEixoCellArea(ex);
      const layers = ALL_LAYERS.map(l => {
        let doneCount = 0;
        let firstDone = -1;
        let lastDone = -1;
        const faixasDone = new Set<number>();
        
        eixoEstacas.forEach(est => {
          for (let f = 1; f <= ex.faixas; f++) {
            const key = `${est}_${f}_${l.camada.id}_${l.numero}`;
            const exec = execMap.get(key);
            if (exec && exec.area_executada >= area) {
              doneCount++;
              faixasDone.add(f);
              if (firstDone === -1) firstDone = est;
              lastDone = est;
            }
          }
        });
        
        const totalCells = eixoEstacas.length * ex.faixas;
        const pct = totalCells > 0 ? (doneCount / totalCells) * 100 : 0;
        const larguraExec = faixasDone.size * ex.faixa_largura;
        const comprimentoExec = firstDone >= 0 ? ((lastDone - firstDone) + 1) * ex.estaca_intervalo : 0;
        
        return {
          layer: l,
          doneCount,
          totalCells,
          pct: Math.round(pct * 10) / 10,
          areaExec: doneCount * area,
          volExec: doneCount * area * l.camada.espessura,
          firstDone: firstDone >= 0 ? displayEstaca(ex, firstDone) : '-',
          lastDone: lastDone >= 0 ? displayEstaca(ex, lastDone) : '-',
          larguraExec,
          comprimentoExec,
          faixasDone: Array.from(faixasDone).sort((a, b) => a - b),
        };
      });
      return { eixo: ex, layers };
    });
  }, [execMap, cellArea]);

  const chartDataEixos = useMemo(() => {
    return eixoStats.map(es => ({
      id: es.id,
      name: es.nome,
      pct: es.pct,
      concluidas: es.doneCount,
      pendentes: es.pendingCount,
      areaExec: es.areaExec,
      totalArea: es.totalArea,
      volExec: es.volExec,
    }));
  }, [eixoStats]);

  const buildTrechos = useCallback((estacas: number[], estacaIntervalo: number) => {
    const sorted = [...estacas].sort((a, b) => a - b);
    if (!sorted.length) return [] as { inicio: number; fim: number; quantidade: number; comprimento: number }[];

    const trechos: { inicio: number; fim: number; quantidade: number; comprimento: number }[] = [];
    let inicio = sorted[0];
    let fim = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === fim + 1) {
        fim = sorted[i];
        continue;
      }

      const quantidade = (fim - inicio) + 1;
      trechos.push({ inicio, fim, quantidade, comprimento: quantidade * estacaIntervalo });
      inicio = sorted[i];
      fim = sorted[i];
    }

    const quantidade = (fim - inicio) + 1;
    trechos.push({ inicio, fim, quantidade, comprimento: quantidade * estacaIntervalo });
    return trechos;
  }, []);

  const camadaDetalhamento = useMemo(() => {
    if (!selectedLayerDetails) return null;

    const layer = ALL_LAYERS.find(l => l.key === selectedLayerDetails);
    if (!layer) return null;

    const porEixo = EIXOS.map(ex => {
      const eixoEstacas = getEixoEstacas(ex);
      const area = getEixoCellArea(ex);
      const totalCells = eixoEstacas.length * ex.faixas;
      const trechos: { faixa: number; inicio: number; fim: number; quantidade: number; comprimento: number }[] = [];

      let doneCount = 0;
      for (let faixa = 1; faixa <= ex.faixas; faixa++) {
        const estacasConcluidas = eixoEstacas.filter(est => {
          const key = `${est}_${faixa}_${layer.camada.id}_${layer.numero}`;
          const exec = execMap.get(key);
          return !!exec && exec.area_executada >= area;
        });

        doneCount += estacasConcluidas.length;
        const trechoFaixa = buildTrechos(estacasConcluidas, ex.estaca_intervalo).map(t => ({ ...t, faixa }));
        trechos.push(...trechoFaixa);
      }

      return {
        eixo: ex,
        totalCells,
        doneCount,
        pct: totalCells > 0 ? Math.round((doneCount / totalCells) * 1000) / 10 : 0,
        trechos,
      };
    });

    return { layer, porEixo };
  }, [selectedLayerDetails, execMap, buildTrechos]);

  const chartDataStatus = useMemo(() => {
    const concluidas = stats.completedCells;
    const emAndamento = execucoes.filter(e => e.area_executada > 0 && e.area_executada < cellArea).length;
    const naoIniciadas = stats.pendingCells - emAndamento;
    return [
      { name: 'Concluídas', value: concluidas, fill: 'hsl(142, 71%, 45%)' },
      { name: 'Em andamento', value: Math.max(0, emAndamento), fill: 'hsl(45, 93%, 47%)' },
      { name: 'Não iniciadas', value: Math.max(0, naoIniciadas), fill: 'hsl(var(--muted))' },
    ].filter(d => d.value > 0);
  }, [stats, execucoes, cellArea]);

  // ── Handlers ──
  const handleCellClick = (estaca: number, faixa: number) => {
    setSelectedCell({ estaca, faixa });
    setShowCellModal(true);
  };

  const gridCellKey = (est: number, faixa: number) => `${est}_${faixa}`;

  const toggleGridCell = (est: number, faixa: number) => {
    const key = gridCellKey(est, faixa);
    setGridSelection(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleGridMouseDown = (est: number, faixa: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsSelecting(true);
    toggleGridCell(est, faixa);
  };

  const handleGridMouseEnter = (est: number, faixa: number) => {
    if (!isSelecting) return;
    setGridSelection(prev => new Set(prev).add(gridCellKey(est, faixa)));
  };

  const handleGridMouseUp = () => setIsSelecting(false);

  const selectedGridCells = useMemo(() => Array.from(gridSelection).map(k => {
    const [est, faixa] = k.split('_').map(Number);
    return { estaca: est, faixa };
  }), [gridSelection]);

  const handleSaveGridSelection = async () => {
    if (gridSelection.size === 0) return;
    setSavingGrid(true);
    const layer = currentLayer;
    const area = cellArea;
    const volume = area * layer.camada.espessura;
    const records = selectedGridCells.map(c => ({
      estaca_inicio: c.estaca, estaca_fim: c.estaca, faixa: c.faixa, camada: layer.camada.id, camada_numero: layer.numero,
      data: format(new Date(), 'yyyy-MM-dd'), area_executada: area, volume_executado: volume, observacoes: null,
    }));
    try {
      const estArr = [...new Set(records.map(r => r.estaca_inicio))];
      const fxArr = [...new Set(records.map(r => r.faixa))];
      await (supabase as any).from('evolucao_obra_execucoes').delete().eq('camada', layer.camada.id).eq('camada_numero', layer.numero).in('estaca_inicio', estArr).in('faixa', fxArr);
      const BATCH = 500;
      for (let i = 0; i < records.length; i += BATCH) {
        const { error } = await (supabase as any).from('evolucao_obra_execucoes').insert(records.slice(i, i + BATCH));
        if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); setSavingGrid(false); return; }
      }
      toast({ title: `${records.length} células salvas (${layer.label})` });
      setGridSelection(new Set());
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setSavingGrid(false);
  };

  const getCellExecucoes = () => {
    if (!selectedCell) return [];
    return ALL_LAYERS.map(l => {
      const key = `${selectedCell.estaca}_${selectedCell.faixa}_${l.camada.id}_${l.numero}`;
      return { layer: l, exec: execMap.get(key) || null };
    });
  };

  const handleSaveEntry = async () => {
    if (formData.camadaKeys.length === 0) { toast({ title: 'Selecione ao menos uma camada', variant: 'destructive' }); return; }
    if (formData.faixas.length === 0) { toast({ title: 'Selecione ao menos uma faixa', variant: 'destructive' }); return; }
    const eixoEntry = EIXOS.find(e => e.id === formData.eixoId)!;
    const area = getEixoCellArea(eixoEntry);
    const validEstacas = getEixoEstacas(eixoEntry).filter(e => e >= formData.estacaInicio && e <= formData.estacaFim);
    if (validEstacas.length === 0) { toast({ title: 'Intervalo de estacas inválido', variant: 'destructive' }); return; }

    const records: any[] = [];
    for (const camadaKey of formData.camadaKeys) {
      const layer = ALL_LAYERS.find(l => l.key === camadaKey)!;
      const volume = area * layer.camada.espessura;
      for (const est of validEstacas) {
        for (const faixa of formData.faixas) {
          records.push({ estaca_inicio: est, estaca_fim: est, faixa, camada: layer.camada.id, camada_numero: layer.numero, data: format(formData.data, 'yyyy-MM-dd'), area_executada: area, volume_executado: volume, observacoes: formData.observacoes || null });
        }
      }
    }

    setSavingEntry(true);
    try {
      const camadaGroups = new Map<string, { camada: string; camada_numero: number; estacas: Set<number>; faixas: Set<number> }>();
      for (const rec of records) {
        const gk = `${rec.camada}_${rec.camada_numero}`;
        if (!camadaGroups.has(gk)) camadaGroups.set(gk, { camada: rec.camada, camada_numero: rec.camada_numero, estacas: new Set(), faixas: new Set() });
        camadaGroups.get(gk)!.estacas.add(rec.estaca_inicio);
        camadaGroups.get(gk)!.faixas.add(rec.faixa);
      }
      for (const [, group] of camadaGroups) {
        await (supabase as any).from('evolucao_obra_execucoes').delete().eq('camada', group.camada).eq('camada_numero', group.camada_numero).in('estaca_inicio', Array.from(group.estacas)).in('faixa', Array.from(group.faixas));
      }
      const BATCH_SIZE = 500;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const { error } = await (supabase as any).from('evolucao_obra_execucoes').insert(records.slice(i, i + BATCH_SIZE));
        if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
      }
      toast({ title: `${records.length} registros salvos com sucesso!` });
      setShowEntryModal(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteExec = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const { error } = await (supabase as any).from('evolucao_obra_execucoes').delete().eq('id', deleteTarget);
    setDeleteLoading(false);
    if (!error) { toast({ title: 'Registro excluído' }); loadData(); }
    setDeleteTarget(null);
  };

  const handleEditExec = (exec: Execucao) => {
    setEditingExec(exec);
    const layerKey = `${exec.camada}_${exec.camada_numero}`;
    setFormData({ estacaInicio: exec.estaca_inicio, estacaFim: exec.estaca_fim, faixas: [exec.faixa], camadaKeys: [layerKey], eixoId: EIXOS[0].id, data: new Date(exec.data + 'T12:00:00'), observacoes: exec.observacoes || '' });
    setShowEntryModal(true);
  };

  const handleUpdateEntry = async () => {
    if (!editingExec) return;
    const layer = ALL_LAYERS.find(l => l.key === formData.camadaKeys[0])!;
    const eixoEntry = EIXOS.find(e => e.id === formData.eixoId)!;
    const area = getEixoCellArea(eixoEntry);
    const volume = area * layer.camada.espessura;
    const { error } = await (supabase as any).from('evolucao_obra_execucoes').update({
      estaca_inicio: formData.estacaInicio, estaca_fim: formData.estacaFim, faixa: formData.faixas[0] || editingExec.faixa,
      camada: layer.camada.id, camada_numero: layer.numero, data: format(formData.data, 'yyyy-MM-dd'),
      area_executada: area, volume_executado: volume, observacoes: formData.observacoes || null,
    }).eq('id', editingExec.id);
    if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Registro atualizado!' }); setShowEntryModal(false); setEditingExec(null); loadData(); }
  };

  const toggleFaixa = (f: number) => {
    setFormData(prev => ({ ...prev, faixas: prev.faixas.includes(f) ? prev.faixas.filter(x => x !== f) : [...prev.faixas, f] }));
  };

  // Color interpolation for general view
  const getGeralCellColor = (count: number) => {
    if (count === 0) return STATUS_COLORS.nao_iniciado;
    if (count >= TOTAL_LAYERS) return 'hsl(142, 71%, 40%)';
    // Gradient from yellow to green based on completion
    const ratio = count / TOTAL_LAYERS;
    if (ratio < 0.5) return `hsl(${45 + ratio * 80}, 80%, 50%)`;
    return `hsl(${85 + (ratio - 0.5) * 114}, 65%, 45%)`;
  };

  return (
    <div className="space-y-4" id="evolucao-dashboard-content">
      {/* ═══════ Header ═══════ */}
      <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-3 flex flex-wrap items-center gap-4">
          <Plane className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-sm font-bold">Aeroporto de Maragogi — Evolução da Obra</h2>
            <p className="text-[10px] text-muted-foreground">Terraplanagem | {EIXOS.length} eixos | {TOTAL_LAYERS} camadas por célula | Coord: Aratu EPSG:4208</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handlePdfExport}>
              <FileDown className="w-3.5 h-3.5" /> PDF
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleWhatsAppExport}>
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => {
              setEditingExec(null);
              const allFx = Array.from({ length: eixo.faixas }, (_, i) => i + 1);
              const estArr = getEixoEstacas(eixo);
              setFormData({ estacaInicio: eixo.estaca_inicial, estacaFim: estArr[estArr.length - 1], faixas: allFx, camadaKeys: [selectedCamada], eixoId: selectedEixo, data: new Date(), observacoes: '' });
              setShowEntryModal(true);
            }}>
              <Zap className="w-3.5 h-3.5" /> Lançamento Rápido
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Ruler className="w-4 h-4" /> Escopo dos KPIs e Gráficos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant={kpiEixoFilter === 'geral' ? 'default' : 'outline'} onClick={() => setKpiEixoFilter('geral')}>Geral</Button>
          {EIXOS.map(ex => (
            <Button
              key={ex.id}
              size="sm"
              variant={kpiEixoFilter === ex.id ? 'default' : 'outline'}
              onClick={() => {
                setSelectedEixo(ex.id);
                setKpiEixoFilter(ex.id);
              }}
            >
              {ex.nome}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* ═══════ Painel do Gestor ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Progresso {kpiLabel}</p>
            <p className="text-2xl font-bold text-primary">{formatNum(filteredStats.pctGeral)}%</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(142, 71%, 45%)' }}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Área Executada</p>
            <p className="text-xl font-bold" style={{ color: 'hsl(142, 71%, 40%)' }}>{formatNum(filteredStats.totalAreaExec)} m²</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(217, 91%, 50%)' }}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Volume Executado</p>
            <p className="text-xl font-bold" style={{ color: 'hsl(217, 91%, 50%)' }}>{formatNum(filteredStats.totalVolExec)} m³</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(142, 71%, 45%)' }}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Concluídas</p>
            <p className="text-xl font-bold" style={{ color: 'hsl(142, 71%, 40%)' }}>{filteredStats.completedCells}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(45, 93%, 47%)' }}>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" /> Pendentes</p>
            <p className="text-xl font-bold" style={{ color: 'hsl(45, 93%, 40%)' }}>{filteredStats.pendingCells}</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══════ Progresso por Camada (mini cards) ═══════ */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {ALL_LAYERS.map(l => {
          const d = filteredStats.perLayer.get(l.key);
          const pct = d && d.total > 0 ? (d.area / d.total) * 100 : 0;
          return (
            <Card key={l.key} className={`cursor-pointer transition-all ${selectedCamada === l.key ? 'ring-2 ring-primary' : 'hover:border-primary/40'}`}
              onClick={() => { setSelectedCamada(l.key); setGridViewMode('camada'); }}>
              <CardContent className="p-2.5 text-center">
                <span className="w-3 h-3 rounded-full inline-block mb-1" style={{ background: l.camada.cor }} />
                <p className="text-[10px] font-medium truncate">{l.label}</p>
                <p className="text-sm font-bold" style={{ color: l.camada.cor }}>{formatNum(pct)}%</p>
                
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ═══════ Gráficos de Evolução ═══════ */}
      <div className="space-y-4">
          {/* Row 1: Progresso por Camada (com detalhes) + Status Geral */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Progresso por Camada</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataCamadas} layout="vertical" margin={{ left: 80, right: 60, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={10} />
                    <YAxis type="category" dataKey="name" fontSize={10} width={75} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-card border rounded-lg p-2.5 shadow-lg text-xs space-y-1">
                          <p className="font-bold">{d.name}</p>
                          <p>Progresso: <strong>{d.pct}%</strong></p>
                          <p>Área exec: <strong>{formatNum(d.areaExec)} m²</strong> / {formatNum(d.areaTotal)} m²</p>
                          <p>Volume exec: <strong>{formatNum(d.volExec)} m³</strong></p>
                        </div>
                      );
                    }} />
                    <Bar
                      dataKey="pct"
                      radius={[0, 4, 4, 0]}
                      barSize={18}
                      label={{ position: 'right', fontSize: 9, formatter: (v: number) => `${v}%` }}
                      onClick={(_, index) => {
                        const row = chartDataCamadas[index];
                        if (row?.layerKey) setSelectedLayerDetails(row.layerKey);
                      }}
                    >
                      {chartDataCamadas.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieChart className="w-4 h-4" /> Status Geral</CardTitle></CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RPieChart>
                    <Pie data={chartDataStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} label={({ name, value }) => `${name}: ${value}`} fontSize={10}>
                      {chartDataStatus.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip />
                    <Legend fontSize={10} />
                  </RPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Progresso por Eixo</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataEixos} layout="vertical" margin={{ left: 40, right: 30, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={10} />
                  <YAxis type="category" dataKey="name" width={95} fontSize={10} />
                  <Tooltip formatter={(v: number, name: string) => [name === 'pct' ? `${formatNum(v)}%` : formatNum(v), name === 'pct' ? 'Progresso' : 'Valor']} />
                  <Bar
                    dataKey="pct"
                    radius={[0, 4, 4, 0]}
                    fill="hsl(217, 91%, 50%)"
                    label={{ position: 'right', fontSize: 9, formatter: (v: number) => `${v}%` }}
                    onClick={(_, index) => {
                      const row = chartDataEixos[index];
                      if (row?.id) {
                        setSelectedEixo(row.id);
                        setKpiEixoFilter(row.id);
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

      {/* Lançamentos inline */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> Lançamentos</CardTitle>
            <Button size="sm" onClick={() => {
              setEditingExec(null);
              const estArr = getEixoEstacas(eixo);
              const allFx = Array.from({ length: eixo.faixas }, (_, i) => i + 1);
              setFormData({ estacaInicio: eixo.estaca_inicial, estacaFim: estArr[estArr.length - 1], faixas: allFx, camadaKeys: [selectedCamada], eixoId: selectedEixo, data: new Date(), observacoes: '' });
              setShowEntryModal(true);
            }}>
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Estaca</TableHead>
                  <TableHead className="text-xs">Faixa</TableHead>
                  <TableHead className="text-xs">Camada</TableHead>
                  <TableHead className="text-xs">Área (m²)</TableHead>
                  <TableHead className="text-xs">Volume (m³)</TableHead>
                  <TableHead className="text-xs">Obs</TableHead>
                  <TableHead className="text-xs w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {execucoes.map(e => {
                  const layerInfo = ALL_LAYERS.find(l => l.camada.id === e.camada && l.numero === e.camada_numero);
                  return (
                    <TableRow key={e.id} className="text-xs">
                      <TableCell>{e.data ? format(new Date(e.data + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</TableCell>
                      <TableCell>{displayEstaca(eixo, e.estaca_inicio)}</TableCell>
                      <TableCell>F{e.faixa}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px]" style={{ borderColor: layerInfo?.camada.cor }}>
                          {layerInfo?.label || e.camada}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatNum(e.area_executada)}</TableCell>
                      <TableCell>{formatNum(e.volume_executado)}</TableCell>
                      <TableCell className="max-w-[100px] truncate">{e.observacoes || '-'}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditExec(e)}><Pencil className="w-3 h-3 text-primary" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteTarget(e.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {execucoes.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum lançamento registrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Cell Detail Modal ═══ */}
      <Dialog open={!!selectedLayerDetails} onOpenChange={(v) => { if (!v) setSelectedLayerDetails(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhamento da camada {camadaDetalhamento?.layer.label}</DialogTitle>
            <DialogDescription>Clique nas barras para ver os trechos e estacas já concluídos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {camadaDetalhamento?.porEixo.map((item) => (
              <Card key={item.eixo.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{item.eixo.nome}</p>
                    <Badge variant="outline">{item.pct}% ({item.doneCount}/{item.totalCells})</Badge>
                  </div>
                  {item.trechos.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {item.trechos.map((t, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground flex justify-between border rounded px-2 py-1">
                          <span>Faixa {t.faixa}: {displayEstaca(item.eixo, t.inicio)} → {displayEstaca(item.eixo, t.fim)}</span>
                          <span>{formatNum(t.comprimento)} m</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem trechos concluídos neste eixo.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCellModal} onOpenChange={setShowCellModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4" />
              {displayEstaca(eixo, selectedCell?.estaca ?? 0)} — Faixa {selectedCell?.faixa}
            </DialogTitle>
            <DialogDescription>Área: {cellArea} m² | {eixo.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {getCellExecucoes().map(({ layer, exec }) => (
              <div key={layer.key} className="flex items-center gap-3 p-2.5 rounded-lg border">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: layer.camada.cor }} />
                <div className="flex-1">
                  <p className="text-xs font-medium">{layer.label}</p>
                  <p className="text-[10px] text-muted-foreground">Esp: {layer.camada.espessura * 100}cm | Vol: {formatNum(cellArea * layer.camada.espessura)} m³</p>
                </div>
                {exec ? (
                  <div className="text-right">
                    <Badge variant={exec.area_executada >= cellArea ? 'default' : 'secondary'} className="text-[9px]">
                      {exec.area_executada >= cellArea ? '✅ Concluído' : '🟡 Parcial'}
                    </Badge>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{exec.data ? format(new Date(exec.data + 'T12:00:00'), 'dd/MM/yy') : ''}</p>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[9px] text-muted-foreground">🔴 Pendente</Badge>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => {
              if (!selectedCell) return;
              setShowCellModal(false);
              setGridViewMode('camada');
              // Pre-select this cell for quick launch
              setGridSelection(new Set([gridCellKey(selectedCell.estaca, selectedCell.faixa)]));
            }}>
              <Zap className="w-3 h-3" /> Lançar nesta célula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Entry Modal ═══ */}
      <Dialog open={showEntryModal} onOpenChange={v => { if (!v) { setShowEntryModal(false); setEditingExec(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingExec ? <Pencil className="w-4 h-4" /> : <Zap className="w-4 h-4 text-primary" />}
              {editingExec ? 'Editar Lançamento' : 'Lançamento Rápido'}
            </DialogTitle>
            <DialogDescription>{editingExec ? 'Atualize os dados' : 'Selecione eixo, intervalo, faixas e camadas'}</DialogDescription>
          </DialogHeader>

          {/* Quick Presets */}
          {!editingExec && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">⚡ Atalhos Rápidos</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { label: 'PPD Completa', eixo: 'ppd', allFaixas: true, allCamadas: true, allEstacas: true },
                  { label: 'Solo Local (3 cam)', eixo: formData.eixoId, allFaixas: true, allCamadas: false, allEstacas: true, camadas: ['solo_local_1', 'solo_local_2', 'solo_local_3'] },
                  { label: 'BGS (2 cam)', eixo: formData.eixoId, allFaixas: true, allCamadas: false, allEstacas: true, camadas: ['bgs_1', 'bgs_2'] },
                  { label: 'BGTC', eixo: formData.eixoId, allFaixas: true, allCamadas: false, allEstacas: true, camadas: ['bgtc_1'] },
                  { label: 'Todas Camadas', eixo: formData.eixoId, allFaixas: true, allCamadas: true, allEstacas: true },
                ].map((preset, idx) => {
                  const ex = EIXOS.find(e => e.id === preset.eixo)!;
                  const allFx = Array.from({ length: ex.faixas }, (_, i) => i + 1);
                  const estArr = getEixoEstacas(ex);
                  return (
                    <Button key={idx} variant="outline" size="sm" className="h-auto py-2 text-[10px] text-left justify-start whitespace-normal"
                      onClick={() => setFormData(prev => ({
                        ...prev, eixoId: preset.eixo,
                        faixas: preset.allFaixas ? allFx : prev.faixas,
                        camadaKeys: preset.allCamadas ? ALL_LAYERS.map(l => l.key) : (preset.camadas || prev.camadaKeys),
                        estacaInicio: preset.allEstacas ? ex.estaca_inicial : prev.estacaInicio,
                        estacaFim: preset.allEstacas ? estArr[estArr.length - 1] : prev.estacaFim,
                      }))}>
                      <Zap className="w-3 h-3 mr-1 shrink-0 text-primary" /> {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Eixo</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {EIXOS.map(ex => (
                    <Button key={ex.id} variant={formData.eixoId === ex.id ? 'default' : 'outline'} size="sm" className="text-[10px] h-8 justify-start"
                      onClick={() => {
                        const allFx = Array.from({ length: ex.faixas }, (_, i) => i + 1);
                        setFormData(prev => ({ ...prev, eixoId: ex.id, estacaInicio: ex.estaca_inicial, estacaFim: ex.estaca_inicial, faixas: allFx }));
                      }}>
                      {ex.nome}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-xs">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {format(formData.data, 'dd/MM/yyyy', { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.data} onSelect={d => d && setFormData(prev => ({ ...prev, data: d }))} locale={ptBR} /></PopoverContent>
                </Popover>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Estacas</label>
                  {!editingExec && (() => {
                    const ex = EIXOS.find(e => e.id === formData.eixoId)!;
                    const estArr = getEixoEstacas(ex);
                    return (
                      <Button variant="ghost" size="sm" className="h-5 text-[9px] px-2"
                        onClick={() => setFormData(prev => ({ ...prev, estacaInicio: ex.estaca_inicial, estacaFim: estArr[estArr.length - 1] }))}>
                        Todas
                      </Button>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={String(formData.estacaInicio)} onValueChange={v => setFormData(prev => ({ ...prev, estacaInicio: parseInt(v) }))}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Início" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {getEixoEstacas(EIXOS.find(e => e.id === formData.eixoId)!).map(est => (
                        <SelectItem key={est} value={String(est)}>{displayEstaca(EIXOS.find(e => e.id === formData.eixoId)!, est)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(formData.estacaFim)} onValueChange={v => setFormData(prev => ({ ...prev, estacaFim: parseInt(v) }))}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Fim" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {getEixoEstacas(EIXOS.find(e => e.id === formData.eixoId)!).filter(est => est >= formData.estacaInicio).map(est => (
                        <SelectItem key={est} value={String(est)}>{displayEstaca(EIXOS.find(e => e.id === formData.eixoId)!, est)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Faixas</label>
                  {!editingExec && (() => {
                    const totalFaixas = EIXOS.find(e => e.id === formData.eixoId)!.faixas;
                    const allFaixas = Array.from({ length: totalFaixas }, (_, i) => i + 1);
                    return (
                      <Button variant="ghost" size="sm" className="h-5 text-[9px] px-2"
                        onClick={() => setFormData(prev => ({ ...prev, faixas: prev.faixas.length === totalFaixas ? [] : allFaixas }))}>
                        {formData.faixas.length === totalFaixas ? '✓ Todas' : 'Todas'}
                      </Button>
                    );
                  })()}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: EIXOS.find(e => e.id === formData.eixoId)!.faixas }, (_, i) => i + 1).map(f => (
                    <Button key={f} variant={formData.faixas.includes(f) ? 'default' : 'outline'} size="sm" onClick={() => toggleFaixa(f)} className="w-11 h-8 text-xs">F{f}</Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Camadas</label>
                  {!editingExec && (
                    <Button variant="ghost" size="sm" className="h-5 text-[9px] px-2"
                      onClick={() => setFormData(prev => ({ ...prev, camadaKeys: prev.camadaKeys.length === ALL_LAYERS.length ? [] : ALL_LAYERS.map(l => l.key) }))}>
                      {formData.camadaKeys.length === ALL_LAYERS.length ? '✓ Todas' : 'Todas'}
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  {CAMADAS.map(cam => {
                    const layers = ALL_LAYERS.filter(l => l.camada.id === cam.id);
                    const allSelected = layers.every(l => formData.camadaKeys.includes(l.key));
                    return (
                      <div key={cam.id} className="flex items-center gap-1">
                        {!editingExec && layers.length > 1 && (
                          <Button variant={allSelected ? 'default' : 'outline'} size="sm" className="text-[9px] h-7 px-1.5 shrink-0"
                            onClick={() => {
                              setFormData(prev => {
                                const keys = layers.map(l => l.key);
                                const hasAll = keys.every(k => prev.camadaKeys.includes(k));
                                return { ...prev, camadaKeys: hasAll ? prev.camadaKeys.filter(k => !keys.includes(k)) : [...new Set([...prev.camadaKeys, ...keys])] };
                              });
                            }}>
                            <span className="w-2 h-2 rounded-full mr-0.5" style={{ background: cam.cor }} /> {cam.nome}
                          </Button>
                        )}
                        {layers.map(l => (
                          <Button key={l.key} variant={formData.camadaKeys.includes(l.key) ? 'default' : 'outline'} size="sm" className="text-[10px] h-7 gap-0.5 px-2"
                            onClick={() => editingExec ? setFormData(prev => ({ ...prev, camadaKeys: [l.key] })) : toggleCamada(l.key)}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.camada.cor }} />
                            {layers.length > 1 ? l.numero : l.label}
                          </Button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Observações</label>
                <Textarea value={formData.observacoes} onChange={e => setFormData(prev => ({ ...prev, observacoes: e.target.value }))} placeholder="Opcional..." rows={2} className="text-xs" />
              </div>
            </div>
          </div>

          {/* Summary */}
          {formData.faixas.length > 0 && formData.estacaFim >= formData.estacaInicio && formData.camadaKeys.length > 0 && (() => {
            const eixoForm = EIXOS.find(e => e.id === formData.eixoId)!;
            const area = getEixoCellArea(eixoForm);
            const validEstacas = getEixoEstacas(eixoForm).filter(e => e >= formData.estacaInicio && e <= formData.estacaFim);
            const cellsPerLayer = validEstacas.length * formData.faixas.length;
            const totalCells = cellsPerLayer * formData.camadaKeys.length;
            const totalVol = formData.camadaKeys.reduce((s, k) => {
              const l = ALL_LAYERS.find(x => x.key === k)!;
              return s + cellsPerLayer * area * l.camada.espessura;
            }, 0);
            return (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1">
                <p className="font-medium text-primary flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Resumo</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-muted-foreground">
                  <span>📏 {displayEstaca(eixoForm, formData.estacaInicio)} → {displayEstaca(eixoForm, formData.estacaFim)}</span>
                  <span>📐 {formData.faixas.length} faixas</span>
                  <span>🧱 {formData.camadaKeys.length} camada(s)</span>
                  <span>📊 {totalCells} células</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <span>📐 Área: {formatNum(totalCells * area)} m²</span>
                  <span>📦 Volume: {formatNum(totalVol)} m³</span>
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEntryModal(false); setEditingExec(null); }}>Cancelar</Button>
            <Button onClick={editingExec ? handleUpdateEntry : handleSaveEntry} className="gap-1" disabled={savingEntry}>
              {savingEntry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editingExec ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} onConfirm={handleDeleteExec} loading={deleteLoading} />
    </div>
  );
};
