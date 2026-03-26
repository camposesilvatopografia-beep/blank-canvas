import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Droplets, CalendarIcon, RefreshCw, Loader2, Truck, MapPin, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PipaRecord {
  data: string;
  prefixo: string;
  empresa: string;
  capacidade: number;
  viagens: number;
  tipoLocal: string;
}

const COLORS = ['#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444'];
const PIE_COLORS = ['#0ea5e9', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

export function DashboardPipasTab() {
  const { readSheet, loading } = useGoogleSheets();
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [records, setRecords] = useState<PipaRecord[]>([]);
  const [allRecords, setAllRecords] = useState<PipaRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    try {
      const rows = await readSheet('Apontamento_Pipa');
      if (!rows || rows.length < 2) return;

      const headers = rows[0].map((h: string) => h?.toString().trim().toLowerCase() || '');
      const dataIdx = headers.findIndex((h: string) => h.includes('data'));
      const prefixoIdx = headers.findIndex((h: string) => h.includes('prefixo') || h.includes('veículo') || h.includes('veiculo'));
      const empresaIdx = headers.findIndex((h: string) => h.includes('empresa'));
      const capIdx = headers.findIndex((h: string) => h.includes('capacidade'));
      const viagensIdx = headers.findIndex((h: string) => h.includes('viagen') || h.includes('viagem'));
      const tipoLocalIdx = headers.findIndex((h: string) => h.includes('local de trabalho') || h.includes('tipo local') || h.includes('local'));

      if (dataIdx === -1) return;

      const parsed: PipaRecord[] = [];
      const datesSet = new Set<string>();

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[dataIdx]) continue;
        const data = row[dataIdx]?.toString().trim();
        if (!data) continue;
        datesSet.add(data);

        parsed.push({
          data,
          prefixo: prefixoIdx >= 0 ? row[prefixoIdx]?.toString().trim() || '' : '',
          empresa: empresaIdx >= 0 ? row[empresaIdx]?.toString().trim() || '' : '',
          capacidade: capIdx >= 0 ? Number(row[capIdx]) || 0 : 0,
          viagens: viagensIdx >= 0 ? Number(row[viagensIdx]) || 0 : 0,
          tipoLocal: tipoLocalIdx >= 0 ? row[tipoLocalIdx]?.toString().trim() || '' : '',
        });
      }

      const sortedDates = Array.from(datesSet).sort((a, b) => {
        try {
          const [da, ma, ya] = a.split('/').map(Number);
          const [db, mb, yb] = b.split('/').map(Number);
          return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
        } catch { return 0; }
      });

      setAvailableDates(sortedDates);
      setAllRecords(parsed);
      if (sortedDates.length > 0) {
        const latest = sortedDates[0];
        setSelectedDate(latest);
        setRecords(parsed.filter(r => r.data === latest));
      }
      setIsLoaded(true);
    } catch (err) {
      console.error('Erro ao carregar dados de Pipas:', err);
    }
  }, [readSheet]);

  useEffect(() => {
    if (selectedDate && allRecords.length > 0) {
      setRecords(allRecords.filter(r => r.data === selectedDate));
    }
  }, [selectedDate, allRecords]);

  const stats = useMemo(() => {
    const pipas = new Set(records.map(r => r.prefixo));
    const totalViagens = records.reduce((sum, r) => sum + r.viagens, 0);
    const volumeAgua = records.reduce((sum, r) => sum + (r.capacidade * r.viagens), 0);
    return { pipasAtivas: pipas.size, totalViagens, volumeAgua };
  }, [records]);

  const monthStats = useMemo(() => {
    if (!selectedDate) return { viagens: 0, pipas: 0 };
    const parts = selectedDate.split('/');
    if (parts.length < 3) return { viagens: 0, pipas: 0 };
    const [, mes, ano] = parts;
    const monthRecords = allRecords.filter(r => {
      const p = r.data.split('/');
      return p.length >= 3 && p[1] === mes && p[2] === ano;
    });
    const pipas = new Set(monthRecords.map(r => r.prefixo));
    return {
      viagens: monthRecords.reduce((s, r) => s + r.viagens, 0),
      pipas: pipas.size,
    };
  }, [selectedDate, allRecords]);

  const allPipas = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach(r => {
      map.set(r.prefixo, (map.get(r.prefixo) || 0) + r.viagens);
    });
    return Array.from(map.entries())
      .map(([name, viagens]) => ({ name, viagens }))
      .sort((a, b) => b.viagens - a.viagens);
  }, [records]);

  const localDist = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach(r => {
      const local = r.tipoLocal || 'Sem local';
      map.set(local, (map.get(local) || 0) + r.viagens);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [records]);

  const pipasPorLocal = useMemo(() => {
    const map = new Map<string, { prefixo: string; empresa: string; viagens: number; capacidade: number }[]>();
    records.forEach(r => {
      const local = r.tipoLocal || 'Sem local';
      if (!map.has(local)) map.set(local, []);
      const existing = map.get(local)!.find(p => p.prefixo === r.prefixo);
      if (existing) {
        existing.viagens += r.viagens;
      } else {
        map.get(local)!.push({ prefixo: r.prefixo, empresa: r.empresa, viagens: r.viagens, capacidade: r.capacidade });
      }
    });
    // Sort pipas within each local by viagens desc
    map.forEach((pipas) => pipas.sort((a, b) => b.viagens - a.viagens));
    return map;
  }, [records]);

  const producaoDiaria = useMemo(() => {
    if (!selectedDate) return [];
    const parts = selectedDate.split('/');
    if (parts.length < 3) return [];
    const [, mes, ano] = parts;
    const monthRecords = allRecords.filter(r => {
      const p = r.data.split('/');
      return p.length >= 3 && p[1] === mes && p[2] === ano;
    });
    const map = new Map<string, number>();
    monthRecords.forEach(r => {
      map.set(r.data, (map.get(r.data) || 0) + r.viagens);
    });
    return Array.from(map.entries())
      .map(([date, viagens]) => ({ date: date.substring(0, 5), viagens }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedDate, allRecords]);

  const formatNumber = (n: number) => n.toLocaleString('pt-BR');

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3">
          <Droplets className="w-5 h-5 md:w-6 md:h-6 text-cyan-600" />
          <div>
            <h2 className="text-base md:text-xl font-bold">Dashboard Pipas</h2>
            <p className="text-[10px] md:text-sm text-muted-foreground">Visão geral das operações de Pipas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-[140px] md:w-[180px] h-8 md:h-9 text-xs md:text-sm">
              <CalendarIcon className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5" />
              <SelectValue placeholder="Selecione a data" />
            </SelectTrigger>
            <SelectContent>
              {availableDates.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadData} disabled={loading} className="h-8 w-8 md:h-9 md:w-9">
            {loading ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-2.5 md:gap-4 grid-cols-2 md:grid-cols-5">
        <Card className="bg-cyan-600 text-white border-none">
          <CardContent className="p-3 md:p-4">
            <p className="text-[11px] md:text-xs font-medium opacity-90 truncate">Pipas Ativas</p>
            <p className="text-xl md:text-3xl font-bold leading-tight">{stats.pipasAtivas}</p>
            <p className="text-[10px] md:text-xs opacity-75">no dia</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-[11px] md:text-xs font-medium text-muted-foreground truncate">Viagens do Dia</p>
            <p className="text-xl md:text-3xl font-bold leading-tight">{formatNumber(stats.totalViagens)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <p className="text-[11px] md:text-xs font-medium text-muted-foreground truncate">Volume Est. (L)</p>
            <p className="text-xl md:text-3xl font-bold leading-tight">{formatNumber(stats.volumeAgua)}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="p-3 md:p-4">
            <p className="text-[11px] md:text-xs font-medium text-muted-foreground truncate">Viagens no Mês</p>
            <p className="text-xl md:text-3xl font-bold text-green-700 leading-tight">{formatNumber(monthStats.viagens)}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 col-span-2 md:col-span-1">
          <CardContent className="p-3 md:p-4">
            <p className="text-[11px] md:text-xs font-medium text-muted-foreground truncate">Pipas no Mês</p>
            <p className="text-xl md:text-3xl font-bold text-blue-700 leading-tight">{monthStats.pipas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Dados do Dia - {selectedDate}
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        {/* All Pipas */}
        <Card>
          <CardHeader className="pb-2 p-3 md:p-6">
            <CardTitle className="flex items-center gap-2 text-xs md:text-sm">
              <Truck className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-600" />
              Pipas - Viagens
            </CardTitle>
            <p className="text-[10px] md:text-xs text-muted-foreground">{selectedDate}</p>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0 md:pt-0">
            {allPipas.length > 0 ? (
              <div style={{ height: Math.max(200, allPipas.length * 26) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={allPipas} layout="vertical" margin={{ top: 5, right: 25, left: 40, bottom: 5 }}>
                    <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={40} />
                    <Tooltip formatter={(value: number) => [`${value} viagens`, 'Viagens']} contentStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="viagens" radius={[0, 4, 4, 0]} barSize={18} label={{ position: 'right', fontSize: 9, fill: '#666' }}>
                      {allPipas.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8 md:py-12 text-xs">Nenhum dado</p>
            )}
          </CardContent>
        </Card>

        {/* Daily production */}
        <Card>
          <CardHeader className="pb-2 p-3 md:p-6">
            <CardTitle className="flex items-center gap-2 text-xs md:text-sm">
              <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-600" />
              Produção Diária (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0 md:pt-0">
            {producaoDiaria.length > 0 ? (
              <div className="h-[200px] md:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={producaoDiaria} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="date" fontSize={9} tickLine={false} />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value: number) => [`${value} viagens`, 'Viagens']} contentStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="viagens" fill="#0ea5e9" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 8, fill: '#666' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8 md:py-12 text-xs">Nenhum dado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables by Local - side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        {localDist.map((local, idx) => {
          const pipas = pipasPorLocal.get(local.name) || [];
          const totalViagens = pipas.reduce((s, p) => s + p.viagens, 0);
          return (
            <Card key={local.name}>
              <CardHeader className="pb-2 p-3 md:p-6">
                <CardTitle className="flex items-center justify-between text-xs md:text-sm">
                  <span className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4" style={{ color: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    {local.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px] md:text-xs">
                    {totalViagens} viagens
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 md:p-6 pt-0 md:pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] md:text-xs h-8">Prefixo</TableHead>
                      <TableHead className="text-[10px] md:text-xs h-8">Empresa</TableHead>
                      <TableHead className="text-[10px] md:text-xs h-8 text-right">Cap. (L)</TableHead>
                      <TableHead className="text-[10px] md:text-xs h-8 text-right">Viagens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pipas.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-[10px] md:text-xs py-1.5 font-medium">{p.prefixo}</TableCell>
                        <TableCell className="text-[10px] md:text-xs py-1.5 text-muted-foreground">{p.empresa}</TableCell>
                        <TableCell className="text-[10px] md:text-xs py-1.5 text-right">{formatNumber(p.capacidade)}</TableCell>
                        <TableCell className="text-[10px] md:text-xs py-1.5 text-right font-semibold">{p.viagens}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {pipas.length === 0 && (
                  <p className="text-muted-foreground text-center py-4 text-xs">Nenhuma pipa</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {localDist.length === 0 && (
          <Card className="col-span-2">
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center text-xs">Nenhum dado de distribuição por local</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
