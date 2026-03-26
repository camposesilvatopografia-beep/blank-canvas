import { useEffect, useState, useCallback, useMemo } from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Loader2, RefreshCw, Search, Fuel, CalendarIcon, X } from 'lucide-react';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { cn } from '@/lib/utils';

interface AbastecimentoRecord {
  id: string;
  data: string;
  dateParsed: Date | null;
  hora: string;
  tipo: string;
  categoria: string;
  veiculo: string;
  potencia: string;
  descricao: string;
  motorista: string;
  empresa: string;
  obra: string;
  horimetroAnterior: string;
  horimetroAtual: string;
  intervaloHC: string;
  kmAnterior: string;
  kmAtual: string;
  intervaloKm: string;
  quantidade: string;
  tipoCombustivel: string;
  local: string;
  arla: string;
  quantidadeArla: string;
  fornecedor: string;
  notaFiscal: string;
  valorUnitario: string;
  valorTotal: string;
  observacao: string;
}
function parseDateAbast(val: string): Date | null {
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

export function FrotaAbastecimentosTab() {
  const [records, setRecords] = useState<AbastecimentoRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const { readSheet } = useGoogleSheets();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await readSheet('Abastecimentos');
      if (data.length > 1) {
        const hdrs = data[0] as string[];
        // Use flexible index matching
        const findIdx = (keywords: string[]) => {
          return hdrs.findIndex(h => {
            if (!h) return false;
            const lower = h.toLowerCase();
            return keywords.some(k => lower.includes(k.toLowerCase()));
          });
        };

        const idIdx = findIdx(['id']);
        const dataIdx = findIdx(['data']);
        const horaIdx = findIdx(['hora']);
        const tipoIdx = findIdx(['tipo']);
        const categoriaIdx = findIdx(['categoria']);
        const veiculoIdx = findIdx(['veiculo']);
        const potenciaIdx = findIdx(['potencia']);
        const descricaoIdx = findIdx(['descricao']);
        const motoristaIdx = findIdx(['motorista']);
        const empresaIdx = findIdx(['empresa']);
        const obraIdx = findIdx(['obra']);
        
        // Horímetro columns - find first and second occurrence
        const horCols = hdrs.reduce<number[]>((acc, h, i) => {
          if (h && h.toLowerCase().includes('horimetro')) acc.push(i);
          return acc;
        }, []);
        const horAntIdx = horCols[0] ?? -1;
        const horAtualIdx = horCols[1] ?? -1;
        
        const intervaloHCIdx = findIdx(['intervalo h']);
        
        // KM columns
        const kmCols = hdrs.reduce<number[]>((acc, h, i) => {
          if (h && h.toLowerCase().includes('km')) acc.push(i);
          return acc;
        }, []);
        const kmAntIdx = kmCols[0] ?? -1;
        const kmAtualIdx = kmCols[1] ?? -1;
        
        const intervaloKmIdx = findIdx(['intervalo km']);
        const quantidadeIdx = findIdx(['quantidade']);
        const tipoCombIdx = findIdx(['tipo de comb']);
        const localIdx = findIdx(['local']);
        const arlaIdx = findIdx(['arla']);
        
        // Second "quantidade" column (for ARLA) - find index after arlaIdx
        const quantidadeArlaIdx = hdrs.findIndex((h, i) => 
          i > (arlaIdx >= 0 ? arlaIdx : 900) && h && h.toLowerCase().includes('quantidade')
        );
        
        const fornecedorIdx = findIdx(['fornecedor']);
        const notaFiscalIdx = findIdx(['nota fiscal']);
        const valorUnitIdx = findIdx(['valor unit']);
        const valorTotalIdx = findIdx(['valor total']);
        const observacaoIdx = findIdx(['observa']);

        const getVal = (row: any[], idx: number) => idx >= 0 ? (row[idx] || '') : '';

        const parsed = data.slice(1)
          .filter(row => getVal(row, idIdx) || getVal(row, veiculoIdx))
          .map(row => {
            const dataStr = getVal(row, dataIdx);
            return {
            id: getVal(row, idIdx),
            data: dataStr,
            dateParsed: parseDateAbast(dataStr),
            hora: getVal(row, horaIdx),
            tipo: getVal(row, tipoIdx),
            categoria: getVal(row, categoriaIdx),
            veiculo: getVal(row, veiculoIdx),
            potencia: getVal(row, potenciaIdx),
            descricao: getVal(row, descricaoIdx),
            motorista: getVal(row, motoristaIdx),
            empresa: getVal(row, empresaIdx),
            obra: getVal(row, obraIdx),
            horimetroAnterior: getVal(row, horAntIdx),
            horimetroAtual: getVal(row, horAtualIdx),
            intervaloHC: getVal(row, intervaloHCIdx),
            kmAnterior: getVal(row, kmAntIdx),
            kmAtual: getVal(row, kmAtualIdx),
            intervaloKm: getVal(row, intervaloKmIdx),
            quantidade: getVal(row, quantidadeIdx),
            tipoCombustivel: getVal(row, tipoCombIdx),
            local: getVal(row, localIdx),
            arla: getVal(row, arlaIdx),
            quantidadeArla: getVal(row, quantidadeArlaIdx),
            fornecedor: getVal(row, fornecedorIdx),
            notaFiscal: getVal(row, notaFiscalIdx),
            valorUnitario: getVal(row, valorUnitIdx),
            valorTotal: getVal(row, valorTotalIdx),
            observacao: getVal(row, observacaoIdx),
          };
          });

        setRecords(parsed);

        // Auto-select most recent date
        const dates = parsed.map(r => r.dateParsed).filter(Boolean) as Date[];
        if (dates.length > 0) {
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          setDateFrom(maxDate);
          setDateTo(maxDate);
        }
      }
    } catch (error) {
      console.error('Error loading abastecimentos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [readSheet]);

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
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
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          r.veiculo.toLowerCase().includes(term) ||
          r.descricao.toLowerCase().includes(term) ||
          r.empresa.toLowerCase().includes(term) ||
          r.motorista.toLowerCase().includes(term) ||
          r.data.toLowerCase().includes(term) ||
          r.tipo.toLowerCase().includes(term) ||
          r.local.toLowerCase().includes(term) ||
          r.tipoCombustivel.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [records, searchTerm, dateFrom, dateTo]);

  const formatNumber = (val: string) => {
    if (!val) return '-';
    const num = parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? val : num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const formatCurrency = (val: string) => {
    if (!val || val === 'R$' || val === 'R$ -') return '-';
    const cleaned = String(val).replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? val : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const clearDates = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Fuel className="w-5 h-5" />
          Abastecimentos ({filteredRecords.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por veículo, empresa, motorista, local..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Data início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Data fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="icon" onClick={clearDates} title="Limpar datas">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead className="text-right">Hor. Ant.</TableHead>
                <TableHead className="text-right">Hor. Atual</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Combustível</TableHead>
                <TableHead className="text-right">Qtd (L)</TableHead>
                <TableHead className="text-right">Km Ant.</TableHead>
                <TableHead className="text-right">Km Atual</TableHead>
                <TableHead className="text-right">Intervalo Km</TableHead>
                <TableHead>ARLA</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Nota Fiscal</TableHead>
                <TableHead className="text-right">Vlr Unit.</TableHead>
                <TableHead className="text-right">Vlr Total</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.slice(0, 200).map((r, idx) => (
                <TableRow key={r.id || idx}>
                  <TableCell className="whitespace-nowrap">{r.data}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.hora || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={r.tipo === 'Saida' ? 'default' : r.tipo === 'Entrada' ? 'secondary' : 'outline'}>
                      {r.tipo || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-primary whitespace-nowrap">{r.veiculo}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.horimetroAnterior)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.horimetroAtual)}</TableCell>
                  <TableCell>{r.descricao || '-'}</TableCell>
                  <TableCell>{r.motorista || '-'}</TableCell>
                  <TableCell>{r.empresa || '-'}</TableCell>
                  <TableCell>{r.local || '-'}</TableCell>
                  <TableCell>
                    {r.tipoCombustivel ? (
                      <Badge variant="outline">{r.tipoCombustivel}</Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatNumber(r.quantidade)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.kmAnterior)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.kmAtual)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.intervaloKm)}</TableCell>
                  <TableCell>{r.arla || '-'}</TableCell>
                  <TableCell>{r.fornecedor || '-'}</TableCell>
                  <TableCell>{r.notaFiscal || '-'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.valorUnitario)}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(r.valorTotal)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{r.observacao || '-'}</TableCell>
                </TableRow>
              ))}
              {filteredRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={21} className="text-center text-muted-foreground py-8">
                    Nenhum registro de abastecimento encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filteredRecords.length > 200 && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              Mostrando 200 de {filteredRecords.length} registros. Use o filtro para refinar.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
