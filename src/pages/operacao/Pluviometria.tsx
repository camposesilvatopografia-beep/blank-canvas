import { useState, useEffect, useMemo } from 'react';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CloudRain, Plus, Trash2, RefreshCw, Droplets, TrendingUp, Calendar, FileText, Download, CloudSun, Sun, Cloud, CloudDrizzle, CloudLightning, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DeleteConfirmDialog } from '@/components/crud/DeleteConfirmDialog';
import { PluviometriaPdfExport } from '@/components/reports/PluviometriaPdfExport';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, ComposedChart, Legend, Cell, PieChart, Pie } from 'recharts';

interface PluviometriaRow {
  rowIndex: number;
  data: string;
  quantidade: number;
  acumulado: number;
  // parsed date parts
  dia: number;
  mes: number;
  ano: number;
}

function parseDateBR(dateStr: string): { dia: number; mes: number; ano: number } | null {
  // dd/MM/yyyy
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return { dia: parseInt(parts[0]), mes: parseInt(parts[1]), ano: parseInt(parts[2]) };
  }
  return null;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Maragogi-AL coordinates
const MARAGOGI_LAT = -9.0122;
const MARAGOGI_LON = -35.2225;

interface ForecastDay {
  date: string;
  dayLabel: string;
  tempMin: number;
  tempMax: number;
  precipitation: number;
  precipitationProb: number;
  weatherCode: number;
}

interface HourlyForecast {
  time: string;
  hourLabel: string;
  temperature: number;
  precipitation: number;
  precipitationProb: number;
  weatherCode: number;
}

function getWeatherIcon(code: number, size: 'sm' | 'md' = 'md') {
  const cls = size === 'sm' ? 'w-5 h-5' : 'w-8 h-8';
  if (code <= 1) return <Sun className={`${cls} text-amber-400`} />;
  if (code <= 3) return <CloudSun className={`${cls} text-muted-foreground`} />;
  if (code <= 48) return <Cloud className={`${cls} text-muted-foreground`} />;
  if (code <= 67) return <CloudDrizzle className={`${cls} text-blue-400`} />;
  if (code <= 77) return <CloudRain className={`${cls} text-blue-500`} />;
  if (code <= 82) return <CloudRain className={`${cls} text-blue-600`} />;
  return <CloudLightning className={`${cls} text-purple-500`} />;
}

