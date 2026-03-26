import { useEffect, useState, useCallback, useMemo } from 'react';
import { format, subDays, isSameDay, parse, isValid, startOfDay, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, RefreshCw, Search, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Eye, ChevronDown, ChevronUp, MessageCircle, Copy, Check
} from 'lucide-react';

interface Equipment {
  prefixo: string;
  descricao: string;
  empresa: string;
  tipo: string;
}

interface HorimetroEntry {
  veiculo: string;
  date: Date;
  hasHorimetro: boolean;
  hasKm: boolean;
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

function normText(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function normPrefixo(s: string): string {
  return normText(s);
}

type FilterMode = 'pending' | 'all' | 'ok';

export function FrotaMonitoramentoTab() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [entries, setEntries] = useState<HorimetroEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [daysToShow, setDaysToShow] = useState(14);
  const [pageOffset, setPageOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('all');
  const [filterMode, setFilterMode] = useState<FilterMode>('pending');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [copied, setCopied] = useState(false);
  const { readSheet } = useGoogleSheets();
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [frotaData, horiData] = await Promise.all([
        readSheet('Frota Geral'),
        readSheet('Horimetros'),
      ]);

      // --- Helper: find column by exact or partial match on normalized synonyms ---
      const findCol = (headers: string[], ...synonyms: string[]) => {
        // Try exact normalized match first
        for (const syn of synonyms) {
          const normSyn = normText(syn);
          const idx = headers.findIndex(h => normText(h) === normSyn);
          if (idx >= 0) return idx;
        }
        // Then try partial (includes) match
        for (const syn of synonyms) {
          const normSyn = normText(syn);
          const idx = headers.findIndex(h => normText(h).includes(normSyn));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      // --- Parse ALL vehicles from Horimetros to detect orphans ---
      const horiVehiclesWithLancamento = new Set<string>();
      const horiVehicleRawNames = new Map<string, string>(); // normPrefixo -> original name
      
      let parsedEntries: HorimetroEntry[] = [];

      if (horiData && horiData.length > 1) {
        const hH = (horiData[0] as string[]).map(h => String(h || '').trim());
        const dataIdx = findCol(hH, 'data');
        const veicIdx = findCol(hH, 'veiculo', 'prefixo', 'codigo', 'equipamento');
        let horAtIdx = findCol(hH, 'horimetro atual', 'horimetroa tual', 'hor atual', 'horimetro_atual');
        if (horAtIdx < 0) horAtIdx = hH.findIndex(h => normText(h).includes('horimetro') && normText(h).includes('atual'));
        let kmAtIdx = findCol(hH, 'km atual', 'kmatual', 'km_atual', 'quilometragem atual');
        if (kmAtIdx < 0) kmAtIdx = hH.findIndex(h => normText(h).includes('km') && normText(h).includes('atual'));
        let horAntIdx = findCol(hH, 'horimetro anterior', 'horimetroanterior', 'hor anterior', 'horimetro_anterior');
        if (horAntIdx < 0) horAntIdx = hH.findIndex(h => normText(h).includes('horimetro') && normText(h).includes('anterior'));

        console.log('[Monitoramento] Horimetros headers:', hH);
        console.log('[Monitoramento] Horimetros indices - data:', dataIdx, 'veiculo:', veicIdx, 'horAtual:', horAtIdx, 'kmAtual:', kmAtIdx, 'horAnterior:', horAntIdx);
        console.log('[Monitoramento] Horimetros total rows:', horiData.length - 1);
        console.log('[Monitoramento] Horimetros sample row:', horiData[1]);

        // First pass: collect all vehicle names
        horiData.slice(1).forEach(row => {
          const rawVeic = String(row[veicIdx] || '').trim();
          if (!rawVeic) return;
          const normV = normPrefixo(rawVeic);
          horiVehiclesWithLancamento.add(normV);
          if (!horiVehicleRawNames.has(normV)) {
            horiVehicleRawNames.set(normV, rawVeic);
          }
        });

        // Second pass: parse entries
        parsedEntries = horiData.slice(1)
          .map(row => {
            const veiculo = String(row[veicIdx] || '').trim();
            const dateStr = String(row[dataIdx] || '').trim();
            const date = parseDate(dateStr);
            const horVal = String(row[horAtIdx] || '').trim();
            const horAntVal = horAntIdx >= 0 ? String(row[horAntIdx] || '').trim() : '';
            const kmVal = kmAtIdx >= 0 ? String(row[kmAtIdx] || '').trim() : '';
            if (!veiculo || !date) return null;
            const hasHorimetro = (!!horVal && horVal !== '0' && horVal !== '-') || (!!horAntVal && horAntVal !== '0' && horAntVal !== '-');
            const hasKm = !!kmVal && kmVal !== '0' && kmVal !== '-';
            return {
              veiculo,
              date: startOfDay(date),
              hasHorimetro,
              hasKm,
            };
          })
          .filter(Boolean) as HorimetroEntry[];
        setEntries(parsedEntries);
      }

      // --- Parse Frota Geral ---
      const frotaNormSet = new Set<string>();
      let equips: Equipment[] = [];

      if (frotaData && frotaData.length > 1) {
        const fH = (frotaData[0] as string[]).map(h => String(h || '').trim());
        const prefIdx = findCol(fH, 'prefixo', 'codigo', 'cod', 'placa', 'veiculo');
        const descIdx = findCol(fH, 'descricao', 'descri', 'equipamento', 'modelo');
        const empIdx = findCol(fH, 'empresa', 'proprietario');
        const tipoIdx = findCol(fH, 'categoria', 'tipo', 'classe');
        const statusIdx = findCol(fH, 'status', 'situacao');

        console.log('[Monitoramento] Frota Geral headers:', fH);
        console.log('[Monitoramento] Frota Geral indices:', { prefIdx, descIdx, empIdx, tipoIdx, statusIdx });
        console.log('[Monitoramento] Frota Geral sample row:', frotaData[1]);
        console.log('[Monitoramento] Hori vehicles:', [...horiVehiclesWithLancamento].slice(0, 10));

        const excludedEmpresas = ['obrasaneamento', 'outros'];
        const excludedTipos = ['veiculo', 'veiculoleve', 'carroproprio', 'tanquebritador', 'balanca'];
        const excludedDescs = ['tanquebritador', 'balanca'];
        equips = frotaData.slice(1)
          .filter(row => {
            const pref = String(row[prefIdx] || '').trim();
            const prefNorm = normPrefixo(pref);
            if (!pref) return false;

            const statusNorm = normText(String(row[statusIdx] || ''));
            const empNorm = normText(String(row[empIdx] || ''));
            const tipoNorm = normText(String(row[tipoIdx] || ''));
            const descNorm = normText(String(row[descIdx] || ''));

            const isActive = !statusNorm || statusNorm.includes('mobilizado') || statusNorm.includes('ativo');
            const hasHorimetroRecords = horiVehiclesWithLancamento.has(prefNorm);

            // Keep vehicle if it has horímetro records, even if inactive
            if (!isActive && !hasHorimetroRecords) return false;
            if (excludedEmpresas.includes(empNorm)) return false;
            if (excludedTipos.some(t => tipoNorm.includes(t))) return false;
            if (excludedDescs.some(t => descNorm.includes(t))) return false;
            return true;
          })
          .map(row => {
            const pref = String(row[prefIdx] || '').trim();
            frotaNormSet.add(normPrefixo(pref));
            return {
              prefixo: pref,
              descricao: String(row[descIdx] || '').trim(),
              empresa: String(row[empIdx] || '').trim(),
              tipo: String(row[tipoIdx] || '').trim(),
            };
          });
        console.log('[Monitoramento] Frota Geral matched vehicles (first 10):', [...frotaNormSet].slice(0, 10));
      }

      // --- Add orphan vehicles (in Horimetros but NOT in Frota Geral) ---
      let orphanCount = 0;
      horiVehiclesWithLancamento.forEach(normV => {
        if (!frotaNormSet.has(normV)) {
          const rawName = horiVehicleRawNames.get(normV) || normV;
          equips.push({
            prefixo: rawName,
            descricao: '⚠ Não cadastrado na Frota',
            empresa: 'Sem Empresa',
            tipo: 'Desconhecido',
          });
          orphanCount++;
        }
      });
      if (orphanCount > 0) {
        console.log(`[Monitoramento] ${orphanCount} veículo(s) órfão(s) encontrado(s) na planilha Horímetros sem correspondência na Frota Geral`);
      }

      setEquipment(equips);
    } catch (err) {
      console.error('Error loading monitoring data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [readSheet]);

  useEffect(() => { loadData(); }, []);

  const today = startOfDay(new Date());

  const dateColumns = useMemo(() => {
    const endDate = subDays(today, pageOffset);
    const cols: Date[] = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      cols.push(subDays(endDate, i));
    }
    return cols;
  }, [daysToShow, pageOffset, today]);

  const entryMap = useMemo(() => {
    const map = new Map<string, { hasHorimetro: boolean; hasKm: boolean }>();
    entries.forEach(e => {
      const normalizedVehicle = normPrefixo(e.veiculo);
      const key = `${normalizedVehicle}|${format(e.date, 'yyyy-MM-dd')}`;
      const existing = map.get(key);
      if (existing) {
        existing.hasHorimetro = existing.hasHorimetro || e.hasHorimetro;
        existing.hasKm = existing.hasKm || e.hasKm;
      } else {
        map.set(key, { hasHorimetro: e.hasHorimetro, hasKm: e.hasKm });
      }
    });
    return map;
  }, [entries]);

  const empresas = useMemo(() => {
    return [...new Set(equipment.map(e => e.empresa))].filter(Boolean).sort();
  }, [equipment]);

  const getPendingDays = useCallback((eq: Equipment) => {
    const days: Date[] = [];
    const normalizedPrefixo = normPrefixo(eq.prefixo);
    dateColumns.forEach(d => {
      if (isSameDay(d, today) || isAfter(d, today)) return;
      const key = `${normalizedPrefixo}|${format(d, 'yyyy-MM-dd')}`;
      const entry = entryMap.get(key);
      if (!entry || (!entry.hasHorimetro && !entry.hasKm)) {
        days.push(d);
      }
    });
    return days;
  }, [dateColumns, entryMap, today]);

  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      if (filterEmpresa !== 'all' && eq.empresa !== filterEmpresa) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!eq.prefixo.toLowerCase().includes(term) && !eq.descricao.toLowerCase().includes(term)) return false;
      }
      const pendCount = getPendingDays(eq).length;
      if (filterMode === 'pending') return pendCount > 0;
      if (filterMode === 'ok') return pendCount === 0;
      return true;
    });
  }, [equipment, filterEmpresa, searchTerm, filterMode, getPendingDays]);

  const groupedEquipment = useMemo(() => {
    const groups: Record<string, Equipment[]> = {};
    filteredEquipment.forEach(eq => {
      const key = eq.empresa || 'Sem Empresa';
      if (!groups[key]) groups[key] = [];
      groups[key].push(eq);
    });
    Object.values(groups).forEach(list => {
      list.sort((a, b) => {
        // Sort by description first, then by pending count descending
        const descCompare = a.descricao.localeCompare(b.descricao, 'pt-BR');
        if (descCompare !== 0) return descCompare;
        return a.prefixo.localeCompare(b.prefixo, undefined, { numeric: true });
      });
    });
    return Object.entries(groups).sort(([, a], [, b]) => {
      const aPend = a.reduce((s, eq) => s + getPendingDays(eq).length, 0);
      const bPend = b.reduce((s, eq) => s + getPendingDays(eq).length, 0);
      return bPend - aPend;
    });
  }, [filteredEquipment, getPendingDays]);

  // Auto-expand all groups on first load
  useEffect(() => {
    if (groupedEquipment.length > 0 && Object.keys(expandedGroups).length === 0) {
      const initial: Record<string, boolean> = {};
      groupedEquipment.forEach(([empresa]) => { initial[empresa] = true; });
      setExpandedGroups(initial);
    }
  }, [groupedEquipment]);

  const toggleGroup = (empresa: string) => {
    setExpandedGroups(prev => ({ ...prev, [empresa]: !prev[empresa] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    groupedEquipment.forEach(([empresa]) => { all[empresa] = true; });
    setExpandedGroups(all);
  };

  const collapseAll = () => setExpandedGroups({});

  const stats = useMemo(() => {
    let totalMissing = 0;
    let vehiclesWithIssues = 0;
    equipment.forEach(eq => {
      const pend = getPendingDays(eq).length;
      if (pend > 0) { vehiclesWithIssues++; totalMissing += pend; }
    });
    return { totalMissing, vehiclesWithIssues, totalVehicles: equipment.length };
  }, [equipment, getPendingDays]);

  // Vehicle selection for WhatsApp
  const toggleVehicleSelection = (prefixo: string) => {
    setSelectedVehicles(prev => {
      const next = new Set(prev);
      if (next.has(prefixo)) next.delete(prefixo); else next.add(prefixo);
      return next;
    });
  };

  const selectAllPending = () => {
    const pending = filteredEquipment.filter(eq => getPendingDays(eq).length > 0).map(eq => eq.prefixo);
    setSelectedVehicles(new Set(pending));
  };

  const clearSelection = () => setSelectedVehicles(new Set());

  const generateWhatsAppMessage = useCallback(() => {
    const selected = equipment.filter(eq => selectedVehicles.has(eq.prefixo));
    if (selected.length === 0) return '';

    const dateRange = `${format(dateColumns[0], 'dd/MM')} a ${format(dateColumns[dateColumns.length - 1], 'dd/MM/yyyy')}`;
    let msg = `⚠️ *PENDÊNCIAS HORÍMETRO/KM*\n📅 Período: ${dateRange}\n\n`;

    // Group by empresa
    const byEmpresa: Record<string, { eq: Equipment; days: Date[] }[]> = {};
    selected.forEach(eq => {
      const days = getPendingDays(eq);
      if (days.length === 0) return;
      const key = eq.empresa || 'Sem Empresa';
      if (!byEmpresa[key]) byEmpresa[key] = [];
      byEmpresa[key].push({ eq, days });
    });

    Object.entries(byEmpresa).forEach(([empresa, items]) => {
      msg += `🏢 *${empresa}* (${items.length} veículo${items.length !== 1 ? 's' : ''})\n`;
      items.forEach(({ eq, days }) => {
        const datesStr = days.map(d => format(d, 'dd/MM')).join(', ');
        msg += `  • ${eq.prefixo} - ${eq.descricao} (${eq.tipo})\n    📅 ${days.length} dia${days.length !== 1 ? 's' : ''}: ${datesStr}\n`;
      });
      msg += '\n';
    });

    const totalPend = Object.values(byEmpresa).reduce((s, items) => s + items.reduce((ss, i) => ss + i.days.length, 0), 0);
    msg += `📊 *Total: ${selected.length} veículo${selected.length !== 1 ? 's' : ''} | ${totalPend} dia${totalPend !== 1 ? 's' : ''} pendente${totalPend !== 1 ? 's' : ''}*\n\n`;
    msg += `_Relatório gerado - ApropriAPP_`;
    return msg;
  }, [selectedVehicles, equipment, dateColumns, getPendingDays]);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(generateWhatsAppMessage());
    setCopied(true);
    toast({ title: "Copiado!", description: "Mensagem copiada para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    const message = encodeURIComponent(generateWhatsAppMessage());
    const phone = phoneNumber.replace(/\D/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  if (isLoading && equipment.length === 0) {
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
          <Eye className="w-4 h-4 text-primary" />
          Monitoramento de Preenchimento
        </CardTitle>
        <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pt-0 pb-3">
        {/* KPIs compactos */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Frota:</span>
            <span className="font-bold">{stats.totalVehicles}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-bold">{stats.vehiclesWithIssues}</span>
            <span className="text-muted-foreground">com pendência</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <span className="font-bold">{stats.totalMissing}</span>
            <span className="text-muted-foreground">dias sem preenchimento</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2 items-center flex-wrap">
          <div className="flex gap-1 items-center">
            <Button
              variant={filterMode === 'pending' ? 'destructive' : 'outline'}
              size="sm" className="h-8 text-xs px-3"
              onClick={() => setFilterMode('pending')}
            >
              Pendentes ({stats.vehiclesWithIssues})
            </Button>
            <Button
              variant={filterMode === 'all' ? 'default' : 'outline'}
              size="sm" className="h-8 text-xs px-3"
              onClick={() => setFilterMode('all')}
            >
              Todos
            </Button>
            <Button
              variant={filterMode === 'ok' ? 'default' : 'outline'}
              size="sm" className="h-8 text-xs px-3"
              onClick={() => setFilterMode('ok')}
            >
              Em dia
            </Button>
          </div>

          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
              <SelectValue placeholder="Todas empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas empresas</SelectItem>
              {empresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar veículo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={String(daysToShow)} onValueChange={v => { setDaysToShow(Number(v)); setPageOffset(0); }}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="21">21 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageOffset(p => p + daysToShow)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => setPageOffset(0)} disabled={pageOffset === 0}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageOffset(p => Math.max(0, p - daysToShow))} disabled={pageOffset === 0}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={expandAll}>
              Expandir
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={collapseAll}>
              Recolher
            </Button>
          </div>

          {/* WhatsApp export */}
          <div className="flex gap-1 items-center">
            {selectedVehicles.size > 0 && (
              <Badge variant="secondary" className="text-[9px] h-6 px-2">
                {selectedVehicles.size} selecionado{selectedVehicles.size !== 1 ? 's' : ''}
              </Badge>
            )}
            <Button
              variant="outline" size="sm" className="h-8 text-xs px-2 gap-1"
              onClick={selectAllPending}
            >
              Selecionar Pendentes
            </Button>
            {selectedVehicles.size > 0 && (
              <>
                <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={clearSelection}>
                  Limpar
                </Button>
                <Button
                  size="sm" className="h-8 text-xs px-3 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setWhatsAppOpen(true)}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Legenda */}
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-500/80 inline-block" /> Preenchido
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500/80 inline-block" /> Pendente
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-muted inline-block border" /> Hoje/Futuro
          </span>
        </div>

        {/* Grupos colapsáveis */}
        <TooltipProvider delayDuration={200}>
          <div className="space-y-2">
            {groupedEquipment.map(([empresa, equips]) => {
              const groupPendCount = equips.reduce((s, eq) => s + getPendingDays(eq).length, 0);
              const isOpen = expandedGroups[empresa] ?? false;

              return (
                <Collapsible key={empresa} open={isOpen} onOpenChange={() => toggleGroup(empresa)}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/60 hover:bg-muted transition-colors text-left">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        <span className="font-bold text-sm tracking-wide uppercase text-foreground">{empresa}</span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                          {equips.length} veículo{equips.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {groupPendCount > 0 ? (
                        <Badge variant="destructive" className="text-[9px] px-2 py-0 h-4">
                          {groupPendCount} dia{groupPendCount !== 1 ? 's' : ''} pendente{groupPendCount !== 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge className="text-[9px] px-2 py-0 h-4 bg-emerald-500/20 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Em dia
                        </Badge>
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="overflow-x-auto border rounded-lg mt-1">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="sticky left-0 bg-muted/70 z-10 text-left px-2 py-1 font-semibold min-w-[180px] border-r text-foreground">
                              <div className="flex items-center gap-1.5">
                                <Checkbox
                                  checked={equips.every(eq => selectedVehicles.has(eq.prefixo))}
                                  onCheckedChange={(checked) => {
                                    setSelectedVehicles(prev => {
                                      const next = new Set(prev);
                                      equips.forEach(eq => { if (checked) next.add(eq.prefixo); else next.delete(eq.prefixo); });
                                      return next;
                                    });
                                  }}
                                  className="h-3 w-3"
                                />
                                Veículo
                              </div>
                            </th>
                            <th className="text-left px-1.5 py-1 font-semibold min-w-[90px] border-r text-muted-foreground">
                              Tipo
                            </th>
                            {dateColumns.map(d => {
                              const isToday = isSameDay(d, today);
                              const isSunday = d.getDay() === 0;
                              return (
                                <th
                                  key={d.toISOString()}
                                  className={`px-0.5 py-1 text-center min-w-[32px] font-medium ${
                                    isToday ? 'bg-primary/10 font-bold' : isSunday ? 'bg-destructive/5' : ''
                                  }`}
                                >
                                  <div className="leading-tight">
                                    <div className={`text-[8px] uppercase ${isSunday ? 'text-destructive' : 'text-muted-foreground'}`}>
                                      {format(d, 'EEE', { locale: ptBR })}
                                    </div>
                                    <div className={isToday ? 'text-primary font-bold' : 'text-foreground'}>
                                      {format(d, 'dd/MM')}
                                    </div>
                                  </div>
                                </th>
                              );
                            })}
                            <th className="px-1.5 py-1 text-center min-w-[40px] font-bold bg-muted/50 text-foreground">
                              Pend.
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {equips.map((eq, idx) => {
                            const pendDays = getPendingDays(eq);
                            return (
                              <tr key={eq.prefixo} className={`${idx % 2 === 0 ? 'bg-background' : 'bg-muted/15'} ${selectedVehicles.has(eq.prefixo) ? 'ring-1 ring-inset ring-primary/30' : ''}`}>
                                <td className="sticky left-0 bg-inherit z-10 px-2 py-1 border-r whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <Checkbox
                                      checked={selectedVehicles.has(eq.prefixo)}
                                      onCheckedChange={() => toggleVehicleSelection(eq.prefixo)}
                                      className="h-3 w-3"
                                    />
                                    <div>
                                      <div className="font-semibold text-[11px] text-foreground">{eq.prefixo}</div>
                                      <div className="text-muted-foreground truncate max-w-[130px]" title={eq.descricao}>
                                        {eq.descricao}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-1.5 py-1 border-r whitespace-nowrap text-muted-foreground text-[9px]">
                                  {eq.tipo}
                                </td>
                                {dateColumns.map(d => {
                                  const isTodayOrFuture = isSameDay(d, today) || isAfter(d, today);
                                  const key = `${normPrefixo(eq.prefixo)}|${format(d, 'yyyy-MM-dd')}`;
                                  const entry = entryMap.get(key);

                                  let cellClass = '';
                                  let label = '';

                                  if (isTodayOrFuture) {
                                    cellClass = 'bg-muted/30';
                                    label = isSameDay(d, today) ? '—' : '';
                                  } else if (!entry || (!entry.hasHorimetro && !entry.hasKm)) {
                                    cellClass = 'bg-destructive/15';
                                    label = '✕';
                                  } else {
                                    cellClass = 'bg-emerald-500/15';
                                    label = '✓';
                                  }

                                  return (
                                    <Tooltip key={d.toISOString()}>
                                      <TooltipTrigger asChild>
                                        <td className={`text-center py-1 px-0.5 cursor-default transition-colors ${cellClass}`}>
                                          <span className="text-[10px] font-semibold">{label}</span>
                                        </td>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        <p className="font-bold">{eq.prefixo} — {format(d, 'dd/MM/yyyy (EEEE)', { locale: ptBR })}</p>
                                        <p className="text-muted-foreground text-[10px]">{eq.descricao}</p>
                                        {isTodayOrFuture ? (
                                          <p>Dia atual/futuro</p>
                                        ) : !entry || (!entry.hasHorimetro && !entry.hasKm) ? (
                                          <p className="text-destructive font-semibold">⚠ Sem horímetro e sem Km</p>
                                        ) : (
                                          <p className="text-emerald-600">
                                            ✓ {entry.hasHorimetro ? 'Horímetro' : ''}{entry.hasHorimetro && entry.hasKm ? ' e ' : ''}{entry.hasKm ? 'Km' : ''} preenchido
                                          </p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                                <td className="text-center py-1 px-1 font-bold">
                                  {pendDays.length > 0 ? (
                                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                                      {pendDays.length}
                                    </Badge>
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
            {filteredEquipment.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">
                {filterMode === 'pending' ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <p className="font-medium">Todos os veículos estão em dia!</p>
                  </div>
                ) : (
                  'Nenhum equipamento encontrado'
                )}
              </div>
            )}
          </div>
        </TooltipProvider>
      </CardContent>

      {/* WhatsApp Modal */}
      <Dialog open={whatsAppOpen} onOpenChange={setWhatsAppOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Enviar Pendências via WhatsApp
            </DialogTitle>
            <DialogDescription>
              {selectedVehicles.size} veículo{selectedVehicles.size !== 1 ? 's' : ''} selecionado{selectedVehicles.size !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-muted/50 rounded-lg p-3 border">
              <Label className="text-xs text-muted-foreground mb-2 block">Prévia da mensagem:</Label>
              <Textarea
                value={generateWhatsAppMessage()}
                readOnly
                className="min-h-[220px] text-xs bg-background resize-none font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wpp-phone">Número do WhatsApp (opcional)</Label>
              <Input
                id="wpp-phone"
                placeholder="+55 82 99999-9999"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Deixe em branco para escolher o contato ao enviar.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopyMessage} className="flex-1 gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
              <Button onClick={handleSendWhatsApp} className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="w-4 h-4" />
                Enviar WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
