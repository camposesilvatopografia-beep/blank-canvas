import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Truck, AlertTriangle, CheckCircle2, Search, FileDown, RefreshCw, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DivergenciaRecord {
  caminhao: string;
  carga: number;
  descarga: number;
  diferenca: number;
  status: 'ok' | 'divergente';
}

interface DivergenciaCargaDescargaReportProps {
  cargaData: any[][];
  descargaData: any[][];
  availableDates: string[];
  loading?: boolean;
  onRefresh?: () => void;
}

export function DivergenciaCargaDescargaReport({
  cargaData,
  descargaData,
  availableDates,
  loading = false,
  onRefresh,
}: DivergenciaCargaDescargaReportProps) {
  const [selectedDate, setSelectedDate] = useState<string>(availableDates[0] || '');
  const [usePeriod, setUsePeriod] = useState(false);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCaminhao, setSelectedCaminhao] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyDivergent, setShowOnlyDivergent] = useState(false);

  // Parse date helper
  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  // Get headers and indexes
  const cargaHeaders = cargaData[0] || [];
  const descargaHeaders = descargaData[0] || [];

  const cargaDateIdx = cargaHeaders.indexOf('Data');
  const cargaCaminhaoIdx = cargaHeaders.indexOf('Prefixo_Cb') !== -1 
    ? cargaHeaders.indexOf('Prefixo_Cb') 
    : cargaHeaders.indexOf('PrefixoCb');
  const cargaViagensIdx = cargaHeaders.indexOf('N_Viagens') !== -1 
    ? cargaHeaders.indexOf('N_Viagens') 
    : cargaHeaders.indexOf('I_Viagens');

  const descargaDateIdx = descargaHeaders.indexOf('Data');
  const descargaCaminhaoIdx = descargaHeaders.indexOf('Prefixo_Cb') !== -1 
    ? descargaHeaders.indexOf('Prefixo_Cb') 
    : descargaHeaders.indexOf('PrefixoCb');
  const descargaViagensIdx = descargaHeaders.indexOf('N_Viagens') !== -1 
    ? descargaHeaders.indexOf('N_Viagens') 
    : descargaHeaders.indexOf('I_Viagens');

  // Filter data by date
  const filterByDate = (rows: any[][], dateIdx: number) => {
    if (!rows || rows.length < 2) return [];
    const dataRows = rows.slice(1);
    
    if (usePeriod && (startDate || endDate)) {
      const start = startDate ? parseDate(startDate) : null;
      const end = endDate ? parseDate(endDate) : null;
      
      return dataRows.filter(row => {
        const rowDate = parseDate(row[dateIdx]);
        if (!rowDate) return false;
        if (start && end) return rowDate >= start && rowDate <= end;
        if (start) return rowDate >= start;
        if (end) return rowDate <= end;
        return true;
      });
    } else if (selectedDate) {
      return dataRows.filter(row => row[dateIdx] === selectedDate);
    }
    return dataRows;
  };

  // Process divergence data
  const divergenceData = useMemo(() => {
    const filteredCarga = filterByDate(cargaData, cargaDateIdx);
    const filteredDescarga = filterByDate(descargaData, descargaDateIdx);

    // Count trips by caminhao (Carga)
    const cargaMap = new Map<string, number>();
    filteredCarga.forEach(row => {
      const caminhao = row[cargaCaminhaoIdx] || '';
      if (caminhao) {
        const viagens = parseInt(row[cargaViagensIdx]) || 1;
        cargaMap.set(caminhao, (cargaMap.get(caminhao) || 0) + viagens);
      }
    });

    // Count trips by caminhao (Descarga)
    const descargaMap = new Map<string, number>();
    filteredDescarga.forEach(row => {
      const caminhao = row[descargaCaminhaoIdx] || '';
      if (caminhao) {
        const viagens = parseInt(row[descargaViagensIdx]) || 1;
        descargaMap.set(caminhao, (descargaMap.get(caminhao) || 0) + viagens);
      }
    });

    // Combine all unique caminhoes
    const allCaminhoes = new Set([...cargaMap.keys(), ...descargaMap.keys()]);
    
    const records: DivergenciaRecord[] = [];
    allCaminhoes.forEach(caminhao => {
      const carga = cargaMap.get(caminhao) || 0;
      const descarga = descargaMap.get(caminhao) || 0;
      const diferenca = carga - descarga;
      
      records.push({
        caminhao,
        carga,
        descarga,
        diferenca,
        status: diferenca === 0 ? 'ok' : 'divergente',
      });
    });

    return records.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca));
  }, [cargaData, descargaData, selectedDate, usePeriod, startDate, endDate]);

  // Get unique caminhoes for filter
  const availableCaminhoes = useMemo(() => {
    return [...new Set(divergenceData.map(r => r.caminhao))].sort();
  }, [divergenceData]);

  // Apply filters
  const filteredRecords = useMemo(() => {
    let result = divergenceData;

    // Filter by caminhao selection
    if (selectedCaminhao !== 'todos') {
      result = result.filter(r => r.caminhao === selectedCaminhao);
    }

    // Filter by search term
    if (searchTerm) {
      result = result.filter(r => 
        r.caminhao.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter only divergent
    if (showOnlyDivergent) {
      result = result.filter(r => r.status === 'divergente');
    }

    return result;
  }, [divergenceData, selectedCaminhao, searchTerm, showOnlyDivergent]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, r) => ({
        carga: acc.carga + r.carga,
        descarga: acc.descarga + r.descarga,
        diferenca: acc.diferenca + r.diferenca,
        divergentes: acc.divergentes + (r.status === 'divergente' ? 1 : 0),
      }),
      { carga: 0, descarga: 0, diferenca: 0, divergentes: 0 }
    );
  }, [filteredRecords]);

  // Export to XLSX
  const handleExportXLSX = () => {
    const exportData = filteredRecords.map(r => ({
      'Caminhão': r.caminhao,
      'Cargas': r.carga,
      'Descargas': r.descarga,
      'Diferença': r.diferenca,
      'Status': r.status === 'ok' ? 'OK' : 'Divergente',
    }));

    // Add totals row
    exportData.push({
      'Caminhão': 'TOTAL',
      'Cargas': totals.carga,
      'Descargas': totals.descarga,
      'Diferença': totals.diferenca,
      'Status': `${totals.divergentes} divergente(s)`,
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Divergências');
    
    const dateLabel = usePeriod 
      ? `${startDate || 'inicio'}_a_${endDate || 'fim'}`.replace(/\//g, '-')
      : selectedDate.replace(/\//g, '-');
    
    XLSX.writeFile(wb, `divergencias_carga_descarga_${dateLabel}.xlsx`);
  };

  const formatDateForCalendar = (dateStr: string) => {
    if (!dateStr) return undefined;
    const parsed = parseDate(dateStr);
    return parsed || undefined;
  };

  const handleCalendarSelect = (date: Date | undefined, setter: (val: string) => void) => {
    if (date) {
      setter(format(date, 'dd/MM/yyyy'));
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="w-5 h-5 text-amber-600" />
            Relatório de Divergência Carga/Descarga
          </CardTitle>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExportXLSX}>
              <FileDown className="w-4 h-4 mr-2" />
              Exportar XLSX
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg">
          {/* Period Toggle */}
          <div className="flex items-center gap-2">
            <Switch 
              id="use-period" 
              checked={usePeriod} 
              onCheckedChange={setUsePeriod}
            />
            <Label htmlFor="use-period" className="text-sm">Período</Label>
          </div>

          {usePeriod ? (
            <>
              {/* Start Date */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[140px]">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {startDate || 'Data inicial'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formatDateForCalendar(startDate)}
                    onSelect={(date) => handleCalendarSelect(date, setStartDate)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              {/* End Date */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="min-w-[140px]">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {endDate || 'Data final'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formatDateForCalendar(endDate)}
                    onSelect={(date) => handleCalendarSelect(date, setEndDate)}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              {(startDate || endDate) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </>
          ) : (
            /* Single Date Selector */
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Selecione data" />
              </SelectTrigger>
              <SelectContent>
                {availableDates.slice(0, 30).map(date => (
                  <SelectItem key={date} value={date}>{date}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Caminhao Filter */}
          <Select value={selectedCaminhao} onValueChange={setSelectedCaminhao}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Caminhão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Caminhões</SelectItem>
              {availableCaminhoes.map(cam => (
                <SelectItem key={cam} value={cam}>{cam}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar caminhão..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[180px]"
            />
          </div>

          {/* Only Divergent Toggle */}
          <div className="flex items-center gap-2">
            <Switch 
              id="only-divergent" 
              checked={showOnlyDivergent} 
              onCheckedChange={setShowOnlyDivergent}
            />
            <Label htmlFor="only-divergent" className="text-sm">Só divergentes</Label>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-amber-50 border-0">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-700">{totals.carga}</div>
              <div className="text-xs text-amber-600">Total Cargas</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-0">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-700">{totals.descarga}</div>
              <div className="text-xs text-blue-600">Total Descargas</div>
            </CardContent>
          </Card>
          <Card className={`border-0 ${totals.diferenca === 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <CardContent className="p-4">
              <div className={`text-2xl font-bold ${totals.diferenca === 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {totals.diferenca > 0 ? '+' : ''}{totals.diferenca}
              </div>
              <div className={`text-xs ${totals.diferenca === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                Diferença Total
              </div>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-0">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-700">{totals.divergentes}</div>
              <div className="text-xs text-orange-600">Caminhões Divergentes</div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Caminhão</TableHead>
                <TableHead className="text-center font-semibold">Cargas</TableHead>
                <TableHead className="text-center font-semibold">Descargas</TableHead>
                <TableHead className="text-center font-semibold">Diferença</TableHead>
                <TableHead className="text-center font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record, idx) => (
                  <TableRow key={record.caminhao} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                    <TableCell className="font-medium">{record.caminhao}</TableCell>
                    <TableCell className="text-center">{record.carga}</TableCell>
                    <TableCell className="text-center">{record.descarga}</TableCell>
                    <TableCell className="text-center">
                      <span className={record.diferenca === 0 ? 'text-emerald-600' : 'text-red-600 font-semibold'}>
                        {record.diferenca > 0 ? '+' : ''}{record.diferenca}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {record.status === 'ok' ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Divergente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer totals */}
        {filteredRecords.length > 0 && (
          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg text-sm">
            <span className="text-muted-foreground">
              {filteredRecords.length} caminhão(ões) • {totals.divergentes} com divergência
            </span>
            <span className="font-medium">
              Total: {totals.carga} cargas / {totals.descarga} descargas = 
              <span className={totals.diferenca === 0 ? ' text-emerald-600' : ' text-red-600'}>
                {' '}{totals.diferenca > 0 ? '+' : ''}{totals.diferenca}
              </span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