function getWeatherLabel(code: number) {
  if (code <= 0) return 'Céu limpo';
  if (code <= 1) return 'Poucas nuvens';
  if (code <= 2) return 'Parcialmente nublado';
  if (code <= 3) return 'Nublado';
  if (code <= 48) return 'Nevoeiro';
  if (code <= 55) return 'Garoa';
  if (code <= 57) return 'Garoa congelante';
  if (code <= 65) return 'Chuva';
  if (code <= 67) return 'Chuva congelante';
  if (code <= 77) return 'Neve';
  if (code <= 82) return 'Pancadas de chuva';
  if (code <= 86) return 'Neve forte';
  return 'Tempestade';
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function PrevisaoTempoPanel() {
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [loadingForecast, setLoadingForecast] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchForecast = async () => {
    setLoadingForecast(true);
    setError('');
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${MARAGOGI_LAT}&longitude=${MARAGOGI_LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&hourly=temperature_2m,precipitation,precipitation_probability,weather_code&timezone=America/Maceio&forecast_days=7`
      );
      if (!res.ok) throw new Error('Erro ao buscar previsão');
      const data = await res.json();
      const days: ForecastDay[] = data.daily.time.map((d: string, i: number) => {
        const dateObj = new Date(d + 'T12:00:00');
        return {
          date: d,
          dayLabel: `${DIAS_SEMANA[dateObj.getDay()]} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`,
          tempMin: data.daily.temperature_2m_min[i],
          tempMax: data.daily.temperature_2m_max[i],
          precipitation: data.daily.precipitation_sum[i],
          precipitationProb: data.daily.precipitation_probability_max[i],
          weatherCode: data.daily.weather_code[i],
        };
      });
      setForecast(days);

      const nowIso = new Date().toISOString();
      const hourlyData: HourlyForecast[] = [];
      for (let i = 0; i < data.hourly.time.length && hourlyData.length < 24; i++) {
        if (data.hourly.time[i] >= nowIso.substring(0, 13) || hourlyData.length > 0) {
          const dt = new Date(data.hourly.time[i]);
          hourlyData.push({
            time: data.hourly.time[i],
            hourLabel: `${dt.getHours().toString().padStart(2, '0')}h`,
            temperature: data.hourly.temperature_2m[i],
            precipitation: data.hourly.precipitation[i],
            precipitationProb: data.hourly.precipitation_probability[i],
            weatherCode: data.hourly.weather_code[i],
          });
        }
      }
      setHourly(hourlyData);
      setLastUpdate(new Date());
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar previsão');
    }
    setLoadingForecast(false);
  };

  useEffect(() => {
    fetchForecast();
    const interval = setInterval(fetchForecast, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const maxPrecipDay = useMemo(() => {
    if (!forecast.length) return -1;
    let maxIdx = 0;
    forecast.forEach((d, i) => {
      if (d.precipitation > forecast[maxIdx].precipitation) maxIdx = i;
    });
    return forecast[maxIdx].precipitation > 0 ? maxIdx : -1;
  }, [forecast]);

  if (loadingForecast && !forecast.length) {
    return (
      <Card><CardContent className="p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
        <p className="text-sm text-muted-foreground">Carregando previsão do tempo...</p>
      </CardContent></Card>
    );
  }

  if (error && !forecast.length) {
    return (
      <Card><CardContent className="p-8 text-center text-destructive">
        <CloudRain className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{error}</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CloudSun className="w-5 h-5 text-primary" />
              Previsão do Tempo — Maragogi, AL
            </h3>
            <div className="flex items-center gap-3">
              {lastUpdate && (
                <p className="text-[10px] text-muted-foreground">
                  Atualizado: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Auto 30min
                </p>
              )}
              <a
                href="https://www.climatempo.com.br/previsao-do-tempo/15-dias/cidade/198/maragogi-al"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                ClimaTempo
              </a>
              <Button variant="outline" size="sm" onClick={fetchForecast} disabled={loadingForecast} className="gap-1 text-xs h-7">
                <RefreshCw className={`w-3 h-3 ${loadingForecast ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* 7-day cards */}
          <div className="grid grid-cols-7 gap-2">
            {forecast.map((day, i) => {
              const isMaxRain = i === maxPrecipDay;
              return (
                <Card key={day.date} className={`relative transition-all ${isMaxRain ? 'ring-2 ring-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' : ''}`}>
                  {isMaxRain && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                      ⚠ Mais chuva
                    </div>
                  )}
                  <CardContent className="p-3 text-center space-y-2">
                    <p className="text-xs font-semibold">{day.dayLabel}</p>
                    <div className="flex justify-center">{getWeatherIcon(day.weatherCode)}</div>
                    <p className="text-[10px] text-muted-foreground">{getWeatherLabel(day.weatherCode)}</p>
                    <div className="text-xs">
                      <span className="text-blue-500 font-medium">{day.tempMin.toFixed(0)}°</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-red-500 font-medium">{day.tempMax.toFixed(0)}°</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1">
                        <Droplets className="w-3 h-3 text-blue-400" />
                        <span className={`text-xs font-bold ${day.precipitation > 10 ? 'text-blue-600' : day.precipitation > 0 ? 'text-blue-400' : 'text-muted-foreground'}`}>
                          {day.precipitation.toFixed(1)} mm
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${day.precipitationProb > 60 ? 'bg-blue-500' : day.precipitationProb > 30 ? 'bg-blue-300' : 'bg-muted-foreground/30'}`} style={{ width: `${Math.min(day.precipitationProb, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{day.precipitationProb}% chance</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Hourly 24h */}
      {hourly.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Previsão Horária — Próximas 24h
            </h3>
            <div className="overflow-x-auto">
              <div className="flex gap-1.5 min-w-max pb-2">
                {hourly.map((h, i) => (
                  <div key={i} className={`flex flex-col items-center p-2 rounded-lg min-w-[56px] ${h.precipitation > 0 ? 'bg-blue-500/10' : 'bg-muted/50'}`}>
                    <span className="text-[10px] font-medium">{h.hourLabel}</span>
                    <div className="my-1">{getWeatherIcon(h.weatherCode, 'sm')}</div>
                    <span className="text-xs font-semibold">{h.temperature.toFixed(0)}°</span>
                    {h.precipitation > 0 && (
                      <span className="text-[10px] text-blue-500 font-bold">{h.precipitation.toFixed(1)}mm</span>
                    )}
                    <span className="text-[9px] text-muted-foreground">{h.precipitationProb}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={150}>
                <ComposedChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="hourLabel" tick={{ fontSize: 9 }} interval={2} />
                  <YAxis yAxisId="precip" tick={{ fontSize: 9 }} label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <YAxis yAxisId="temp" orientation="right" tick={{ fontSize: 9 }} label={{ value: '°C', angle: 90, position: 'insideRight', fontSize: 10 }} />
                  <Tooltip formatter={(v: number, name: string) => [name === 'Temp' ? `${v.toFixed(1)}°C` : `${v.toFixed(1)} mm`, name]} />
                  <Bar yAxisId="precip" dataKey="precipitation" fill="hsl(210, 80%, 55%)" radius={[3, 3, 0, 0]} name="Chuva" />
                  <Line yAxisId="temp" dataKey="temperature" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Temp" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {forecast.filter(d => d.precipitation >= 25).length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-destructive mb-3">
              <AlertTriangle className="w-5 h-5" />
              Alerta de Chuva Forte
            </h3>
            <div className="space-y-2">
              {forecast.filter(d => d.precipitation >= 25).map(day => (
                <div key={day.date} className="flex items-center gap-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <CloudRain className="w-5 h-5 text-destructive shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{day.dayLabel} — <span className="text-destructive font-bold">{day.precipitation.toFixed(1)} mm</span></p>
                    <p className="text-xs text-muted-foreground">
                      {day.precipitation >= 50 ? '🔴 Chuva muito forte — risco de paralisação' : '🟠 Chuva forte — possível impacto nas operações'}
                      {' · '}{day.precipitationProb}% probabilidade
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {forecast.filter(d => d.precipitation >= 10 && d.precipitation < 25).length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-600 mb-3">
              <AlertTriangle className="w-4 h-4" />
              Atenção — Chuva Moderada
            </h3>
            <div className="space-y-1.5">
              {forecast.filter(d => d.precipitation >= 10 && d.precipitation < 25).map(day => (
                <div key={day.date} className="flex items-center gap-2 text-sm">
                  <Droplets className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{day.dayLabel} — <strong>{day.precipitation.toFixed(1)} mm</strong> ({day.precipitationProb}% chance)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 7-day bar chart */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Precipitação Prevista — Próximos 7 dias</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={forecast}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="dayLabel" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v} mm`, 'Precipitação prevista']} />
              <Bar dataKey="precipitation" name="Precipitação (mm)" radius={[4, 4, 0, 0]}>
                {forecast.map((d, i) => (
                  <Cell key={i} fill={i === maxPrecipDay ? 'hsl(210, 80%, 50%)' : 'hsl(var(--primary))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Pluviometria() {
  const { loading, readSheet, appendSheet, deleteRow } = useGoogleSheets();
  const [rows, setRows] = useState<PluviometriaRow[]>([]);
  const [fetching, setFetching] = useState(false);

  // Form
  const [novaData, setNovaData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [novaQuantidade, setNovaQuantidade] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<PluviometriaRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const now = new Date();
  const [filterMes, setFilterMes] = useState(now.getMonth() + 1);
  const [filterAno, setFilterAno] = useState(now.getFullYear());

  const fetchData = async () => {
    setFetching(true);
    const data = await readSheet('Pluviometria');
    if (data && data.length > 1) {
      const parsed: PluviometriaRow[] = data.slice(1).map((r, i) => {
        const dateStr = r[0] || '';
        const p = parseDateBR(dateStr);
        return {
          rowIndex: i + 2,
          data: dateStr,
          quantidade: parseFloat(r[1]) || 0,
          acumulado: parseFloat(r[2]) || 0,
          dia: p?.dia || 0,
          mes: p?.mes || 0,
          ano: p?.ano || 0,
        };
      }).filter(r => r.data);
      setRows(parsed);
    } else {
      setRows([]);
    }
    setFetching(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!novaData || !novaQuantidade) {
      toast.error('Preencha a data e a quantidade');
      return;
    }
    setSaving(true);
    const qty = parseFloat(novaQuantidade) || 0;
    const novaDateObj = new Date(novaData + 'T12:00:00');
    const novaMes = novaDateObj.getMonth() + 1;
    const novaAno = novaDateObj.getFullYear();
    const acumuladoMesAtual = rows
      .filter(r => r.mes === novaMes && r.ano === novaAno)
      .reduce((sum, r) => sum + r.quantidade, 0);
    const novoAcumulado = acumuladoMesAtual + qty;
    const dataFormatada = format(novaDateObj, 'dd/MM/yyyy');
    const success = await appendSheet('Pluviometria', [[dataFormatada, qty, novoAcumulado]]);
    if (success) {
      toast.success('Registro adicionado!');
      setNovaQuantidade('');
      await fetchData();
    } else {
      toast.error('Erro ao salvar registro');
    }
    setSaving(false);
  };

  const handleDeleteClick = (row: PluviometriaRow) => {
    setRowToDelete(row);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!rowToDelete) return;
    setDeleting(true);
    const success = await deleteRow('Pluviometria', rowToDelete.rowIndex);
    if (success) {
      toast.success('Registro excluído');
      await fetchData();
    } else {
      toast.error('Erro ao excluir');
    }
    setDeleting(false);
    setDeleteOpen(false);
    setRowToDelete(null);
  };

  // Filtered rows by month/year
  const filteredRows = useMemo(() => {
    return rows.filter(r => r.mes === filterMes && r.ano === filterAno);
  }, [rows, filterMes, filterAno]);

  // Available years
  const availableYears = useMemo(() => {
    const years = [...new Set(rows.map(r => r.ano).filter(y => y > 0))];
    if (!years.includes(now.getFullYear())) years.push(now.getFullYear());
    return years.sort((a, b) => b - a);
  }, [rows]);

  // Monthly accumulated map (progressive within each month)
  const acumuladoMensalMap = useMemo(() => {
    const map = new Map<number, number>();
    let acum = 0;
    filteredRows.forEach((r, i) => {
      acum += r.quantidade;
      map.set(i, parseFloat(acum.toFixed(1)));
    });
    return map;
  }, [filteredRows]);

  // Monthly KPIs
  const acumuladoMes = filteredRows.reduce((s, r) => s + r.quantidade, 0);
  const diasComChuva = filteredRows.filter(r => r.quantidade > 0).length;
  const maiorPrecipitacao = filteredRows.length > 0 ? Math.max(...filteredRows.map(r => r.quantidade)) : 0;
  const mediaDiariaMes = filteredRows.length > 0 ? acumuladoMes / filteredRows.length : 0;

  // Global stats
  const totalAcumulado = rows.reduce((s, r) => s + r.quantidade, 0);

  // Chart data for filtered month
  const chartData = useMemo(() => {
    return filteredRows.map(r => ({
      data: `${r.dia}`,
      quantidade: r.quantidade,
    }));
  }, [filteredRows]);

  // Monthly summary for report
  const monthlyReport = useMemo(() => {
    const map = new Map<string, { mes: number; ano: number; total: number; dias: number; label: string; maxDia: number; registros: number }>();
    rows.forEach(r => {
      if (r.mes <= 0 || r.ano <= 0) return;
      const key = `${r.ano}-${r.mes}`;
      if (!map.has(key)) {
        map.set(key, {
          mes: r.mes, ano: r.ano,
          total: 0, dias: 0, maxDia: 0, registros: 0,
          label: `${MESES[r.mes - 1]}/${r.ano}`
        });
      }
      const entry = map.get(key)!;
      entry.total += r.quantidade;
      entry.registros++;
      if (r.quantidade > 0) entry.dias++;
      if (r.quantidade > entry.maxDia) entry.maxDia = r.quantidade;
    });
    return [...map.values()].sort((a, b) => a.ano === b.ano ? a.mes - b.mes : a.ano - b.ano);
  }, [rows]);

  const monthlyChartData = useMemo(() => {
    return monthlyReport.map(m => ({
      mes: `${MESES[m.mes - 1].substring(0, 3)}/${m.ano}`,
      total: parseFloat(m.total.toFixed(1)),
      dias: m.dias,
      media: m.dias > 0 ? parseFloat((m.total / m.dias).toFixed(1)) : 0,
      maxDia: parseFloat(m.maxDia.toFixed(1)),
    }));
  }, [monthlyReport]);

  // Accumulation trend for filtered month
  const acumuladoTrendData = useMemo(() => {
    let acum = 0;
    return filteredRows.map(r => {
      acum += r.quantidade;
      return { dia: `${r.dia}`, quantidade: r.quantidade, acumulado: parseFloat(acum.toFixed(1)) };
    });
  }, [filteredRows]);

  // Year comparison data
  const yearComparisonData = useMemo(() => {
    const anos = [...new Set(rows.map(r => r.ano).filter(y => y > 0))].sort();
    if (anos.length < 1) return { data: [], anos: [] };
    const data: any[] = [];
    for (let m = 1; m <= 12; m++) {
      const entry: any = { mes: MESES[m - 1].substring(0, 3) };
      anos.forEach(a => {
        const total = rows.filter(r => r.mes === m && r.ano === a).reduce((s, r) => s + r.quantidade, 0);
        entry[String(a)] = parseFloat(total.toFixed(1));
      });
      data.push(entry);
    }
    return { data, anos };
  }, [rows]);

  // Distribution by intensity ranges
  const intensityDistribution = useMemo(() => {
    const ranges = [
      { label: 'Sem chuva (0mm)', min: 0, max: 0, count: 0, color: 'hsl(var(--muted-foreground))' },
      { label: 'Fraca (0.1-5mm)', min: 0.1, max: 5, count: 0, color: 'hsl(210, 70%, 60%)' },
      { label: 'Moderada (5-25mm)', min: 5.01, max: 25, count: 0, color: 'hsl(210, 80%, 45%)' },
      { label: 'Forte (25-50mm)', min: 25.01, max: 50, count: 0, color: 'hsl(220, 85%, 40%)' },
      { label: 'Muito Forte (>50mm)', min: 50.01, max: 9999, count: 0, color: 'hsl(0, 70%, 50%)' },
    ];
    filteredRows.forEach(r => {
      if (r.quantidade === 0) ranges[0].count++;
      else if (r.quantidade <= 5) ranges[1].count++;
      else if (r.quantidade <= 25) ranges[2].count++;
      else if (r.quantidade <= 50) ranges[3].count++;
      else ranges[4].count++;
    });
    return ranges.filter(r => r.count > 0);
  }, [filteredRows]);

  // Top 10 rainy days
  const topRainyDays = useMemo(() => {
    return [...rows].filter(r => r.quantidade > 0).sort((a, b) => b.quantidade - a.quantidade).slice(0, 10);
  }, [rows]);

  const YEAR_COLORS = ['hsl(210, 80%, 50%)', 'hsl(150, 70%, 45%)', 'hsl(30, 80%, 55%)', 'hsl(340, 70%, 50%)', 'hsl(270, 60%, 55%)'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CloudRain className="w-7 h-7 text-primary" />
            Pluviometria
          </h1>
          <p className="text-sm text-muted-foreground">Controle de precipitação pluviométrica</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={fetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="operacao">
        <TabsList>
          <TabsTrigger value="operacao" className="gap-1"><CloudRain className="w-4 h-4" /> Operação</TabsTrigger>
          <TabsTrigger value="previsao" className="gap-1"><CloudSun className="w-4 h-4" /> Previsão do Tempo</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1"><FileText className="w-4 h-4" /> Relatórios</TabsTrigger>
        </TabsList>

        {/* ====== OPERAÇÃO TAB ====== */}
        <TabsContent value="operacao" className="space-y-6">
          {/* Month/Year filter */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Mês</Label>
              <Select value={String(filterMes)} onValueChange={v => setFilterMes(Number(v))}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Ano</Label>
              <Select value={String(filterAno)} onValueChange={v => setFilterAno(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* KPIs - BI Style */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Droplets, value: `${acumuladoMes.toFixed(1)}`, unit: 'mm', label: 'Acumulado do Mês', accent: 'from-blue-500/15 to-blue-600/5', iconColor: 'text-blue-500' },
              { icon: Calendar, value: `${diasComChuva}`, unit: 'dias', label: 'Dias com Chuva', accent: 'from-emerald-500/15 to-emerald-600/5', iconColor: 'text-emerald-500' },
              { icon: TrendingUp, value: `${maiorPrecipitacao.toFixed(1)}`, unit: 'mm', label: 'Maior Precipitação', accent: 'from-amber-500/15 to-amber-600/5', iconColor: 'text-amber-500' },
              { icon: CloudRain, value: `${mediaDiariaMes.toFixed(1)}`, unit: 'mm', label: 'Média Diária', accent: 'from-violet-500/15 to-violet-600/5', iconColor: 'text-violet-500' },
            ].map((kpi, i) => (
              <Card key={i} className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className={`p-0`}>
                  <div className={`bg-gradient-to-br ${kpi.accent} p-5`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold tracking-tight">{kpi.value}</span>
                          <span className="text-sm font-medium text-muted-foreground">{kpi.unit}</span>
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-xl bg-background/80 shadow-sm ${kpi.iconColor}`}>
                        <kpi.icon className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart - BI Style */}
          {chartData.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight">
                      Precipitação Diária
                    </h3>
                    <p className="text-xs text-muted-foreground">{MESES[filterMes - 1]} de {filterAno} · {filteredRows.length} registros</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-blue-500" />
                    Precipitação (mm)
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} barCategoryGap="15%">
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(210, 80%, 50%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(210, 80%, 65%)" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="barGradientPeak" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(210, 90%, 40%)" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(210, 80%, 55%)" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={false}
                      label={{ value: 'Dia do mês', position: 'insideBottom', offset: -4, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                      }}
                      formatter={(v: number) => [`${v.toFixed(1)} mm`, 'Precipitação']}
                      labelFormatter={(l) => `Dia ${l}`}
                    />
                    <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} name="mm" maxBarSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.quantidade === maiorPrecipitacao && maiorPrecipitacao > 0 ? 'url(#barGradientPeak)' : 'url(#barGradient)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Add form */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Novo Registro</h3>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <Label>Data</Label>
                  <Input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label>Quantidade (mm)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 12.5"
                    value={novaQuantidade}
                    onChange={e => setNovaQuantidade(e.target.value)}
                  />
                </div>
                <Button onClick={handleAdd} disabled={saving || loading} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {saving ? 'Salvando...' : 'Adicionar'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {fetching ? (
                <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>
              ) : filteredRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CloudRain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum registro em {MESES[filterMes - 1]}/{filterAno}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Quantidade (mm)</TableHead>
                      <TableHead className="text-right">Acumulado (mm)</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...filteredRows].reverse().map((row, i) => {
                      const originalIdx = filteredRows.length - 1 - i;
                      return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.data}</TableCell>
                        <TableCell className="text-right">{row.quantidade}</TableCell>
                        <TableCell className="text-right font-semibold">{acumuladoMensalMap.get(originalIdx) ?? row.acumulado}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(row)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== PREVISÃO DO TEMPO TAB ====== */}
        <TabsContent value="previsao" className="space-y-6">
          <PrevisaoTempoPanel />
        </TabsContent>

        {/* ====== RELATÓRIOS TAB ====== */}
        <TabsContent value="relatorios" className="space-y-6">
          {/* Filters + Export */}
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">Mês</Label>
                <Select value={String(filterMes)} onValueChange={v => setFilterMes(Number(v))}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ano</Label>
                <Select value={String(filterAno)} onValueChange={v => setFilterAno(Number(v))}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <PluviometriaPdfExport
              filteredRows={filteredRows}
              allRows={rows}
              filterMes={filterMes}
              filterAno={filterAno}
            />
          </div>
          {/* Global KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Droplets className="w-6 h-6 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{totalAcumulado.toFixed(1)}<span className="text-xs font-normal ml-1">mm</span></p>
                <p className="text-[10px] text-muted-foreground">Acumulado Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="w-6 h-6 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{rows.filter(r => r.quantidade > 0).length}</p>
                <p className="text-[10px] text-muted-foreground">Dias com Chuva</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-6 h-6 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{rows.length > 0 ? Math.max(...rows.map(r => r.quantidade)).toFixed(1) : '0'}<span className="text-xs font-normal ml-1">mm</span></p>
                <p className="text-[10px] text-muted-foreground">Recorde Diário</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CloudRain className="w-6 h-6 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{rows.length > 0 ? (totalAcumulado / rows.filter(r => r.quantidade > 0).length || 0).toFixed(1) : '0'}<span className="text-xs font-normal ml-1">mm</span></p>
                <p className="text-[10px] text-muted-foreground">Média por Dia Chuvoso</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileText className="w-6 h-6 text-primary mx-auto mb-1" />
                <p className="text-xl font-bold">{rows.length}</p>
                <p className="text-[10px] text-muted-foreground">Total de Registros</p>
              </CardContent>
            </Card>
          </div>

          {/* Trend: Daily precipitation + accumulation for selected month */}
          {acumuladoTrendData.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-1">Tendência Diária + Acumulado — {MESES[filterMes - 1]}/{filterAno}</h3>
                <p className="text-[10px] text-muted-foreground mb-3">Barras = precipitação diária • Linha = acumulado progressivo</p>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={acumuladoTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} label={{ value: 'mm/dia', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} label={{ value: 'Acum. (mm)', angle: 90, position: 'insideRight', fontSize: 10 }} />
                    <Tooltip formatter={(v: number, name: string) => [`${v} mm`, name === 'quantidade' ? 'Precipitação' : 'Acumulado']} />
                    <Legend formatter={(v) => v === 'quantidade' ? 'Precipitação' : 'Acumulado'} />
                    <Bar yAxisId="left" dataKey="quantidade" fill="hsl(210, 80%, 55%)" radius={[3, 3, 0, 0]} opacity={0.8} />
                    <Line yAxisId="right" dataKey="acumulado" stroke="hsl(150, 70%, 45%)" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Year-over-year comparison */}
          {yearComparisonData.anos.length > 1 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-1">Comparativo Anual</h3>
                <p className="text-[10px] text-muted-foreground mb-3">Acumulado mensal por ano</p>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={yearComparisonData.data}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`${v} mm`]} />
                    <Legend />
                    {yearComparisonData.anos.map((ano, i) => (
                      <Bar key={ano} dataKey={String(ano)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Intensity distribution pie */}
            {intensityDistribution.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-1">Distribuição por Intensidade — {MESES[filterMes - 1]}/{filterAno}</h3>
                  <p className="text-[10px] text-muted-foreground mb-3">Classificação dos dias por faixa de precipitação</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={intensityDistribution} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ label, count }) => `${label.split('(')[0].trim()}: ${count}`} labelLine={false} fontSize={9}>
                        {intensityDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} dias`]} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Monthly accumulated + avg + max chart */}
            {monthlyChartData.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-1">Acumulado Mensal, Média e Pico</h3>
                  <p className="text-[10px] text-muted-foreground mb-3">Barras = acumulado • Linhas = média diária e pico</p>
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} label={{ value: 'mm', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                      <Tooltip formatter={(v: number, name: string) => {
                        const labels: Record<string, string> = { total: 'Acumulado', media: 'Média/dia chuvoso', maxDia: 'Pico diário' };
                        return [`${v} mm`, labels[name] || name];
                      }} />
                      <Legend formatter={(v) => {
                        const labels: Record<string, string> = { total: 'Acumulado', media: 'Média', maxDia: 'Pico' };
                        return labels[v] || v;
                      }} />
                      <Bar dataKey="total" fill="hsl(210, 80%, 55%)" radius={[3, 3, 0, 0]} opacity={0.7} />
                      <Line dataKey="media" stroke="hsl(150, 70%, 45%)" strokeWidth={2} dot={{ r: 2 }} />
                      <Line dataKey="maxDia" stroke="hsl(0, 70%, 50%)" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="5 3" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top 10 rainy days */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold">Top 10 Maiores Precipitações</h3>
                <p className="text-[10px] text-muted-foreground">Ranking dos dias com maior volume de chuva registrado</p>
              </div>
              {topRainyDays.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum dado disponível</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Precipitação (mm)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topRainyDays.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-bold text-primary">{i + 1}º</TableCell>
                        <TableCell className="font-medium">{r.data}</TableCell>
                        <TableCell className="text-right font-semibold">{r.quantidade.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Monthly summary table */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <h3 className="text-sm font-semibold">Resumo Mensal Detalhado</h3>
              </div>
              {monthlyReport.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum dado disponível</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês/Ano</TableHead>
                      <TableHead className="text-right">Acumulado (mm)</TableHead>
                      <TableHead className="text-right">Dias com Chuva</TableHead>
                      <TableHead className="text-right">Registros</TableHead>
                      <TableHead className="text-right">Pico (mm)</TableHead>
                      <TableHead className="text-right">Média/Dia (mm)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...monthlyReport].reverse().map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{m.label}</TableCell>
                        <TableCell className="text-right font-semibold">{m.total.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{m.dias}</TableCell>
                        <TableCell className="text-right">{m.registros}</TableCell>
                        <TableCell className="text-right">{m.maxDia.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{m.dias > 0 ? (m.total / m.dias).toFixed(1) : '0.0'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title="Excluir Registro"
        description={`Deseja excluir o registro de pluviometria do dia ${rowToDelete?.data}?`}
      />
    </div>
  );
}
