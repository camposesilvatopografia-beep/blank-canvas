import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, List, MapPin, Search, Truck, X, ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MonitoramentoRecord {
  data: string;
  hora: string;
  escavadeira: string;
  potencia: string;
  descricao: string;
  caminhao: string;
  estaca: string;
  material: string;
  usuario: string;
  observacao: string;
  local: string;
}

interface TreeNode {
  label: string;
  count: number;
  children?: TreeNode[];
}

interface Props {
  allData: any[][];
  headers: string[];
}

const PAGE_SIZE = 200;

const parseDateDesc = (a: string, b: string) => {
  const [da, ma, ya] = a.split('/').map(Number);
  const [db, mb, yb] = b.split('/').map(Number);
  return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
};

export function CargaMonitoramentoTab({ allData, headers }: Props) {
  // Today in DD/MM/YYYY
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }, []);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('__today__');
  const [localFilter, setLocalFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState(0);
  const [resumoDate, setResumoDate] = useState<string>('latest');

  const getIdx = useCallback((name: string) => headers.indexOf(name), [headers]);

  // Parse all records
  const allRecords = useMemo(() => {
    if (!allData || allData.length < 2 || !headers.length) return [];

    const idxMap = {
      data: getIdx('Data'),
      hora: getIdx('Hora_Carga'),
      escavadeira: getIdx('Prefixo_Eq'),
      potencia: getIdx('Potencia') !== -1 ? getIdx('Potencia') : getIdx('Volume'),
      descricao: getIdx('Descricao_Eq'),
      caminhao: getIdx('Prefixo_Cb'),
      estaca: getIdx('Estaca'),
      material: getIdx('Material'),
      usuario: getIdx('Usuario'),
      observacao: getIdx('Observacao'),
      local: getIdx('Local_da_Obra'),
    };

    const records: MonitoramentoRecord[] = [];
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      const data = row[idxMap.data] || '';
      if (!data) continue;
      records.push({
        data,
        hora: row[idxMap.hora] || '',
        escavadeira: row[idxMap.escavadeira] || '',
        potencia: row[idxMap.potencia] || '',
        descricao: row[idxMap.descricao] || '',
        caminhao: row[idxMap.caminhao] || '',
        estaca: row[idxMap.estaca] || '',
        material: row[idxMap.material] || '',
        usuario: idxMap.usuario !== -1 ? (row[idxMap.usuario] || '') : '',
        observacao: idxMap.observacao !== -1 ? (row[idxMap.observacao] || '') : '',
        local: row[idxMap.local] || '',
      });
    }
    return records;
  }, [allData, headers, getIdx]);

  // Unique locals for filter
  const uniqueLocals = useMemo(() => {
    const locals = new Set<string>();
    for (const r of allRecords) locals.add(r.local || 'Sem Local');
    return Array.from(locals).sort();
  }, [allRecords]);

  // Available dates (sorted descending) for resumo filter
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    for (const r of allRecords) if (r.data) dates.add(r.data);
    return Array.from(dates).sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number);
      const [db, mb, yb] = b.split('/').map(Number);
      return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
    });
  }, [allRecords]);

  // Selected resumo date
  const selectedResumoDate = resumoDate === 'latest' ? (availableDates[0] || '') : resumoDate;

  // Filtered records
  const filteredRecords = useMemo(() => {
    let records = allRecords;
    if (localFilter !== 'todos') {
      records = records.filter(r => (r.local || 'Sem Local') === localFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      records = records.filter(r =>
        r.escavadeira.toLowerCase().includes(q) ||
        r.caminhao.toLowerCase().includes(q) ||
        r.material.toLowerCase().includes(q)
      );
    }
    return records;
  }, [allRecords, localFilter, searchQuery]);

  // Summary: excavator positions for selected date
  const escavadeiraResumo = useMemo(() => {
    if (!selectedResumoDate || !allRecords.length) return [];
    const dayRecords = allRecords.filter(r => r.data === selectedResumoDate);
    // Get latest record per excavator on that day
    const seen = new Map<string, { local: string; material: string; hora: string; count: number }>();
    // Count all records per excavator, but track latest position
    const counts = new Map<string, number>();
    for (const r of dayRecords) {
      if (!r.escavadeira) continue;
      counts.set(r.escavadeira, (counts.get(r.escavadeira) || 0) + 1);
    }
    // Iterate backwards for most recent
    for (let i = dayRecords.length - 1; i >= 0; i--) {
      const r = dayRecords[i];
      if (r.escavadeira && !seen.has(r.escavadeira)) {
        seen.set(r.escavadeira, {
          local: r.local || 'Sem Local',
          material: r.material || '-',
          hora: r.hora,
          count: counts.get(r.escavadeira) || 0,
        });
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allRecords, selectedResumoDate]);

  // Build tree
  const tree = useMemo(() => {
    const dateMap = new Map<string, Map<string, Map<string, Map<string, number>>>>();
    const dateCounts = new Map<string, number>();

    for (const r of filteredRecords) {
      dateCounts.set(r.data, (dateCounts.get(r.data) || 0) + 1);
      if (!dateMap.has(r.data)) dateMap.set(r.data, new Map());
      const matMap = dateMap.get(r.data)!;
      const mat = r.material || 'Sem Material';
      if (!matMap.has(mat)) matMap.set(mat, new Map());
      const locMap = matMap.get(mat)!;
      const loc = r.local || 'Sem Local';
      if (!locMap.has(loc)) locMap.set(loc, new Map());
      const eqMap = locMap.get(loc)!;
      const eq = r.escavadeira || 'Sem Equip.';
      eqMap.set(eq, (eqMap.get(eq) || 0) + 1);
    }

    const sortedDates = Array.from(dateMap.keys()).sort(parseDateDesc);

    return sortedDates.map(date => {
      const matMap = dateMap.get(date)!;
      const matChildren: TreeNode[] = Array.from(matMap.entries()).map(([mat, locMap]) => {
        let matCount = 0;
        const locChildren: TreeNode[] = Array.from(locMap.entries()).map(([loc, eqMap]) => {
          let locCount = 0;
          const eqChildren: TreeNode[] = Array.from(eqMap.entries()).map(([eq, count]) => {
            locCount += count;
            return { label: eq, count };
          });
          matCount += locCount;
          return { label: loc, count: locCount, children: eqChildren };
        });
        return { label: mat, count: matCount, children: locChildren };
      });
      return { label: date, count: dateCounts.get(date) || 0, children: matChildren };
    });
  }, [filteredRecords]);

  // Display records for selected node
  // Resolve the effective date for today filter
  const effectiveTodayDate = useMemo(() => {
    // Check if today exists in data; if not, use most recent date
    const hasToday = filteredRecords.some(r => r.data === todayStr);
    if (hasToday) return todayStr;
    return availableDates[0] || todayStr;
  }, [filteredRecords, todayStr, availableDates]);

  const displayRecords = useMemo(() => {
    if (selectedFilter === 'all') return filteredRecords;
    if (selectedFilter === '__today__') {
      return filteredRecords.filter(r => r.data === effectiveTodayDate);
    }
    const parts = selectedFilter.split('|||');
    let records = filteredRecords;
    if (parts[0]) records = records.filter(r => r.data === parts[0]);
    if (parts[1]) records = records.filter(r => (r.material || 'Sem Material') === parts[1]);
    if (parts[2]) records = records.filter(r => (r.local || 'Sem Local') === parts[2]);
    if (parts[3]) records = records.filter(r => (r.escavadeira || 'Sem Equip.') === parts[3]);
    return records;
  }, [selectedFilter, filteredRecords, effectiveTodayDate]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(displayRecords.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedRecords = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return displayRecords.slice(start, start + PAGE_SIZE);
  }, [displayRecords, safePage]);

  // Reset page when filters change
  const resetFilters = useCallback(() => {
    setSelectedFilter('__today__');
    setSelectedNodeKey(null);
    setPage(0);
  }, []);

  const toggleNode = useCallback((key: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectNode = useCallback((filterKey: string) => {
    setSelectedFilter(filterKey);
    setSelectedNodeKey(filterKey);
    setPage(0);
  }, []);

  const renderTreeNode = (node: TreeNode, depth: number, parentKey: string) => {
    const nodeKey = parentKey ? `${parentKey}|||${node.label}` : node.label;
    const isExpanded = expandedNodes.has(nodeKey);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNodeKey === nodeKey;

    const colors = [
      'text-foreground font-semibold',
      'text-amber-700 dark:text-amber-400 font-medium',
      'text-blue-700 dark:text-blue-400',
      'text-emerald-700 dark:text-emerald-400',
    ];

    return (
      <div key={nodeKey}>
        <div
          className={cn(
            'flex items-center gap-1 py-1.5 px-2 cursor-pointer rounded-sm text-sm hover:bg-muted/60 transition-colors',
            isSelected && 'bg-primary/10 border-l-2 border-primary',
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) toggleNode(nodeKey);
            selectNode(nodeKey);
          }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className={cn('truncate', colors[depth] || 'text-foreground')}>{node.label}</span>
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-5 shrink-0">
            {node.count}
          </Badge>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderTreeNode(child, depth + 1, nodeKey))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Resumo: Escavadeiras do dia */}
      {availableDates.length > 0 && (
        <div className="border rounded-lg bg-card p-3">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <Truck className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Posição das Escavadeiras</span>
            <Select value={resumoDate} onValueChange={setResumoDate}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Mais recente</SelectItem>
                {availableDates.map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-[10px]">{escavadeiraResumo.length} escavadeiras</Badge>
          </div>
          {escavadeiraResumo.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {escavadeiraResumo.map(([eq, info]) => (
                <div
                  key={eq}
                  className="flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/60 transition-colors"
                  onClick={() => { setSearchQuery(eq); resetFilters(); }}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">{eq}</span>
                      <span className="text-[10px] text-muted-foreground">→</span>
                      <span className="text-xs font-medium text-foreground truncate">{info.local}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{info.material}</Badge>
                      <span className="text-[10px] text-muted-foreground">{info.hora}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{info.count} viagens</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma escavadeira registrada nesta data.</p>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Local:</span>
        </div>
        <Select value={localFilter} onValueChange={(v) => { setLocalFilter(v); resetFilters(); }}>
          <SelectTrigger className="w-[220px] h-9 text-sm">
            <SelectValue placeholder="Todos os locais" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os locais</SelectItem>
            {uniqueLocals.map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar equipamento, caminhão ou material..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetFilters(); }}
            className="pl-8 h-9 w-[300px] text-sm"
          />
        </div>
        {(localFilter !== 'todos' || searchQuery.trim()) && (
          <button
            onClick={() => { setLocalFilter('todos'); setSearchQuery(''); resetFilters(); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
        <Badge variant="outline" className="text-xs">{filteredRecords.length} registros</Badge>
      </div>

      <div className="flex gap-3 h-[calc(100vh-380px)] min-h-[400px]">
        {/* Tree Panel */}
        <div className="w-64 lg:w-72 shrink-0 border rounded-lg bg-card overflow-hidden flex flex-col">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 border-b cursor-pointer hover:bg-muted/40 transition-colors',
              selectedFilter === '__today__' && 'bg-primary/10',
            )}
            onClick={() => { setSelectedFilter('__today__'); setSelectedNodeKey(null); setPage(0); }}
          >
            <List className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Hoje ({effectiveTodayDate})</span>
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {filteredRecords.filter(r => r.data === effectiveTodayDate).length}
            </Badge>
          </div>
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 border-b cursor-pointer hover:bg-muted/40 transition-colors',
              selectedFilter === 'all' && 'bg-primary/10',
            )}
            onClick={() => { setSelectedFilter('all'); setSelectedNodeKey(null); setPage(0); }}
          >
            <List className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Todos</span>
            <Badge variant="secondary" className="ml-auto text-[10px]">{filteredRecords.length}</Badge>
          </div>
          <ScrollArea className="flex-1">
            <div className="py-1">
              {tree.map(node => renderTreeNode(node, 0, ''))}
            </div>
          </ScrollArea>
        </div>

        {/* Records Table */}
        <div className="flex-1 border rounded-lg bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {selectedFilter === '__today__' ? `Registros de ${effectiveTodayDate}` : selectedFilter === 'all' ? 'Todos os registros' : selectedFilter.split('|||').filter(Boolean).join(' › ')}
            </span>
            <Badge variant="outline" className="ml-auto">{displayRecords.length} registros</Badge>
          </div>
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Data</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Hora da Carga</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Escavadeira</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Potência</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Descrição</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Caminhão</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Estaca</TableHead>
                  <TableHead className="text-[11px] px-2 py-2 whitespace-nowrap">Material</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map((r, idx) => (
                    <TableRow key={`${safePage}-${idx}`} className="hover:bg-muted/30">
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap">{r.data}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap text-amber-600 font-medium">{r.hora}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap text-orange-600 font-semibold">{r.escavadeira}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap">{r.potencia}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 max-w-[140px] truncate">{r.descricao}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap text-blue-600 font-semibold">{r.caminhao}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap">{r.estaca}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 whitespace-nowrap">{r.material}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20">
              <span className="text-xs text-muted-foreground">
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, displayRecords.length)} de {displayRecords.length}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-medium px-2">{safePage + 1} / {totalPages}</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
