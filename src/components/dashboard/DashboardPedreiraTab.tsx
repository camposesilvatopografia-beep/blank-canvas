import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mountain, CalendarIcon, RefreshCw, Loader2, Truck, TrendingUp, Scale, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16'];
const PIE_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4', '#84cc16'];

/** Parse a number that may be in BR format (1.234,56) or plain (1234.56) */
const parseBRNum = (val: any): number => {
  const s = String(val || '0').trim();
  if (!s) return 0;
  // If it has both dot and comma, it's BR format: dot=thousands, comma=decimal
  if (s.includes(',') && s.includes('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // If it has only comma, treat comma as decimal
  if (s.includes(',')) {
    return parseFloat(s.replace(',', '.')) || 0;
  }
  // Plain number with dot as decimal
  return parseFloat(s) || 0;
};

interface MaterialStat {
  material: string;
  viagens: number;
  toneladas: number;
}

interface EmpresaStat {
  empresa: string;
  caminhoes: number;
  reboques: number;
  basculantes: number;
  viagens: number;
  toneladas: number;
}

export function DashboardPedreiraTab() {
  const { readSheet, loading } = useGoogleSheets();
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [allData, setAllData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  const [dayStats, setDayStats] = useState({ viagens: 0, toneladas: 0, veiculos: 0 });
  const [totalStats, setTotalStats] = useState({ viagens: 0, toneladas: 0 });
  const [monthStats, setMonthStats] = useState({ viagens: 0, toneladas: 0 });
  const [materialStatsDay, setMaterialStatsDay] = useState<MaterialStat[]>([]);
  const [empresaStatsDay, setEmpresaStatsDay] = useState<EmpresaStat[]>([]);
  const [materialStatsTotal, setMaterialStatsTotal] = useState<MaterialStat[]>([]);
  const [empresaStatsTotal, setEmpresaStatsTotal] = useState<EmpresaStat[]>([]);
  const [pivotData, setPivotData] = useState<{ empresa: string; byMaterial: Map<string, number>; total: number; viagens: number }[]>([]);
  const [pivotMaterials, setPivotMaterials] = useState<string[]>([]);
  const [dailyProduction, setDailyProduction] = useState<{ date: string; viagens: number; toneladas: number }[]>([]);
  const [monthlyPivot, setMonthlyPivot] = useState<{ mes: string; byMaterial: Map<string, number>; total: number; viagens: number }[]>([]);
  const [monthlyPivotMaterials, setMonthlyPivotMaterials] = useState<string[]>([]);

  useEffect(() => { loadData(); }, []);

  const parseDate = (dateStr: string) => {
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
  };

  const loadData = async () => {
    try {
      const data = await readSheet('Apontamento_Pedreira');
      if (data.length > 1) {
        const hdrs = data[0];
        setHeaders(hdrs);
        setAllData(data);

        const getIdx = (n: string) => hdrs.indexOf(n);
        // Helper to resolve Tonelada column with fallbacks (column may be renamed)
        const getTonIdx = () => {
          let idx = hdrs.indexOf('Tonelada');
          if (idx === -1) idx = hdrs.indexOf('Tonelada (ticket)');
          if (idx === -1) idx = hdrs.indexOf('Tonelada_Ticket');
          return idx;
        };
        const tonIdx = getTonIdx();
        const dateIdx = getIdx('Data');
        const statusIdx = hdrs.indexOf('Status');

        // Records without Status or with Status='Finalizado' or empty are considered finalized
        // (simple form entries don't have a Status column, cycle entries do)
        const isFinalizado = (row: any[]) => {
          if (statusIdx === -1) return true;
          const st = String(row[statusIdx] || '').trim().toLowerCase();
          // Empty status = direct entry (already finalized), or explicitly finalized
          return st === '' || st === 'finalizado';
        };

        const dates = [...new Set(data.slice(1).map(r => r[dateIdx]).filter(Boolean))];
        const sorted = dates.sort((a, b) => parseDate(b).getTime() - parseDate(a).getTime());
        setAvailableDates(sorted);
        if (sorted.length > 0 && !selectedDate) setSelectedDate(sorted[0]);

        // Total stats
        const finalized = data.slice(1).filter(isFinalizado);
        const totalViagens = finalized.length;
        const totalToneladas = finalized.reduce((s, r) =>
          s + parseBRNum(r[tonIdx]), 0);
        setTotalStats({ viagens: totalViagens, toneladas: totalToneladas });

        // Total period - by material
        const totalMatMap = new Map<string, MaterialStat>();
        finalized.forEach(r => {
          const mat = r[getIdx('Material')] || 'Outros';
          if (!totalMatMap.has(mat)) totalMatMap.set(mat, { material: mat, viagens: 0, toneladas: 0 });
          const s = totalMatMap.get(mat)!;
          s.viagens += 1;
          s.toneladas += parseBRNum(r[tonIdx]);
        });
        setMaterialStatsTotal(Array.from(totalMatMap.values()).sort((a, b) => b.toneladas - a.toneladas));

        // Total period - by empresa
        const totalEmpMap = new Map<string, { empresa: string; reboques: Set<string>; basculantes: Set<string>; viagens: number; toneladas: number }>();
        let descIdxLoad = getIdx('Descrição');
        if (descIdxLoad === -1) descIdxLoad = getIdx('Descricao');
        if (descIdxLoad === -1) descIdxLoad = getIdx('Descriçao');
        if (descIdxLoad === -1) descIdxLoad = hdrs.findIndex(h => String(h).toLowerCase().includes('descri'));
        finalized.forEach(r => {
          const emp = r[getIdx('Empresa_Eq')] || 'Outros';
          if (!totalEmpMap.has(emp)) totalEmpMap.set(emp, { empresa: emp, reboques: new Set(), basculantes: new Set(), viagens: 0, toneladas: 0 });
          const s = totalEmpMap.get(emp)!;
          s.viagens += 1;
          s.toneladas += parseBRNum(r[tonIdx]);
          const prefixo = r[getIdx('Prefixo_Eq')];
          const descricao = descIdxLoad >= 0 ? String(r[descIdxLoad] || '').trim().toLowerCase() : '';
          if (prefixo) {
            if (descricao.includes('reboque')) s.reboques.add(prefixo);
            else s.basculantes.add(prefixo);
          }
        });
        setEmpresaStatsTotal(Array.from(totalEmpMap.values()).map(e => ({
          empresa: e.empresa, caminhoes: e.reboques.size + e.basculantes.size, reboques: e.reboques.size, basculantes: e.basculantes.size, viagens: e.viagens, toneladas: e.toneladas,
        })).sort((a, b) => b.toneladas - a.toneladas));

        // Pivot: empresa x material (toneladas)
        const pivotMap = new Map<string, { empresa: string; byMaterial: Map<string, number>; total: number; viagens: number }>();
        const allMaterials = new Set<string>();
        finalized.forEach(r => {
          const emp = r[getIdx('Empresa_Eq')] || 'Outros';
          const mat = r[getIdx('Material')] || 'Outros';
          const ton = parseBRNum(r[tonIdx]);
          allMaterials.add(mat);
          if (!pivotMap.has(emp)) pivotMap.set(emp, { empresa: emp, byMaterial: new Map(), total: 0, viagens: 0 });
          const p = pivotMap.get(emp)!;
          p.byMaterial.set(mat, (p.byMaterial.get(mat) || 0) + ton);
          p.total += ton;
          p.viagens += 1;
        });
        const sortedMats = Array.from(allMaterials);
        setPivotMaterials(sortedMats);
        setPivotData(Array.from(pivotMap.values()).sort((a, b) => b.total - a.total));

        // Month stats
        const currentMonth = format(new Date(), 'MM/yyyy');
        const monthRows = finalized.filter(r => {
          const parts = r[dateIdx]?.split('/');
          return parts?.length >= 3 && `${parts[1]}/${parts[2]}` === currentMonth;
        });
        setMonthStats({
          viagens: monthRows.length,
          toneladas: monthRows.reduce((s, r) =>
            s + parseBRNum(r[tonIdx]), 0),
        });

        // Monthly pivot: month x material (toneladas)
        const monthPivotMap = new Map<string, { mes: string; byMaterial: Map<string, number>; total: number; viagens: number }>();
        const monthMaterials = new Set<string>();
        finalized.forEach(r => {
          const parts = r[dateIdx]?.split('/');
          if (!parts || parts.length < 3) return;
          const mesKey = `${parts[1]}/${parts[2]}`; // MM/yyyy
          const mat = r[getIdx('Material')] || 'Outros';
          const ton = parseBRNum(r[tonIdx]);
          monthMaterials.add(mat);
          if (!monthPivotMap.has(mesKey)) monthPivotMap.set(mesKey, { mes: mesKey, byMaterial: new Map(), total: 0, viagens: 0 });
          const p = monthPivotMap.get(mesKey)!;
          p.byMaterial.set(mat, (p.byMaterial.get(mat) || 0) + ton);
          p.total += ton;
          p.viagens += 1;
        });
        // Sort months chronologically
        const sortedMonthly = Array.from(monthPivotMap.values()).sort((a, b) => {
          const [ma, ya] = a.mes.split('/').map(Number);
          const [mb, yb] = b.mes.split('/').map(Number);
          return (ya * 12 + ma) - (yb * 12 + mb);
        });
        setMonthlyPivot(sortedMonthly);
        setMonthlyPivotMaterials(Array.from(monthMaterials));

        // Daily production (last 10 days)
        const last10 = sorted.slice(0, 10).reverse();
        const daily = last10.map(d => {
          const dayRows = finalized.filter(r => r[dateIdx] === d);
          return {
            date: d.substring(0, 5),
            viagens: dayRows.length,
            toneladas: Math.round(dayRows.reduce((s, r) =>
              s + parseBRNum(r[tonIdx]), 0)),
          };
        });
        setDailyProduction(daily);
      }
      setIsLoaded(true);
    } catch (error) {
      console.error('Error loading pedreira data:', error);
      setIsLoaded(true);
    }
  };

  // Process selected date
  useEffect(() => {
    if (!selectedDate || !allData.length || !headers.length) return;

    console.log('[DashboardPedreira] Headers:', headers);
    const getIdx = (n: string) => headers.indexOf(n);
    const dateIdx = getIdx('Data');
    const statusIdx = headers.indexOf('Status');
    // Resolve Tonelada column with fallbacks
    let tonIdx = headers.indexOf('Tonelada');
    if (tonIdx === -1) tonIdx = headers.indexOf('Tonelada (ticket)');
    if (tonIdx === -1) tonIdx = headers.indexOf('Tonelada_Ticket');

    const isFinalizado = (row: any[]) => {
      if (statusIdx === -1) return true;
      const st = String(row[statusIdx] || '').trim().toLowerCase();
      return st === '' || st === 'finalizado';
    };

    const dayRows = allData.slice(1).filter(r => r[dateIdx] === selectedDate && isFinalizado(r));

    const veiculos = new Set(dayRows.map(r => r[getIdx('Prefixo_Eq')]).filter(Boolean));
    const toneladas = dayRows.reduce((s, r) =>
      s + parseBRNum(r[tonIdx]), 0);

    setDayStats({ viagens: dayRows.length, toneladas, veiculos: veiculos.size });

    // Material stats
    const matMap = new Map<string, MaterialStat>();
    dayRows.forEach(r => {
      const mat = r[getIdx('Material')] || 'Outros';
      if (!matMap.has(mat)) matMap.set(mat, { material: mat, viagens: 0, toneladas: 0 });
      const s = matMap.get(mat)!;
      s.viagens += 1;
      s.toneladas += parseBRNum(r[tonIdx]);
    });
    setMaterialStatsDay(Array.from(matMap.values()).sort((a, b) => b.viagens - a.viagens));

    // Empresa stats
    const empMap = new Map<string, { empresa: string; reboques: Set<string>; basculantes: Set<string>; viagens: number; toneladas: number }>();
    dayRows.forEach(r => {
      const emp = r[getIdx('Empresa_Eq')] || 'Outros';
      if (!empMap.has(emp)) empMap.set(emp, { empresa: emp, reboques: new Set(), basculantes: new Set(), viagens: 0, toneladas: 0 });
      const s = empMap.get(emp)!;
      s.viagens += 1;
      s.toneladas += parseBRNum(r[tonIdx]);
      const prefixo = r[getIdx('Prefixo_Eq')];
      // Find Descrição column - try exact and fuzzy match
      let descIdx = getIdx('Descrição');
      if (descIdx === -1) descIdx = getIdx('Descricao');
      if (descIdx === -1) descIdx = getIdx('Descriçao');
      if (descIdx === -1) descIdx = headers.findIndex(h => String(h).toLowerCase().includes('descri'));
      const descricao = descIdx >= 0 ? String(r[descIdx] || '').trim().toLowerCase() : '';
      if (prefixo) {
        if (descricao.includes('reboque')) {
          s.reboques.add(prefixo);
        } else {
          s.basculantes.add(prefixo);
        }
      }
    });
    setEmpresaStatsDay(Array.from(empMap.values()).map(e => ({
      empresa: e.empresa, caminhoes: e.reboques.size + e.basculantes.size, reboques: e.reboques.size, basculantes: e.basculantes.size, viagens: e.viagens, toneladas: e.toneladas,
    })).sort((a, b) => b.toneladas - a.toneladas));
  }, [selectedDate, allData, headers]);

  const formatNumber = (num: number) => num.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mountain className="w-6 h-6 text-amber-600" />
          <div>
            <h2 className="text-lg font-bold">Dashboard Pedreira</h2>
            <p className="text-xs text-muted-foreground">Visão gerencial da produção de pedreira</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadData} disabled={loading} className="h-9 w-9">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ===== 1. DADOS DO DIA ===== */}
      <div className="bg-blue-50/60 dark:bg-blue-950/20 rounded-xl p-4 md:p-6 border border-blue-200/50 dark:border-blue-800/50 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Dados do Dia - {selectedDate}
          </h3>
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue placeholder="Data" />
            </SelectTrigger>
            <SelectContent>
              {availableDates.slice(0, 30).map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Daily KPI Cards */}
        <div className="grid gap-2.5 md:gap-4 grid-cols-3">
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
              <p className="text-[11px] md:text-sm font-medium text-amber-700 dark:text-amber-300 truncate">Viagens</p>
              <p className="text-xl md:text-3xl font-bold text-amber-700 dark:text-amber-200 leading-tight">{dayStats.viagens}</p>
              <p className="text-[10px] md:text-xs text-amber-600 dark:text-amber-400 truncate">{selectedDate}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
              <p className="text-[11px] md:text-sm font-medium text-muted-foreground truncate">Toneladas</p>
              <p className="text-xl md:text-3xl font-bold leading-tight">{formatNumber(dayStats.toneladas)}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">ton</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
              <p className="text-[11px] md:text-sm font-medium text-muted-foreground truncate">Veículos</p>
              <p className="text-xl md:text-3xl font-bold leading-tight">{dayStats.veiculos}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">ativos</p>
            </CardContent>
          </Card>
        </div>

        {/* Day Charts: Material + Empresa */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Material Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <Scale className="w-5 h-5 text-amber-600" />
                Distribuição por Material
              </CardTitle>
              <p className="text-xs text-muted-foreground">Toneladas em {selectedDate}</p>
            </CardHeader>
            <CardContent>
              {materialStatsDay.length > 0 ? (
                <div className="h-[320px] md:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={materialStatsDay.map(m => ({ name: m.material, value: Math.round(m.toneladas) }))}
                        cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value"
                        label={({ name, percent, value, cx: pcx, cy: pcy, midAngle, outerRadius: or }) => {
                          const RADIAN = Math.PI / 180;
                          const radius = (or as number) + 25;
                          const x = (pcx as number) + radius * Math.cos(-midAngle * RADIAN);
                          const y = (pcy as number) + radius * Math.sin(-midAngle * RADIAN);
                          const anchor = x > (pcx as number) ? 'start' : 'end';
                          return (
                            <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={anchor} dominantBaseline="central" fontSize={11}>
                              {`${name} (${(percent * 100).toFixed(0)}%) - ${value} t`}
                            </text>
                          );
                        }}
                        labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}>
                        {materialStatsDay.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} t`, 'Toneladas']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">Nenhum dado</p>
              )}
            </CardContent>
          </Card>

          {/* Empresa Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <Building2 className="w-5 h-5 text-amber-600" />
                Produção por Empresa
              </CardTitle>
              <p className="text-xs text-muted-foreground">Toneladas em {selectedDate}</p>
            </CardHeader>
            <CardContent>
              {empresaStatsDay.length > 0 ? (
                <div className="space-y-4">
                  <div style={{ height: Math.max(200, empresaStatsDay.length * 50) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={empresaStatsDay} layout="vertical" margin={{ top: 5, right: 50, left: 80, bottom: 5 }}>
                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="empresa" fontSize={12} tickLine={false} axisLine={false} width={75} />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            name === 'toneladas' ? `${Math.round(value)} t` : `${value} viag.`,
                            name === 'toneladas' ? 'Toneladas' : 'Viagens'
                          ]}
                          contentStyle={{ fontSize: '12px' }}
                        />
                        <Bar dataKey="toneladas" fill="#10b981" radius={[0, 4, 4, 0]} barSize={22}
                          label={({ x, y, width, height, value }: any) => (
                            <text x={x + width + 5} y={y + height / 2 + 4} fontSize={10} fontWeight="bold" fill="#666">{Math.round(value)} t</text>
                          )} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs font-semibold">Empresa</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Basculantes</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Reboques</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Viagens</TableHead>
                          <TableHead className="text-xs font-semibold text-center">Total Veículos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {empresaStatsDay.map(e => (
                          <TableRow key={e.empresa}>
                            <TableCell className="text-xs font-medium">{e.empresa}</TableCell>
                            <TableCell className="text-xs text-center">{e.basculantes}</TableCell>
                            <TableCell className="text-xs text-center">{e.reboques}</TableCell>
                            <TableCell className="text-xs text-center">{e.viagens}</TableCell>
                            <TableCell className="text-xs text-center font-bold">{e.caminhoes}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2 bg-muted/30">
                          <TableCell className="text-xs font-bold">Total</TableCell>
                          <TableCell className="text-xs text-center font-bold">{empresaStatsDay.reduce((s, e) => s + e.basculantes, 0)}</TableCell>
                          <TableCell className="text-xs text-center font-bold">{empresaStatsDay.reduce((s, e) => s + e.reboques, 0)}</TableCell>
                          <TableCell className="text-xs text-center font-bold">{empresaStatsDay.reduce((s, e) => s + e.viagens, 0)}</TableCell>
                          <TableCell className="text-xs text-center font-bold">{empresaStatsDay.reduce((s, e) => s + e.caminhoes, 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-12">Nenhum dado</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== 2. RESUMO MENSAL ===== */}
      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl p-4 md:p-6 border border-emerald-200/50 dark:border-emerald-800/50 space-y-4">
        <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          Resumo Mensal
        </h3>

        {/* Monthly KPI Cards */}
        <div className="grid gap-2.5 md:gap-4 grid-cols-2">
          <Card>
            <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
              <p className="text-[11px] md:text-sm font-medium text-muted-foreground truncate">Viagens (Mês Atual)</p>
              <p className="text-xl md:text-3xl font-bold leading-tight">{monthStats.viagens}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">{format(new Date(), 'MMMM/yyyy', { locale: ptBR })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
              <p className="text-[11px] md:text-sm font-medium text-muted-foreground truncate">Toneladas (Mês Atual)</p>
              <p className="text-xl md:text-3xl font-bold leading-tight">{formatNumber(monthStats.toneladas)}</p>
              <p className="text-[10px] md:text-xs text-muted-foreground">ton</p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Pivot: Mês x Material */}
        {monthlyPivot.length > 0 && (
          <Card>
            <CardHeader className="pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm flex items-center gap-2 flex-wrap">
                <Scale className="w-4 h-4 text-amber-600" />
                Produção Mensal por Material (t)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 p-2 md:p-6 md:pt-0">
              <div className="border rounded-lg overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-[10px] md:text-xs font-semibold border-r min-w-[60px] md:min-w-[80px] px-1.5 md:px-4">Mês</TableHead>
                      {monthlyPivotMaterials.map(mat => (
                        <TableHead key={mat} className="text-[10px] md:text-xs font-semibold text-center border-r whitespace-nowrap px-1 md:px-4">{mat} (t)</TableHead>
                      ))}
                      <TableHead className="text-[10px] md:text-xs font-semibold text-center border-r px-1 md:px-4">Viagens</TableHead>
                      <TableHead className="text-[10px] md:text-xs font-semibold text-center bg-primary/10 px-1 md:px-4">Total (t)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyPivot.map(row => (
                      <TableRow key={row.mes}>
                        <TableCell className="text-[10px] md:text-xs font-medium border-r px-1.5 md:px-4 py-1.5">{row.mes}</TableCell>
                        {monthlyPivotMaterials.map(mat => (
                          <TableCell key={mat} className="text-[10px] md:text-xs text-center tabular-nums border-r px-1 md:px-4 py-1.5">
                            {(row.byMaterial.get(mat) || 0) > 0 ? formatNumber(row.byMaterial.get(mat) || 0) : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-[10px] md:text-xs text-center tabular-nums border-r font-medium px-1 md:px-4 py-1.5">{row.viagens}</TableCell>
                        <TableCell className="text-[10px] md:text-xs text-center tabular-nums font-bold bg-primary/5 px-1 md:px-4 py-1.5">{formatNumber(row.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2 bg-muted/30">
                      <TableCell className="text-[10px] md:text-xs font-bold border-r px-1.5 md:px-4 py-1.5">Total</TableCell>
                      {monthlyPivotMaterials.map(mat => (
                        <TableCell key={mat} className="text-[10px] md:text-xs text-center tabular-nums font-bold border-r px-1 md:px-4 py-1.5">
                          {formatNumber(monthlyPivot.reduce((s, r) => s + (r.byMaterial.get(mat) || 0), 0))}
                        </TableCell>
                      ))}
                      <TableCell className="text-[10px] md:text-xs text-center tabular-nums font-bold border-r px-1 md:px-4 py-1.5">{monthlyPivot.reduce((s, r) => s + r.viagens, 0)}</TableCell>
                      <TableCell className="text-[10px] md:text-xs text-center tabular-nums font-bold bg-primary/10 px-1 md:px-4 py-1.5">{formatNumber(monthlyPivot.reduce((s, r) => s + r.total, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Production Chart */}
        {dailyProduction.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <TrendingUp className="w-5 h-5 text-amber-600" />
                Produção Diária (Últimos {dailyProduction.length} dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] md:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyProduction} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(value: number) => [`${value} ton`, 'Toneladas']} contentStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="toneladas" fill="#10b981" radius={[4, 4, 0, 0]} label={({ x, y, width, value }: any) => (<text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#666">{value} t</text>)} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ===== 3. PERÍODO TOTAL ===== */}
      <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-xl p-4 md:p-6 border border-amber-200/50 dark:border-amber-800/50 space-y-4">
        <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Período Total
          {availableDates.length > 0 && (
            <Badge variant="outline" className="text-[10px] font-normal ml-2">
              {availableDates[availableDates.length - 1]} a {availableDates[0]}
            </Badge>
          )}
        </h3>

        {/* Pivot Table: Empresa x Material */}
        <Card>
          <CardHeader className="pb-2 p-3 md:p-6">
            <CardTitle className="text-xs md:text-sm flex items-center gap-2 flex-wrap">
              <Scale className="w-4 h-4 text-amber-600" />
              Produção por Empresa e Material
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 p-2 md:p-6 md:pt-0">
            <div className="border rounded-lg overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-[10px] md:text-xs font-semibold border-r min-w-[60px] md:min-w-[80px] px-1.5 md:px-4">Empresa</TableHead>
                    {pivotMaterials.map(mat => (
                      <TableHead key={mat} className="text-[10px] md:text-xs font-semibold text-center border-r whitespace-nowrap px-1 md:px-4">{mat} (t)</TableHead>
                    ))}
                    <TableHead className="text-[10px] md:text-xs font-semibold text-center border-r px-1 md:px-4">Viagens</TableHead>
                    <TableHead className="text-[10px] md:text-xs font-semibold text-center bg-primary/10 px-1 md:px-4">Total (t)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pivotData.map(row => (
                    <TableRow key={row.empresa}>
                      <TableCell className="text-[10px] md:text-xs font-medium border-r px-1.5 md:px-4 py-1.5">{row.empresa}</TableCell>
                      {pivotMaterials.map(mat => (
                        <TableCell key={mat} className="text-[10px] md:text-xs text-center tabular-nums border-r px-1 md:px-4 py-1.5">
                          {(row.byMaterial.get(mat) || 0) > 0 ? formatNumber(row.byMaterial.get(mat) || 0) : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-[10px] md:text-xs text-center tabular-nums border-r font-medium px-1 md:px-4 py-1.5">{row.viagens}</TableCell>
                      <TableCell className="text-[10px] md:text-xs text-center tabular-nums font-bold bg-primary/5 px-1 md:px-4 py-1.5">{formatNumber(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  {pivotData.length > 0 && (
                    <TableRow className="font-bold border-t-2 bg-muted/30">
                      <TableCell className="text-[10px] md:text-xs font-bold border-r px-1.5 md:px-4 py-1.5">Total</TableCell>
                      {pivotMaterials.map(mat => (
                        <TableCell key={mat} className="text-[10px] md:text-xs text-center tabular-nums font-bold border-r px-1 md:px-4 py-1.5">
                          {formatNumber(pivotData.reduce((s, r) => s + (r.byMaterial.get(mat) || 0), 0))}
                        </TableCell>
                      ))}
                      <TableCell className="text-[10px] md:text-xs text-center tabular-nums font-bold border-r px-1 md:px-4 py-1.5">{totalStats.viagens}</TableCell>
                      <TableCell className="text-[10px] md:text-xs text-center tabular-nums font-bold bg-primary/10 px-1 md:px-4 py-1.5">{formatNumber(totalStats.toneladas)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
