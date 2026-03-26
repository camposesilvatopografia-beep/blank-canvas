import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Truck, CalendarDays, Search, FileDown, BarChart3, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, getDaysInMonth, parse, isValid, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useObraConfig } from '@/hooks/useObraConfig';
import logoApropriapp from '@/assets/logo-apropriapp.png';

interface HistoricoVeiculoReportProps {
  cargaData: any[][];
  loading: boolean;
}

interface DayRecord {
  day: number;
  dateStr: string; // dd/MM/yyyy
  dayOfWeek: string;
  viagens: number;
  volume: number;
  locais: string[];
  materiais: string[];
  isWeekend: boolean;
  hasData: boolean;
}

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function HistoricoVeiculoReport({ cargaData, loading }: HistoricoVeiculoReportProps) {
  const { obraConfig } = useObraConfig();
  const activeLogo = obraConfig.logo || logoApropriapp;
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  const toBase64 = (src: string): Promise<string> => {
    if (src.startsWith('data:')) return Promise.resolve(src);
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  };

  // Extract headers and data
  const headers = cargaData.length > 0 ? cargaData[0] : [];
  const rows = cargaData.length > 1 ? cargaData.slice(1) : [];

  const getIdx = (name: string) => headers.indexOf(name);

  // Available months from data
  const availableMonths = useMemo(() => {
    const dateIndex = getIdx('Data');
    if (dateIndex === -1) return [];

    const monthSet = new Map<string, string>();
    rows.forEach(row => {
      const dateVal = row[dateIndex];
      if (dateVal && typeof dateVal === 'string' && dateVal.includes('/')) {
        const parts = dateVal.split('/');
        if (parts.length === 3) {
          const key = `${parts[1]}/${parts[2]}`; // MM/YYYY
          if (!monthSet.has(key)) {
            const parsed = parse(dateVal, 'dd/MM/yyyy', new Date());
            if (isValid(parsed)) {
              const label = format(parsed, "MMMM 'de' yyyy", { locale: ptBR });
              monthSet.set(key, label.charAt(0).toUpperCase() + label.slice(1));
            }
          }
        }
      }
    });

    return Array.from(monthSet.entries())
      .map(([key, label]) => ({ value: key, label }))
      .sort((a, b) => {
        const [mA, yA] = a.value.split('/').map(Number);
        const [mB, yB] = b.value.split('/').map(Number);
        return yB - yA || mB - mA;
      });
  }, [rows, headers]);

  // Available vehicles
  const availableVehicles = useMemo(() => {
    const prefixoCbIndex = getIdx('Prefixo_Cb');
    if (prefixoCbIndex === -1) return [];

    const vehicleSet = new Set<string>();
    rows.forEach(row => {
      const v = row[prefixoCbIndex];
      if (v && typeof v === 'string' && v.trim()) {
        vehicleSet.add(v.trim());
      }
    });

    return Array.from(vehicleSet).sort();
  }, [rows, headers]);

  // Filtered vehicles for search
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch) return availableVehicles;
    const term = vehicleSearch.toLowerCase();
    return availableVehicles.filter(v => v.toLowerCase().includes(term));
  }, [availableVehicles, vehicleSearch]);

  // Build day-by-day report
  const dailyReport = useMemo((): DayRecord[] => {
    if (!selectedMonth || !selectedVehicle) return [];

    const [monthStr, yearStr] = selectedMonth.split('/');
    const month = parseInt(monthStr, 10) - 1; // 0-indexed
    const year = parseInt(yearStr, 10);
    const daysCount = getDaysInMonth(new Date(year, month));

    const dateIndex = getIdx('Data');
    const prefixoCbIndex = getIdx('Prefixo_Cb');
    const viagensIndex = getIdx('N_Viagens');
    const viagensIndexAlt = getIdx('I_Viagens');
    const volumeTotalIndex = getIdx('Volume_Total');
    const volumeIndex = getIdx('Volume');
    const localIndex = getIdx('Local_da_Obra');
    const materialIndex = getIdx('Material');

    // Filter rows for this vehicle and month
    const vehicleRows = rows.filter(row => {
      const cb = row[prefixoCbIndex];
      const dateVal = row[dateIndex];
      if (!cb || !dateVal) return false;
      if (cb.trim() !== selectedVehicle) return false;
      if (typeof dateVal !== 'string' || !dateVal.includes('/')) return false;
      const parts = dateVal.split('/');
      return parts[1] === monthStr && parts[2] === yearStr;
    });

    // Group by day
    const dayMap = new Map<number, { viagens: number; volume: number; locais: Set<string>; materiais: Set<string> }>();
    vehicleRows.forEach(row => {
      const dateVal = row[dateIndex];
      const dayNum = parseInt(dateVal.split('/')[0], 10);

      const rawV = viagensIndex !== -1 ? row[viagensIndex] : viagensIndexAlt !== -1 ? row[viagensIndexAlt] : undefined;
      const v = parseInt(String(rawV ?? '1'), 10);
      const viagens = Number.isFinite(v) && v > 0 ? v : 1;

      const volTotal = parseFloat(String(row[volumeTotalIndex] || 0).replace(',', '.'));
      const volUnit = parseFloat(String(row[volumeIndex] || 0).replace(',', '.'));
      const vol = !isNaN(volTotal) && volTotal > 0 ? volTotal : (viagens * (isNaN(volUnit) ? 0 : volUnit));

      const local = row[localIndex] || '';
      const material = row[materialIndex] || '';

      if (!dayMap.has(dayNum)) {
        dayMap.set(dayNum, { viagens: 0, volume: 0, locais: new Set(), materiais: new Set() });
      }
      const entry = dayMap.get(dayNum)!;
      entry.viagens += viagens;
      entry.volume += vol;
      if (local) entry.locais.add(local);
      if (material) entry.materiais.add(material);
    });

    // Build all days of the month
    const result: DayRecord[] = [];
    for (let d = 1; d <= daysCount; d++) {
      const date = new Date(year, month, d);
      const dayOfWeekIdx = getDay(date);
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${dayStr}/${monthStr}/${yearStr}`;
      const data = dayMap.get(d);

      result.push({
        day: d,
        dateStr,
        dayOfWeek: WEEKDAY_NAMES[dayOfWeekIdx],
        viagens: data?.viagens || 0,
        volume: data ? Math.round(data.volume * 100) / 100 : 0,
        locais: data ? Array.from(data.locais) : [],
        materiais: data ? Array.from(data.materiais) : [],
        isWeekend: dayOfWeekIdx === 0 || dayOfWeekIdx === 6,
        hasData: !!data,
      });
    }

    return result;
  }, [selectedMonth, selectedVehicle, rows, headers]);

  // Totals
  const totals = useMemo(() => {
    const totalViagens = dailyReport.reduce((s, d) => s + d.viagens, 0);
    const totalVolume = dailyReport.reduce((s, d) => s + d.volume, 0);
    const diasTrabalhados = dailyReport.filter(d => d.hasData).length;
    const diasTotal = dailyReport.length;
    const mediaViagens = diasTrabalhados > 0 ? totalViagens / diasTrabalhados : 0;
    return { totalViagens, totalVolume, diasTrabalhados, diasTotal, mediaViagens };
  }, [dailyReport]);

  // Chart data (only days with data for cleaner chart)
  const chartData = useMemo(() => {
    return dailyReport.map(d => ({
      name: `${d.day}`,
      viagens: d.viagens,
      dayOfWeek: d.dayOfWeek,
    }));
  }, [dailyReport]);

  const formatNumber = (num: number) => num.toLocaleString('pt-BR');

  // XLSX Export
  const handleExportXLSX = () => {
    if (dailyReport.length === 0) return;

    const [monthStr, yearStr] = selectedMonth.split('/');
    const monthDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    const monthLabel = format(monthDate, "MMMM_yyyy", { locale: ptBR });

    const wsData = [
      [`Histórico do Veículo: ${selectedVehicle}`],
      [`Período: ${format(monthDate, "MMMM 'de' yyyy", { locale: ptBR })}`],
      [],
      ['Dia', 'Data', 'Dia Semana', 'Viagens', 'Volume (m³)', 'Locais', 'Materiais', 'Status'],
    ];

    dailyReport.forEach(d => {
      wsData.push([
        String(d.day),
        d.dateStr,
        d.dayOfWeek,
        String(d.viagens),
        formatNumber(d.volume),
        d.locais.join(', ') || '-',
        d.materiais.join(', ') || '-',
        d.hasData ? 'Trabalhou' : d.isWeekend ? 'Fim de semana' : 'Não trabalhou',
      ]);
    });

    // Totals
    wsData.push([]);
    wsData.push([
      '', '', 'TOTAIS',
      String(totals.totalViagens),
      formatNumber(totals.totalVolume),
      '', '',
      `${totals.diasTrabalhados} dias trabalhados`,
    ]);
    wsData.push([
      '', '', 'MÉDIA/DIA',
      totals.mediaViagens.toFixed(1),
      '', '', '', '',
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    XLSX.writeFile(wb, `historico_${selectedVehicle}_${monthLabel}.xlsx`);
  };

  // PDF Export
  const handleExportPDF = async () => {
    if (dailyReport.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoBase64 = await toBase64(activeLogo);

    const rows = dailyReport.map(d => {
      const bgColor = d.isWeekend && !d.hasData ? '#f3f4f6' : d.hasData ? '#ffffff' : '#fafafa';
      const textColor = d.isWeekend && !d.hasData ? '#9ca3af' : d.hasData ? '#111827' : '#9ca3af';
      const dayColor = d.isWeekend ? '#ef4444' : '#374151';
      const viagensCell = d.viagens > 0
        ? `<span style="background:#ede9fe;color:#7c3aed;padding:2px 8px;border-radius:4px;font-weight:bold">${d.viagens}</span>`
        : '<span style="color:#9ca3af">-</span>';

      return `<tr style="background:${bgColor};color:${textColor}">
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600">${d.day}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${d.dateStr}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;color:${dayColor};font-weight:${d.isWeekend ? '600' : '400'}">${d.dayOfWeek}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${viagensCell}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${d.volume > 0 ? formatNumber(Math.round(d.volume)) : '-'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px">${d.locais.join(', ') || '-'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px">${d.materiais.join(', ') || '-'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:11px">${d.hasData ? '✅' : d.isWeekend ? '🔹' : '⬜'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Histórico ${selectedVehicle} - ${monthLabel}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
    body { padding: 0; color: #111827; }
    .header { background: linear-gradient(135deg, #1d3557, #2d5a8e); color: white; border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
    .header-top { display: flex; align-items: center; gap: 16px; padding: 14px 18px 10px 18px; }
    .header-logo { height: 72px; width: auto; object-fit: contain; background: rgba(255,255,255,0.15); border-radius: 8px; padding: 6px; flex-shrink: 0; }
    .header-info { flex: 1; }
    .header-obra-nome { font-size: 13px; font-weight: 700; opacity: 0.85; margin-bottom: 2px; letter-spacing: 0.3px; }
    .header-obra-local { font-size: 10px; opacity: 0.65; margin-bottom: 6px; }
    .header-title { font-size: 20px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.1; }
    .header-bottom { background: rgba(0,0,0,0.25); display: flex; align-items: center; padding: 7px 18px; border-top: 1px solid rgba(255,255,255,0.15); }
    .header-period { font-size: 11px; opacity: 0.9; }
    .kpis { display: flex; gap: 12px; margin-bottom: 16px; justify-content: center; flex-wrap: wrap; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 20px; text-align: center; min-width: 120px; }
    .kpi .value { font-size: 22px; font-weight: 700; color: #1e293b; }
    .kpi .label { font-size: 11px; color: #64748b; margin-top: 2px; }
    .kpi.primary { background: #1d3557; border-color: #1d3557; }
    .kpi.primary .value, .kpi.primary .label { color: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #1d3557; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    th:nth-child(1), th:nth-child(4), th:nth-child(5), th:nth-child(8) { text-align: center; }
    .totals td { background: #dbeafe; font-weight: 700; padding: 10px; border-top: 2px solid #1d3557; }
    .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <img class="header-logo" src="${logoBase64}" alt="Logo" />
      <div class="header-info">
        ${obraConfig.nome ? `<div class="header-obra-nome">${obraConfig.nome}</div>` : ''}
        ${obraConfig.local ? `<div class="header-obra-local">📍 ${obraConfig.local}</div>` : ''}
        <div class="header-title">HISTÓRICO DO VEÍCULO: ${selectedVehicle}</div>
      </div>
    </div>
    <div class="header-bottom">
      <span class="header-period">📅 Período: <b>${monthLabel}</b></span>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi primary">
      <div class="value">${formatNumber(totals.totalViagens)}</div>
      <div class="label">Total Viagens</div>
    </div>
    <div class="kpi">
      <div class="value">${formatNumber(Math.round(totals.totalVolume))}</div>
      <div class="label">Volume (m³)</div>
    </div>
    <div class="kpi">
      <div class="value">${totals.diasTrabalhados} / ${totals.diasTotal}</div>
      <div class="label">Dias Trabalhados</div>
    </div>
    <div class="kpi">
      <div class="value">${totals.mediaViagens.toFixed(1)}</div>
      <div class="label">Média/Dia</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Dia</th><th>Data</th><th>Dia Sem.</th><th>Viagens</th><th>Volume (m³)</th><th>Locais</th><th>Materiais</th><th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="totals">
        <td colspan="3" style="text-align:right;padding-right:16px">TOTAL</td>
        <td style="text-align:center">${formatNumber(totals.totalViagens)}</td>
        <td style="text-align:center">${formatNumber(Math.round(totals.totalVolume))}</td>
        <td colspan="3">${totals.diasTrabalhados} dias trabalhados • Média: ${totals.mediaViagens.toFixed(1)} viagens/dia</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} • ApropriAPP</div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const monthLabel = useMemo(() => {
    if (!selectedMonth) return '';
    const m = availableMonths.find(m => m.value === selectedMonth);
    return m?.label || selectedMonth;
  }, [selectedMonth, availableMonths]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Histórico do Veículo por Período
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecione um veículo e o mês para ver o histórico completo com todos os dias
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-end">
            {/* Vehicle selector */}
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Veículo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Buscar veículo..."
                  value={vehicleSearch}
                  onChange={e => setVehicleSearch(e.target.value)}
                  className="pl-10 mb-2"
                />
              </div>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent>
                  {filteredVehicles.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month selector */}
            <div className="min-w-[220px] space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <CalendarDays className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Selecione o mês" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export */}
            {dailyReport.length > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-10">
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportXLSX} className="h-10">
                  <FileDown className="w-4 h-4 mr-2" />
                  XLSX
                </Button>
              </>
            )}
          </div>

          {/* No selection message */}
          {(!selectedVehicle || !selectedMonth) && (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Selecione um veículo e o mês para visualizar o histórico</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {dailyReport.length > 0 && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs opacity-80">Total Viagens</p>
                <p className="text-2xl font-bold">{formatNumber(totals.totalViagens)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Volume Total</p>
                <p className="text-2xl font-bold">{formatNumber(Math.round(totals.totalVolume))} <span className="text-sm font-normal">m³</span></p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-emerald-700 dark:text-emerald-300">Dias Trabalhados</p>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">{totals.diasTrabalhados} <span className="text-sm font-normal">/ {totals.diasTotal}</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Média/Dia</p>
                <p className="text-2xl font-bold">{totals.mediaViagens.toFixed(1)} <span className="text-sm font-normal">viagens</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Veículo</p>
                <p className="text-lg font-bold truncate">{selectedVehicle}</p>
                <p className="text-xs text-muted-foreground truncate">{monthLabel}</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="w-4 h-4 text-primary" />
                Viagens por Dia - {selectedVehicle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] md:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [value, 'Viagens']}
                      labelFormatter={(label) => {
                        const d = dailyReport.find(r => String(r.day) === label);
                        return d ? `${d.dateStr} (${d.dayOfWeek})` : label;
                      }}
                    />
                    <Bar
                      dataKey="viagens"
                      radius={[3, 3, 0, 0]}
                      fill="hsl(var(--primary))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Day-by-day Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarDays className="w-4 h-4 text-primary" />
                Detalhamento Diário - {monthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold w-[50px]">Dia</TableHead>
                      <TableHead className="font-bold w-[100px]">Data</TableHead>
                      <TableHead className="font-bold w-[60px] text-center">Dia</TableHead>
                      <TableHead className="font-bold text-center">Viagens</TableHead>
                      <TableHead className="font-bold text-center">Volume (m³)</TableHead>
                      <TableHead className="font-bold">Locais</TableHead>
                      <TableHead className="font-bold">Materiais</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyReport.map(d => (
                      <TableRow
                        key={d.day}
                        className={
                          d.isWeekend && !d.hasData
                            ? 'bg-muted/40 text-muted-foreground'
                            : d.hasData
                              ? ''
                              : 'bg-muted/20 text-muted-foreground'
                        }
                      >
                        <TableCell className="font-medium">{d.day}</TableCell>
                        <TableCell className="text-sm">{d.dateStr}</TableCell>
                        <TableCell className={`text-center text-sm ${d.isWeekend ? 'text-destructive font-semibold' : ''}`}>
                          {d.dayOfWeek}
                        </TableCell>
                        <TableCell className="text-center">
                          {d.viagens > 0 ? (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded font-bold text-sm">
                              {d.viagens}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {d.volume > 0 ? formatNumber(Math.round(d.volume)) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {d.locais.length > 0 ? d.locais.map(l => (
                              <Badge key={l} variant="outline" className="text-xs">{l}</Badge>
                            )) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {d.materiais.length > 0 ? d.materiais.map(m => (
                              <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                            )) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals row */}
                    <TableRow className="bg-primary/5 font-bold border-t-2 border-primary/20">
                      <TableCell colSpan={3} className="text-right font-bold">TOTAL</TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-1 bg-primary text-primary-foreground rounded font-bold">
                          {formatNumber(totals.totalViagens)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {formatNumber(Math.round(totals.totalVolume))}
                      </TableCell>
                      <TableCell colSpan={2} className="text-sm">
                        {totals.diasTrabalhados} dias trabalhados • Média: {totals.mediaViagens.toFixed(1)} viagens/dia
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
