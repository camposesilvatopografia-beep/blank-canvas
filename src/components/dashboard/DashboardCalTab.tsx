import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { FlaskConical, CalendarIcon, RefreshCw, Loader2, Package, ArrowDown, ArrowUp, Filter, Truck, AlertCircle } from 'lucide-react';

interface CalStats {
  estoqueAnterior: number;
  entradasDia: number;
  saidasDia: number;
  estoqueAtual: number;
  totalEntradas: number;
  totalSaidas: number;
}

interface Movimentacao {
  data: string;
  hora: string;
  tipo: string;
  fornecedor: string;
  local: string;
  qtd: number;
  status: string;
  veiculo: string;
  pesoBruto: number;
  pesoVazio: number;
  qtdBalancaObra: number;
}

export function DashboardCalTab() {
  const { readSheet, loading } = useGoogleSheets();
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [stats, setStats] = useState<CalStats>({
    estoqueAnterior: 0, entradasDia: 0, saidasDia: 0, estoqueAtual: 0, totalEntradas: 0, totalSaidas: 0,
  });
  const [allMovData, setAllMovData] = useState<any[][]>([]);
  const [movHeaders, setMovHeaders] = useState<string[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [filteredMovimentacoes, setFilteredMovimentacoes] = useState<Movimentacao[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [estoqueHistorico, setEstoqueHistorico] = useState<any[]>([]);
  const [emAbertoCount, setEmAbertoCount] = useState(0);
  const [emAbertoRecords, setEmAbertoRecords] = useState<Movimentacao[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Auto-refresh: load on mount + poll every 30s while tab is active
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (!document.hidden) loadData();
    }, 30000);
    const handleVisibility = () => { if (!document.hidden) loadData(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const loadData = async () => {
    try {
      const [movData, estoqueData] = await Promise.all([
        readSheet('Mov_Cal'),
        readSheet('Estoque_Cal'),
      ]);

      if (movData.length > 1) {
        const headers = movData[0];
        setMovHeaders(headers);
        setAllMovData(movData);
        const getIdx = (n: string) => headers.indexOf(n);
        const dateIdx = getIdx('Data');

        const dates = [...new Set(movData.slice(1).map(r => r[dateIdx]).filter(Boolean))];
        const sorted = dates.sort((a, b) => {
          const [da, ma, ya] = a.split('/').map(Number);
          const [db, mb, yb] = b.split('/').map(Number);
          return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        });
        setAvailableDates(sorted);
        if (sorted.length > 0 && !selectedDate) setSelectedDate(sorted[0]);

        const allRecords = movData.slice(1).map(row => ({
          tipo: String(row[getIdx('Tipo')] || '').toLowerCase(),
          qtd: parseFloat(String(row[getIdx('Qtd')] || 0).replace('.', '').replace(',', '.')),
          status: String(row[getIdx('Status')] || '').toLowerCase(),
          data: row[getIdx('Data')] || '',
          hora: row[getIdx('Hora')] || '',
          fornecedor: row[getIdx('Fornecedor')] || '',
          local: row[getIdx('Local')] || '',
          veiculo: row[getIdx('Veiculo')] || '',
        }));
        const totalEntradas = allRecords.filter(r => r.tipo === 'entrada').reduce((s, r) => s + r.qtd, 0);
        const totalSaidas = allRecords.filter(r => r.tipo === 'saida' || r.tipo === 'saída').reduce((s, r) => s + r.qtd, 0);
        const openRecords = allRecords.filter(r => r.status.includes('aberto'));
        setEmAbertoCount(openRecords.length);
        setEmAbertoRecords(openRecords.map(r => ({
          data: r.data,
          hora: r.hora,
          tipo: r.tipo,
          fornecedor: r.fornecedor,
          local: r.local,
          qtd: r.qtd,
          status: r.status,
          veiculo: r.veiculo,
          pesoBruto: 0,
          pesoVazio: 0,
          qtdBalancaObra: 0,
        })));
        setStats(prev => ({ ...prev, totalEntradas, totalSaidas }));
      }

      if (estoqueData.length > 1) {
        const headers = estoqueData[0];
        const getIdx = (n: string) => headers.indexOf(n);
        const records = estoqueData.slice(1).map(row => ({
          data: row[getIdx('Data')] || '',
          estoqueAnterior: parseFloat(String(row[getIdx('EstoqueAnterior')] || 0).replace('.', '').replace(',', '.')),
          entrada: parseFloat(String(row[getIdx('Entrada')] || 0).replace('.', '').replace(',', '.')),
          saida: parseFloat(String(row[getIdx('Saida')] || 0).replace('.', '').replace(',', '.')),
          estoqueAtual: parseFloat(String(row[getIdx('EstoqueAtual')] || 0).replace('.', '').replace(',', '.')),
        }));
        setEstoqueHistorico(records);
      }

      setIsLoaded(true);
    } catch (error) {
      console.error('Error loading CAL data:', error);
      setIsLoaded(true);
    }
  };

  const processDataForDate = useCallback((dateStr: string) => {
    if (!allMovData.length || !movHeaders.length || !dateStr) return;

    const getIdx = (name: string) => movHeaders.indexOf(name);
    const normalize = (s: string) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    const getIdxNorm = (name: string) => {
      const norm = normalize(name);
      const idx = movHeaders.findIndex((h: string) => normalize(h) === norm);
      if (idx >= 0) return idx;
      return movHeaders.findIndex((h: string) => normalize(h).includes(norm) || norm.includes(normalize(h)));
    };
    const parseBR = (val: any): number => {
      if (!val) return 0;
      return parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    };

    const dayRecords = allMovData.slice(1)
      .filter(row => row[getIdx('Data')] === dateStr)
      .map(row => ({
        data: row[getIdx('Data')] || '',
        hora: row[getIdx('Hora')] || '',
        tipo: row[getIdx('Tipo')] || '',
        fornecedor: row[getIdx('Fornecedor')] || '',
        local: row[getIdx('Local')] || '',
        qtd: parseFloat(String(row[getIdx('Qtd')] || 0).replace('.', '').replace(',', '.')) || 0,
        status: row[getIdx('Status')] || '',
        veiculo: row[getIdx('Veiculo')] || '',
        pesoBruto: (() => {
          const idx1 = getIdxNorm('PesoCarregado');
          const idx2 = getIdxNorm('PesoDeChegada');
          const idx3 = getIdxNorm('PesoChegada');
          const idx = idx1 >= 0 ? idx1 : (idx2 >= 0 ? idx2 : (idx3 >= 0 ? idx3 : -1));
          return parseBR(idx >= 0 ? row[idx] : undefined);
        })(),
        pesoVazio: (() => {
          const idx = getIdxNorm('PesoVazio');
          return parseBR(idx >= 0 ? row[idx] : undefined);
        })(),
        qtdBalancaObra: (() => {
          // Try multiple normalized header names for "Qtd Balança Obra"
          const tryNames = ['QtdBalancaObra', 'QtdBalançaObra', 'Qtd Balança Obra', 'Qtd Balanca Obra'];
          let idx = -1;
          for (const name of tryNames) {
            idx = getIdxNorm(name);
            if (idx >= 0) break;
          }
          // Fallback: search any header containing "balan" and "obra"
          if (idx < 0) {
            idx = movHeaders.findIndex((h: string) => {
              const n = normalize(h);
              return n.includes('balanc') && n.includes('obra');
            });
          }
          const val = idx >= 0 ? parseBR(row[idx]) : 0;
          return val;
        })(),
      }));

    setMovimentacoes(dayRecords);

    const entradasDia = dayRecords.filter(r => r.tipo.toLowerCase() === 'entrada').reduce((sum, r) => sum + r.qtd, 0);
    const saidasDia = dayRecords.filter(r => r.tipo.toLowerCase() === 'saida' || r.tipo.toLowerCase() === 'saída').reduce((sum, r) => sum + r.qtd, 0);

    const dayEstoque = estoqueHistorico.find(r => r.data === dateStr);
    const estoqueAnterior = dayEstoque?.estoqueAnterior || 0;
    const estoqueAtual = estoqueAnterior + entradasDia - saidasDia;

    setStats(prev => ({
      ...prev,
      estoqueAnterior,
      entradasDia,
      saidasDia,
      estoqueAtual,
    }));
  }, [allMovData, movHeaders, estoqueHistorico]);

  useEffect(() => {
    if (selectedDate && isLoaded) {
      processDataForDate(selectedDate);
    }
  }, [selectedDate, isLoaded, processDataForDate]);

  useEffect(() => {
    if (tipoFiltro === 'todos') {
      setFilteredMovimentacoes(movimentacoes);
    } else if (tipoFiltro === 'entrada') {
      setFilteredMovimentacoes(movimentacoes.filter(m => m.tipo.toLowerCase() === 'entrada'));
    } else {
      setFilteredMovimentacoes(movimentacoes.filter(m => m.tipo.toLowerCase() === 'saida' || m.tipo.toLowerCase() === 'saída'));
    }
  }, [movimentacoes, tipoFiltro]);

  const formatNumber = (num: number) => num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <FlaskConical className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
          <div>
            <h2 className="text-base md:text-lg font-bold">Dashboard CAL</h2>
            <p className="text-[10px] md:text-xs text-muted-foreground">Visão gerencial do estoque de cal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-[140px] md:w-[160px] h-8 md:h-9 text-xs md:text-sm">
              <CalendarIcon className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5" />
              <SelectValue placeholder="Data" />
            </SelectTrigger>
            <SelectContent>
              {availableDates.slice(0, 30).map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadData} disabled={loading} className="h-8 w-8 md:h-9 md:w-9">
            <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Total Entradas e Saídas Período */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-emerald-700 text-white dark:bg-emerald-800">
          <CardContent className="p-3 md:pt-6 md:pb-5 md:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium opacity-90">Total Entradas</p>
                <p className="text-xl md:text-2xl font-bold">{formatNumber(stats.totalEntradas)} ton</p>
              </div>
              <div className="p-1.5 md:p-2 bg-white/20 rounded-lg">
                <ArrowDown className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Em Aberto Banner */}
      {emAbertoCount > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
          <CardContent className="p-3 md:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2 bg-amber-200 dark:bg-amber-800 rounded-lg">
                  <Truck className="w-4 h-4 md:w-5 md:h-5 text-amber-700 dark:text-amber-300" />
                </div>
                <div>
                  <p className="text-xs md:text-sm font-bold text-amber-800 dark:text-amber-200">
                    {emAbertoCount} caminhão{emAbertoCount > 1 ? 'ões' : ''} aguardando finalização
                  </p>
                  <p className="text-[10px] md:text-xs text-amber-600 dark:text-amber-400">
                    Entradas com pesagem pendente de saída
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-amber-500 animate-pulse" />
                <Badge className="bg-amber-500 text-white text-xs md:text-sm font-bold">{emAbertoCount}</Badge>
              </div>
            </div>
            {/* Lista de pendentes */}
            <div className="space-y-1.5">
              {emAbertoRecords.map((rec, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white dark:bg-amber-900/30 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-700">
                  <div className="flex items-center gap-2">
                    <Truck className="w-3.5 h-3.5 text-amber-600" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                        {rec.veiculo || 'Sem placa'}
                      </p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        {rec.data} às {rec.hora} • {rec.fornecedor}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 dark:text-amber-300">
                    {formatNumber(rec.qtd)} ton
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-2.5 md:gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-3 md:pt-6 md:px-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] md:text-sm font-medium text-muted-foreground truncate">Estoque Anterior</p>
                <p className="text-xl md:text-2xl font-bold leading-tight">{formatNumber(stats.estoqueAnterior)}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">toneladas</p>
              </div>
              <div className="p-1.5 md:p-2 bg-muted rounded-lg hidden md:block shrink-0">
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="p-3 md:pt-6 md:px-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] md:text-sm font-medium text-green-700 dark:text-green-300 truncate">Entradas do Dia</p>
                <p className="text-xl md:text-2xl font-bold text-green-700 dark:text-green-200 leading-tight">{formatNumber(stats.entradasDia)}</p>
                <p className="text-[10px] md:text-xs text-green-600 dark:text-green-400">toneladas</p>
              </div>
              <div className="p-1.5 md:p-2 bg-green-200 dark:bg-green-800 rounded-lg hidden md:block shrink-0">
                <ArrowDown className="w-5 h-5 text-green-700 dark:text-green-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="p-3 md:pt-6 md:px-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] md:text-sm font-medium text-red-700 dark:text-red-300 truncate">Saídas do Dia</p>
                <p className="text-xl md:text-2xl font-bold text-red-700 dark:text-red-200 leading-tight">{formatNumber(stats.saidasDia)}</p>
                <p className="text-[10px] md:text-xs text-red-600 dark:text-red-400">toneladas</p>
              </div>
              <div className="p-1.5 md:p-2 bg-red-200 dark:bg-red-800 rounded-lg hidden md:block shrink-0">
                <ArrowUp className="w-5 h-5 text-red-700 dark:text-red-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-3 md:pt-6 md:px-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] md:text-sm font-medium opacity-80 truncate">Estoque Atual</p>
                <p className="text-xl md:text-2xl font-bold leading-tight">{formatNumber(stats.estoqueAtual)}</p>
                <p className="text-[10px] md:text-xs opacity-70">toneladas</p>
              </div>
              <div className="p-1.5 md:p-2 bg-white/20 rounded-lg hidden md:block shrink-0">
                <Package className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Movimentações do Dia */}
      <Card>
        <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              Movimentações do Dia
              <Button variant="ghost" size="icon" onClick={loadData} disabled={loading} className="h-6 w-6 ml-1">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
              <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as 'todos' | 'entrada' | 'saida')}>
                <SelectTrigger className="w-[120px] md:w-[150px] h-7 md:h-8 text-xs md:text-sm">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">
                    <span className="flex items-center gap-2">
                      <ArrowDown className="w-3 h-3 text-green-600" />
                      Entradas
                    </span>
                  </SelectItem>
                  <SelectItem value="saida">
                    <span className="flex items-center gap-2">
                      <ArrowUp className="w-3 h-3 text-red-600" />
                      Saídas
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 p-2 md:p-6 md:pt-0">
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/10">
                  <TableHead className="text-[10px] md:text-xs px-1.5 md:px-4 min-w-[60px] text-foreground font-bold">DATA</TableHead>
                  <TableHead className="text-[10px] md:text-xs px-1.5 md:px-4 min-w-[45px] text-foreground font-bold">HORA</TableHead>
                  <TableHead className="text-[10px] md:text-xs px-1.5 md:px-4 min-w-[60px] text-foreground font-bold">TIPO</TableHead>
                   <TableHead className="text-[10px] md:text-xs px-1.5 md:px-4 min-w-[80px] text-foreground font-bold">LOCAL/FORNECEDOR</TableHead>
                   <TableHead className="text-[10px] md:text-xs px-1.5 md:px-4 min-w-[50px] text-right text-foreground font-bold">Quantidade (t)</TableHead>
                   <TableHead className="text-[10px] md:text-xs px-1.5 md:px-4 min-w-[60px] text-right text-foreground font-bold">PESO CALC. OBRA<br/><span className="font-normal text-muted-foreground">(Chegada - Saída)</span></TableHead>
                   <TableHead className="text-[10px] md:text-xs px-1.5 md:px-4 min-w-[70px] text-center text-foreground font-bold">STATUS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovimentacoes.map((mov, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-[10px] md:text-xs px-1.5 md:px-4 py-2">{mov.data}</TableCell>
                    <TableCell className="text-[10px] md:text-xs px-1.5 md:px-4 py-2">{mov.hora}</TableCell>
                    <TableCell className="text-[10px] md:text-xs px-1.5 md:px-4 py-2">
                      <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[9px] md:text-xs font-medium ${
                        mov.tipo.toLowerCase() === 'entrada'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {mov.tipo}
                      </span>
                    </TableCell>
                    <TableCell className="text-[10px] md:text-xs px-1.5 md:px-4 py-2">
                      {mov.tipo.toLowerCase() === 'entrada' ? mov.fornecedor : (mov.local || mov.fornecedor)}
                    </TableCell>
                    <TableCell className="text-[10px] md:text-xs px-1.5 md:px-4 py-2 text-right tabular-nums">{formatNumber(mov.qtd)}</TableCell>
                    <TableCell className="text-[10px] md:text-xs px-1.5 md:px-4 py-2 text-right tabular-nums">
                      {mov.tipo.toLowerCase() === 'entrada' ? (() => {
                        // Use qtdBalancaObra from sheet column H; fallback to manual calc if empty
                        let pesoCalc = mov.qtdBalancaObra;
                        if (!pesoCalc && mov.pesoBruto > 0 && mov.pesoVazio > 0) {
                          const diffRaw = mov.pesoBruto - mov.pesoVazio;
                          pesoCalc = diffRaw > 100 ? diffRaw / 1000 : diffRaw;
                        }
                        if (pesoCalc <= 0) return <span className="text-muted-foreground">—</span>;
                        const diff = mov.qtd > 0 ? Math.abs(pesoCalc - mov.qtd) / mov.qtd : 0;
                        const isDivergent = mov.qtd > 0 && diff > 0.05;
                        return (
                          <span className={`font-medium ${isDivergent ? 'text-red-600 bg-red-50 px-1 py-0.5 rounded' : 'text-emerald-700'}`} title={isDivergent ? `Divergência de ${(diff * 100).toFixed(1)}%` : ''}>
                            {formatNumber(pesoCalc)}
                            {isDivergent && ' ⚠️'}
                          </span>
                        );
                      })() : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-[10px] md:text-xs px-1.5 md:px-4 py-2 text-center">
                      {mov.status ? (
                        <Badge variant={mov.status.toLowerCase().includes('aberto') ? 'outline' : 'default'}
                          className={mov.status.toLowerCase().includes('aberto')
                            ? 'border-amber-400 text-amber-700 bg-amber-50 text-[9px] md:text-xs'
                            : 'bg-emerald-600 text-white text-[9px] md:text-xs'
                          }>
                          {mov.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[9px]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMovimentacoes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6 md:py-8 text-xs">
                      {tipoFiltro === 'todos'
                        ? 'Nenhuma movimentação encontrada para esta data'
                        : `Nenhuma ${tipoFiltro === 'entrada' ? 'entrada' : 'saída'} encontrada para esta data`
                      }
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
