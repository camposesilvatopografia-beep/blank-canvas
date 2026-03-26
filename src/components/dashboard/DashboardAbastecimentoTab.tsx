import { useEffect, useState, useCallback, useMemo } from 'react';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Loader2, RefreshCw, Search, Fuel, CalendarIcon, X, Wrench, TrendingUp, Truck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AbastecimentoRecord {
  id: string;
  data: string;
  dateParsed: Date | null;
  hora: string;
  tipo: string;
  categoria: string;
  veiculo: string;
  descricao: string;
  motorista: string;
  empresa: string;
  quantidade: string;
  horimetroAnterior: string;
  horimetroAtual: string;
  kmAnterior: string;
  kmAtual: string;
}

interface ManutencaoRecord {
  id: string;
  data: string;
  dateParsed: Date | null;
  veiculo: string;
  problema: string;
  servico: string;
  mecanico: string;
  status: string;
  dataEntrada: string;
  dataSaida: string;
  horasParado: string;
  observacao: string;
}

function parseDateVal(val: string): Date | null {
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

interface EstoqueRecord {
  descricao: string;
  data: string;
  dateParsed: Date | null;
  estoqueAnterior: number;
  entrada: number;
  saida: number;
  estoqueAtual: number;
  saidaParaComboios?: number;
  saidaParaEquipamentos?: number;
}

export function DashboardAbastecimentoTab() {
  const [abastecimentos, setAbastecimentos] = useState<AbastecimentoRecord[]>([]);
  const [manutencoes, setManutencoes] = useState<ManutencaoRecord[]>([]);
  const [estoqueComboios, setEstoqueComboios] = useState<EstoqueRecord[]>([]);
  const [estoqueTanques, setEstoqueTanques] = useState<EstoqueRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [manutModalFilter, setManutModalFilter] = useState<'all' | 'aguardando' | null>(null);
  const [manutStatusFilter, setManutStatusFilter] = useState<string>('todos');
  const { readSheet } = useGoogleSheets();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [abastData, manutData, estComboiosData, estTanquesData] = await Promise.all([
        readSheet('Abastecimentos').catch(() => []),
        readSheet('Manutenções').catch(() => readSheet('Manutencoes').catch(() => [])),
        readSheet('Estoques Comboios').catch(() => []),
        readSheet('Estoques Tanques').catch(() => []),
      ]);

      // Parse abastecimentos
      if (abastData && abastData.length > 1) {
        const hdrs = abastData[0] as string[];
        const findIdx = (keywords: string[]) =>
          hdrs.findIndex(h => h && keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

        const idIdx = findIdx(['id']);
        const dataIdx = findIdx(['data']);
        const horaIdx = findIdx(['hora']);
        const tipoIdx = findIdx(['tipo']);
        const categoriaIdx = findIdx(['categoria']);
        const veiculoIdx = findIdx(['veiculo']);
        const descricaoIdx = findIdx(['descricao']);
        const motoristaIdx = findIdx(['motorista']);
        const empresaIdx = findIdx(['empresa']);
        const quantidadeIdx = findIdx(['quantidade']);

        // Horímetro columns
        const horCols = hdrs.reduce<number[]>((acc, h, i) => {
          if (h && h.toLowerCase().includes('horimetro')) acc.push(i);
          return acc;
        }, []);
        const horAntIdx = horCols[0] ?? -1;
        const horAtualIdx = horCols[1] ?? -1;

        // KM columns
        const kmCols = hdrs.reduce<number[]>((acc, h, i) => {
          if (h && h.toLowerCase().includes('km')) acc.push(i);
          return acc;
        }, []);
        const kmAntIdx = kmCols[0] ?? -1;
        const kmAtualIdx = kmCols[1] ?? -1;

        const getVal = (row: any[], idx: number) => idx >= 0 ? (row[idx] || '') : '';

        const parsed = abastData.slice(1)
          .filter(row => getVal(row, idIdx) || getVal(row, veiculoIdx))
          .map(row => {
            const dataStr = getVal(row, dataIdx);
            return {
              id: getVal(row, idIdx),
              data: dataStr,
              dateParsed: parseDateVal(dataStr),
              hora: getVal(row, horaIdx),
              tipo: getVal(row, tipoIdx),
              categoria: getVal(row, categoriaIdx),
              veiculo: getVal(row, veiculoIdx),
              descricao: getVal(row, descricaoIdx),
              motorista: getVal(row, motoristaIdx),
              empresa: getVal(row, empresaIdx),
              quantidade: getVal(row, quantidadeIdx),
              horimetroAnterior: getVal(row, horAntIdx),
              horimetroAtual: getVal(row, horAtualIdx),
              kmAnterior: getVal(row, kmAntIdx),
              kmAtual: getVal(row, kmAtualIdx),
            };
          });
        setAbastecimentos(parsed);

        // Auto-select most recent date
        const dates = parsed.map(r => r.dateParsed).filter(Boolean) as Date[];
        if (dates.length > 0) {
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          setSelectedDate(maxDate);
        }
      }

      // Parse manutenções
      if (manutData && manutData.length > 1) {
        const hdrs = manutData[0] as string[];
        console.log('[MANUT] Headers:', JSON.stringify(hdrs));
        const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const findIdx = (keywords: string[]) =>
          hdrs.findIndex(h => h && keywords.some(k => norm(h).includes(norm(k))));

        const idIdx = findIdx(['idordem', 'id']);
        const dataIdx = findIdx(['data']);
        const veiculoIdx = findIdx(['veiculo', 'prefixo', 'equipamento']);
        const problemaIdx = findIdx(['problema', 'defeito']);
        const servicoIdx = findIdx(['servico']);
        const mecanicoIdx = findIdx(['mecanico']);
        const observacaoIdx = findIdx(['observa', 'obs']);
        const statusIdx = findIdx(['status']);

        // Data Entrada / Saída
        const dataEntIdx = hdrs.findIndex(h => {
          const n = norm(h || '');
          return n.includes('dataentrada') || (n.includes('entrada') && n.includes('data'));
        });
        const dataSaiIdx = hdrs.findIndex(h => {
          const n = norm(h || '');
          return n.includes('datasaida') || (n.includes('saida') && n.includes('data'));
        });
        const horasParadoIdx = findIdx(['horasparado', 'hrsparado', 'tempoparado']);

        console.log('[MANUT] Column indexes:', { idIdx, dataIdx, veiculoIdx, problemaIdx, servicoIdx, mecanicoIdx, statusIdx, dataEntIdx, dataSaiIdx, horasParadoIdx, observacaoIdx });

        const getVal = (row: any[], idx: number) => idx >= 0 ? (row[idx] || '') : '';

        const parsed = manutData.slice(1)
          .filter(row => getVal(row, idIdx) || getVal(row, veiculoIdx))
          .map(row => {
            const dataStr = getVal(row, dataIdx);
            return {
              id: getVal(row, idIdx),
              data: dataStr,
              dateParsed: parseDateVal(dataStr),
              veiculo: getVal(row, veiculoIdx),
              problema: getVal(row, problemaIdx),
              servico: getVal(row, servicoIdx),
              mecanico: getVal(row, mecanicoIdx),
              status: getVal(row, statusIdx),
              dataEntrada: getVal(row, dataEntIdx),
              dataSaida: getVal(row, dataSaiIdx),
              horasParado: getVal(row, horasParadoIdx),
              observacao: getVal(row, observacaoIdx),
            };
          });
        console.log('[MANUT] Total parsed:', parsed.length);
        console.log('[MANUT] Status distribution:', parsed.reduce((acc, r) => { const s = r.status.trim() || '(vazio)'; acc[s] = (acc[s] || 0) + 1; return acc; }, {} as Record<string, number>));
        setManutencoes(parsed);
      }

      // Parse estoques helper
      const parseEstoque = (data: any[][]): EstoqueRecord[] => {
        if (!data || data.length <= 1) return [];
        const hdrs = data[0] as string[];
        const findIdx = (keywords: string[]) =>
          hdrs.findIndex(h => h && keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

        const descIdx = findIdx(['descricao']);
        const dataIdx = findIdx(['data']);
        const estAntIdx = findIdx(['estoque anterio']);
        const entradaIdx = findIdx(['entrada']);
        const saidaIdx = findIdx(['saida']);
        const estAtualIdx = findIdx(['estoqueatual', 'estoque atual']);
        const saidaComboiosIdx = findIdx(['saida_para_comboios']);
        const saidaEquipIdx = findIdx(['saida_para_equipamentos']);

        const getVal = (row: any[], idx: number) => idx >= 0 ? (row[idx] || '') : '';
        const parseNum = (v: string) => {
          if (!v) return 0;
          const num = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
          return isNaN(num) ? 0 : num;
        };

        return data.slice(1)
          .filter(row => getVal(row, descIdx))
          .map(row => {
            const dataStr = getVal(row, dataIdx);
            return {
              descricao: getVal(row, descIdx),
              data: dataStr,
              dateParsed: parseDateVal(dataStr),
              estoqueAnterior: parseNum(getVal(row, estAntIdx)),
              entrada: parseNum(getVal(row, entradaIdx)),
              saida: parseNum(getVal(row, saidaIdx)),
              estoqueAtual: parseNum(getVal(row, estAtualIdx)),
              saidaParaComboios: saidaComboiosIdx >= 0 ? parseNum(getVal(row, saidaComboiosIdx)) : undefined,
              saidaParaEquipamentos: saidaEquipIdx >= 0 ? parseNum(getVal(row, saidaEquipIdx)) : undefined,
            };
          });
      };

      setEstoqueComboios(parseEstoque(estComboiosData));
      setEstoqueTanques(parseEstoque(estTanquesData));
    } catch (error) {
      console.error('Error loading abastecimentos/manutenções:', error);
    } finally {
      setIsLoading(false);
    }
  }, [readSheet]);

  useEffect(() => {
    loadData();
  }, []);

  const filteredAbastecimentos = useMemo(() => {
    return abastecimentos.filter(r => {
      if (selectedDate && r.dateParsed) {
        const selStart = new Date(selectedDate);
        selStart.setHours(0, 0, 0, 0);
        const selEnd = new Date(selectedDate);
        selEnd.setHours(23, 59, 59, 999);
        if (r.dateParsed < selStart || r.dateParsed > selEnd) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          r.veiculo.toLowerCase().includes(term) ||
          r.empresa.toLowerCase().includes(term) ||
          r.motorista.toLowerCase().includes(term)
        );
      }
      return true;
    }).sort((a, b) => (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR'));
  }, [abastecimentos, searchTerm, selectedDate]);

  // Separar comboio dos demais (tanque)
  const isComboio = (r: AbastecimentoRecord) => r.descricao.toLowerCase().includes('comboio');
  const isTanque = (r: AbastecimentoRecord) => r.descricao.toLowerCase().includes('tanque');

  const abastecimentosGerais = useMemo(() => filteredAbastecimentos.filter(r => !isComboio(r) && !isTanque(r)), [filteredAbastecimentos]);
  const abastecimentosComboio = useMemo(() => filteredAbastecimentos.filter(r => isComboio(r)), [filteredAbastecimentos]);
  const abastecimentosTanque = useMemo(() => filteredAbastecimentos.filter(r => isTanque(r)), [filteredAbastecimentos]);

  const calcLitros = (list: AbastecimentoRecord[]) =>
    list.reduce((sum, r) => {
      const num = parseFloat(String(r.quantidade).replace(/\./g, '').replace(',', '.'));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);

  const calcSaidas = (list: AbastecimentoRecord[]) =>
    list.filter(r => r.tipo.toLowerCase().includes('saida') || r.tipo.toLowerCase().includes('saída')).length;

  // KPIs gerais
  const totalAbastecimentos = filteredAbastecimentos.length;
  const totalLitrosGeral = useMemo(() => calcLitros(filteredAbastecimentos), [filteredAbastecimentos]);

  // KPIs tanque (sem comboio) - from Abastecimentos
  const totalTanque = abastecimentosGerais.length;
  const totalSaidasTanque = calcSaidas(abastecimentosGerais);
  const totalLitrosTanque = useMemo(() => calcLitros(abastecimentosGerais), [abastecimentosGerais]);
  const veiculosTanque = useMemo(() => new Set(abastecimentosGerais.map(r => r.veiculo).filter(Boolean)).size, [abastecimentosGerais]);

  // KPIs comboio - from Abastecimentos
  const totalComboio = abastecimentosComboio.length;
  const totalSaidasComboio = calcSaidas(abastecimentosComboio);
  const totalLitrosComboio = useMemo(() => calcLitros(abastecimentosComboio), [abastecimentosComboio]);
  const veiculosComboio = useMemo(() => new Set(abastecimentosComboio.map(r => r.veiculo).filter(Boolean)).size, [abastecimentosComboio]);

  // Stock summaries from Estoques sheets - filter by selected date
  const filteredEstoqueComboios = useMemo(() => {
    if (!selectedDate) return estoqueComboios;
    return estoqueComboios.filter(r => {
      if (!r.dateParsed) return false;
      const sel = new Date(selectedDate);
      sel.setHours(0, 0, 0, 0);
      const d = new Date(r.dateParsed);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === sel.getTime();
    });
  }, [estoqueComboios, selectedDate]);

  const filteredEstoqueTanques = useMemo(() => {
    if (!selectedDate) return estoqueTanques;
    return estoqueTanques.filter(r => {
      if (!r.dateParsed) return false;
      const sel = new Date(selectedDate);
      sel.setHours(0, 0, 0, 0);
      const d = new Date(r.dateParsed);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === sel.getTime();
    });
  }, [estoqueTanques, selectedDate]);

  // Stock KPIs - Comboios
  const estoqueComboioResumo = useMemo(() => {
    const items = filteredEstoqueComboios;
    // Group by descricao, get latest record per group
    const byDesc = new Map<string, EstoqueRecord[]>();
    items.forEach(r => {
      if (!byDesc.has(r.descricao)) byDesc.set(r.descricao, []);
      byDesc.get(r.descricao)!.push(r);
    });
    const totalEntrada = items.reduce((s, r) => s + r.entrada, 0);
    const totalSaida = items.reduce((s, r) => s + r.saida, 0);
    // Get latest estoque atual per description
    const latestEstoques: { descricao: string; estoqueAtual: number }[] = [];
    byDesc.forEach((records, desc) => {
      const sorted = records.sort((a, b) => {
        if (!a.dateParsed || !b.dateParsed) return 0;
        return b.dateParsed.getTime() - a.dateParsed.getTime();
      });
      latestEstoques.push({ descricao: desc, estoqueAtual: sorted[0].estoqueAtual });
    });
    const totalEstoqueAtual = latestEstoques.reduce((s, r) => s + r.estoqueAtual, 0);
    return { totalEntrada, totalSaida, totalEstoqueAtual, veiculos: byDesc.size, detalhes: latestEstoques };
  }, [filteredEstoqueComboios]);

  // Stock KPIs - Tanques
  const estoqueTanqueResumo = useMemo(() => {
    const items = filteredEstoqueTanques;
    const byDesc = new Map<string, EstoqueRecord[]>();
    items.forEach(r => {
      if (!byDesc.has(r.descricao)) byDesc.set(r.descricao, []);
      byDesc.get(r.descricao)!.push(r);
    });
    const totalEntrada = items.reduce((s, r) => s + r.entrada, 0);
    const totalSaida = items.reduce((s, r) => s + r.saida, 0);
    const totalSaidaComboios = items.reduce((s, r) => s + (r.saidaParaComboios || 0), 0);
    const totalSaidaEquip = items.reduce((s, r) => s + (r.saidaParaEquipamentos || 0), 0);
    const latestEstoques: { descricao: string; estoqueAtual: number }[] = [];
    byDesc.forEach((records, desc) => {
      const sorted = records.sort((a, b) => {
        if (!a.dateParsed || !b.dateParsed) return 0;
        return b.dateParsed.getTime() - a.dateParsed.getTime();
      });
      latestEstoques.push({ descricao: desc, estoqueAtual: sorted[0].estoqueAtual });
    });
    const totalEstoqueAtual = latestEstoques.reduce((s, r) => s + r.estoqueAtual, 0);
    return { totalEntrada, totalSaida, totalSaidaComboios, totalSaidaEquip, totalEstoqueAtual, veiculos: byDesc.size, detalhes: latestEstoques };
  }, [filteredEstoqueTanques]);

  const manutencaoStats = useMemo(() => {
    const emManutencao = manutencoes.filter(r => {
      const st = r.status.toLowerCase().trim();
      // Exclude finalized/concluded AND records with dataSaida filled (already left maintenance)
      const isFinished = st.includes('finaliz') || st.includes('conclu');
      const hasExited = r.dataSaida && r.dataSaida.trim() !== '';
      return st !== '' && !isFinished && !hasExited;
    });
    // Group by status
    const porStatus: Record<string, number> = {};
    emManutencao.forEach(r => {
      const st = r.status.trim() || 'Sem status';
      porStatus[st] = (porStatus[st] || 0) + 1;
    });
    // Separate "aguardando peças"
    const aguardandoPecas = emManutencao.filter(r => {
      const st = r.status.toLowerCase().trim();
      return st.includes('aguardando') && st.includes('pe');
    }).length;
    const emOficina = emManutencao.length - aguardandoPecas;
    // Status breakdown for "em oficina" (excluding aguardando peças)
    const porStatusOficina: Record<string, number> = {};
    emManutencao.forEach(r => {
      const st = r.status.trim() || 'Sem status';
      const stLow = st.toLowerCase();
      if (!(stLow.includes('aguardando') && stLow.includes('pe'))) {
        porStatusOficina[st] = (porStatusOficina[st] || 0) + 1;
      }
    });
    return { total: emManutencao.length, porStatus, aguardandoPecas, emOficina, porStatusOficina };
  }, [manutencoes]);

  const formatNumber = (val: string) => {
    if (!val) return '-';
    const num = parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? val : num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const renderAbastecimentoRow = (r: AbastecimentoRecord, idx: number) => {
    const isEquipamento = r.categoria.toLowerCase().includes('equipamento');
    const anterior = isEquipamento ? r.horimetroAnterior : r.kmAnterior;
    const atual = isEquipamento ? r.horimetroAtual : r.kmAtual;
    const parseNum = (v: string) => parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    const antNum = parseNum(anterior);
    const atualNum = parseNum(atual);
    const qtdNum = parseNum(r.quantidade);
    const intervalo = (!isNaN(antNum) && !isNaN(atualNum)) ? Math.abs(atualNum - antNum) : NaN;
    let consumo = '-';
    if (!isNaN(intervalo) && intervalo > 0 && !isNaN(qtdNum) && qtdNum > 0) {
      consumo = isEquipamento ? (qtdNum / intervalo).toFixed(2) + ' L/h' : (intervalo / qtdNum).toFixed(2) + ' Km/L';
    }
    const intervaloFormatted = !isNaN(intervalo) ? (isEquipamento ? intervalo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' h' : intervalo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km') : '-';
    return (
      <TableRow key={r.id || idx}>
        <TableCell className="text-xs whitespace-nowrap">{r.data}</TableCell>
        <TableCell className="text-xs whitespace-nowrap">{r.hora || '-'}</TableCell>
        <TableCell className="text-xs font-medium text-primary whitespace-nowrap">{r.veiculo}</TableCell>
        <TableCell className="text-xs">{r.motorista || '-'}</TableCell>
        <TableCell className="text-xs">{r.empresa || '-'}</TableCell>
        <TableCell className="text-xs text-right tabular-nums font-medium">{formatNumber(r.quantidade)}</TableCell>
        <TableCell className="text-xs text-right tabular-nums">{formatNumber(anterior)}</TableCell>
        <TableCell className="text-xs text-right tabular-nums">{formatNumber(atual)}</TableCell>
        <TableCell className="text-xs text-right tabular-nums">{intervaloFormatted}</TableCell>
        <TableCell className="text-xs text-right tabular-nums font-medium text-primary bg-primary/5">{consumo}</TableCell>
      </TableRow>
    );
  };

  const abastecimentoTableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead className="text-xs">Data</TableHead>
        <TableHead className="text-xs">Hora</TableHead>
        
        <TableHead className="text-xs">Veículo</TableHead>
        <TableHead className="text-xs">Motorista</TableHead>
        <TableHead className="text-xs">Empresa</TableHead>
        <TableHead className="text-xs text-right">Qtd (L)</TableHead>
        <TableHead className="text-xs text-right">Hor/Km Anterior</TableHead>
        <TableHead className="text-xs text-right">Hor/Km Atual</TableHead>
        <TableHead className="text-xs text-right">Intervalo</TableHead>
        <TableHead className="text-xs text-right bg-primary/5">Consumo</TableHead>
      </TableRow>
    </TableHeader>
  );

  const renderAbastecimentoTable = (list: AbastecimentoRecord[]) => {
    // Group by descricao
    const groups = new Map<string, AbastecimentoRecord[]>();
    list.forEach(r => {
      const key = r.descricao || 'Sem descrição';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    const sortedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (list.length === 0) {
      return (
        <Table>
          {abastecimentoTableHeader}
          <TableBody>
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                Nenhum registro encontrado
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
    }

    return (
      <div className="space-y-2">
        {sortedKeys.map(key => {
          const items = groups.get(key)!;
          const litros = calcLitros(items);
          return (
            <Collapsible key={key}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-2.5 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors text-left group">
                <ChevronDown className="w-4 h-4 text-muted-foreground group-data-[state=closed]:hidden" />
                <ChevronRight className="w-4 h-4 text-muted-foreground group-data-[state=open]:hidden" />
                <span className="text-sm font-semibold">{key}</span>
                <Badge variant="outline" className="text-[10px] ml-auto">{items.length} reg · {litros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Table>
                  {abastecimentoTableHeader}
                  <TableBody>
                    {items.slice(0, 200).map((r, idx) => renderAbastecimentoRow(r, idx))}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };


  const clearDate = () => {
    setSelectedDate(undefined);
  };

  if (isLoading && abastecimentos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg md:text-2xl font-bold">Abastecimento e Manutenção</h1>
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:gap-4 grid-cols-3">

        {/* Estoque Total da Obra */}
        <Card className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
          <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] md:text-sm font-medium text-emerald-700 dark:text-emerald-300 truncate">Estoque Total Obra</p>
                <p className="text-xl md:text-3xl font-bold text-emerald-800 dark:text-emerald-200 leading-tight">
                  {(estoqueTanqueResumo.totalEstoqueAtual + estoqueComboioResumo.totalEstoqueAtual).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                </p>
                <div className="flex flex-col text-[10px] md:text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  <span>Tanques: {estoqueTanqueResumo.totalEstoqueAtual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</span>
                  <span>Comboios: {estoqueComboioResumo.totalEstoqueAtual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</span>
                </div>
              </div>
              <div className="p-1.5 md:p-2 bg-emerald-200 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-300 rounded-lg shrink-0">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saídas do Dia - apenas Veículo e Equipamento */}
        {(() => {
          const saidasVeiculo = filteredAbastecimentos.filter(r => r.categoria.toLowerCase().includes('veiculo') || r.categoria.toLowerCase().includes('veículo'));
          const saidasEquipamento = filteredAbastecimentos.filter(r => r.categoria.toLowerCase().includes('equipamento'));
          const litrosVeiculo = calcLitros(saidasVeiculo);
          const litrosEquipamento = calcLitros(saidasEquipamento);
          return (
            <Card className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
              <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] md:text-sm font-medium text-red-700 dark:text-red-300 truncate">Saídas do Dia</p>
                    <p className="text-xl md:text-3xl font-bold text-red-800 dark:text-red-200 leading-tight">
                      {(litrosVeiculo + litrosEquipamento).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                    </p>
                  </div>
                  <div className="p-1.5 md:p-2 bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-300 rounded-lg shrink-0">
                    <Truck className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Manutenções Ativas */}
        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setManutModalFilter('all')}>
          <CardContent className="p-3 md:pt-6 md:pb-4 md:px-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] md:text-sm font-medium text-amber-700 dark:text-amber-300 truncate">Manutenções Ativas</p>
                <p className="text-xl md:text-3xl font-bold text-amber-800 dark:text-amber-200 leading-tight">
                  {manutencaoStats.total}
                </p>
                <div className="flex flex-col text-[10px] md:text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {manutencaoStats.emOficina > 0 && <span>Em oficina: {manutencaoStats.emOficina}</span>}
                  {manutencaoStats.aguardandoPecas > 0 && <span>Aguard. peças: {manutencaoStats.aguardandoPecas}</span>}
                </div>
              </div>
              <div className="p-1.5 md:p-2 bg-amber-200 text-amber-700 dark:bg-amber-800 dark:text-amber-300 rounded-lg shrink-0">
                <Wrench className="w-4 h-4 md:w-5 md:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Estoque — todos os locais unificados */}
      <Card>
        <CardContent className="pt-4 md:pt-6 pb-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Fuel className="w-4 h-4 text-primary" />
            Estoque Atual por Local
          </p>
          <div className="space-y-1.5">
            {/* Tanques */}
            {estoqueTanqueResumo.detalhes.map(d => (
              <div key={`t-${d.descricao}`} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{d.descricao}</span>
                <span className="font-semibold tabular-nums">{d.estoqueAtual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</span>
              </div>
            ))}
            {/* Comboios */}
            {estoqueComboioResumo.detalhes.map(d => (
              <div key={`c-${d.descricao}`} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{d.descricao}</span>
                <span className="font-semibold tabular-nums">{d.estoqueAtual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L</span>
              </div>
            ))}
            {estoqueTanqueResumo.detalhes.length === 0 && estoqueComboioResumo.detalhes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Sem dados de estoque para a data selecionada</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
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
                  <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal text-xs", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {selectedDate && (
                <Button variant="ghost" size="icon" onClick={clearDate} title="Limpar data">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento Geral (sem comboio) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm md:text-base">
            <Fuel className="w-4 h-4 text-primary" />
            Abastecimentos Gerais ({abastecimentosGerais.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 pt-0">
          <div className="overflow-x-auto">
            {renderAbastecimentoTable(abastecimentosGerais)}
          </div>
        </CardContent>
      </Card>




      {/* Manutenções em aberto */}
      {(() => {
        const manutencoesAbertas = manutencoes.filter(r => {
          const st = r.status.toLowerCase();
          const hasExit = r.dataSaida && r.dataSaida.trim() !== '';
          return st !== '' && !st.includes('finaliza') && !st.includes('conclu') && !st.includes('encerrad') && !hasExit;
        });
        if (manutencoesAbertas.length === 0) return null;

        // Get unique statuses
        const statusList = [...new Set(manutencoesAbertas.map(r => r.status.trim()).filter(Boolean))].sort();

        // Filter by selected status
        const filtered = manutStatusFilter === 'todos' ? manutencoesAbertas : manutencoesAbertas.filter(r => r.status.trim() === manutStatusFilter);

        // Group by status
        const grouped = new Map<string, typeof manutencoesAbertas>();
        filtered.forEach(r => {
          const st = r.status.trim() || 'Sem status';
          if (!grouped.has(st)) grouped.set(st, []);
          grouped.get(st)!.push(r);
        });

        const getStatusColor = (st: string) => {
          const stLow = st.toLowerCase();
          if (stLow.includes('aberta') || stLow.includes('aberto')) return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800';
          if (stLow.includes('aguardando') && stLow.includes('pe')) return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800';
          if (stLow.includes('aguardando')) return 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800';
          if (stLow.includes('andamento')) return 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800';
          return 'bg-card border-border';
        };

        const getBadgeColor = (st: string) => {
          const stLow = st.toLowerCase();
          if (stLow.includes('aberta') || stLow.includes('aberto')) return 'border-red-400 text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-300';
          if (stLow.includes('aguardando') && stLow.includes('pe')) return 'border-amber-400 text-amber-700 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300';
          if (stLow.includes('aguardando')) return 'border-orange-400 text-orange-700 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-300';
          if (stLow.includes('andamento')) return 'border-blue-400 text-blue-700 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300';
          return 'border-muted-foreground/30';
        };

        return (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <Wrench className="w-4 h-4 text-amber-600" />
                Manutenções em Aberto ({filtered.length})
              </CardTitle>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant={manutStatusFilter === 'todos' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-[10px] px-2.5"
                  onClick={() => setManutStatusFilter('todos')}
                >
                  Todos ({manutencoesAbertas.length})
                </Button>
                {statusList.map(st => {
                  const count = manutencoesAbertas.filter(r => r.status.trim() === st).length;
                  return (
                    <Button
                      key={st}
                      variant={manutStatusFilter === st ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-[10px] px-2.5"
                      onClick={() => setManutStatusFilter(st)}
                    >
                      {st} ({count})
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-4 pt-0">
            <div className="space-y-3">
              {[...grouped.entries()].map(([status, items]) => (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{status}</span>
                    <Badge variant="outline" className={cn("text-[10px]", getBadgeColor(status))}>{items.length}</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((r, idx) => (
                      <div key={r.id || idx} className={cn("border rounded-lg p-3 space-y-1.5", getStatusColor(r.status))}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-primary">{r.veiculo || '-'}</span>
                          <Badge variant="outline" className={cn("text-[10px] font-semibold", getBadgeColor(r.status))}>{r.status || '-'}</Badge>
                        </div>
                        {r.problema && <p className="text-xs text-foreground font-medium line-clamp-2">{r.problema}</p>}
                        {r.servico && <p className="text-xs text-muted-foreground line-clamp-1">{r.servico}</p>}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          {r.dataEntrada && <span>📅 Entrada: {r.dataEntrada}</span>}
                          {r.mecanico && <span>🔧 {r.mecanico}</span>}
                          {r.horasParado && (
                            <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/5 text-[10px] h-4">
                              ⏱ {r.horasParado}h parado
                            </Badge>
                          )}
                        </div>
                        {r.observacao && <p className="text-[10px] text-muted-foreground italic line-clamp-2">{r.observacao}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        );
      })()}
      {/* Modal de Manutenções */}
      <Dialog open={manutModalFilter !== null} onOpenChange={(open) => !open && setManutModalFilter(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" /> Manutenções em Aberto
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const modalItems = manutencoes.filter(r => {
              const st = r.status.toLowerCase().trim();
              const hasExit = r.dataSaida && r.dataSaida.trim() !== '';
              return st !== '' && !st.includes('finaliz') && !st.includes('conclu') && !hasExit;
            });
            const modalStatusList = [...new Set(modalItems.map(r => r.status.trim()).filter(Boolean))].sort();

            const getBadgeColorModal = (st: string) => {
              const stLow = st.toLowerCase();
              if (stLow.includes('aberta') || stLow.includes('aberto')) return 'border-red-400 text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-300';
              if (stLow.includes('aguardando') && stLow.includes('pe')) return 'border-amber-400 text-amber-700 bg-amber-100 dark:bg-amber-900/50 dark:text-amber-300';
              if (stLow.includes('aguardando')) return 'border-orange-400 text-orange-700 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-300';
              if (stLow.includes('andamento')) return 'border-blue-400 text-blue-700 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300';
              return 'border-muted-foreground/30';
            };

            // Group by status
            const grouped = new Map<string, ManutencaoRecord[]>();
            modalItems.forEach(r => {
              const st = r.status.trim() || 'Sem status';
              if (!grouped.has(st)) grouped.set(st, []);
              grouped.get(st)!.push(r);
            });

            return (
              <div className="overflow-auto flex-1 space-y-2 pr-1">
                {[...grouped.entries()]
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([status, items]) => (
                  <Collapsible key={status} defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2.5 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors text-left group">
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-data-[state=closed]:hidden" />
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-data-[state=open]:hidden" />
                      <span className="text-sm font-semibold">{status}</span>
                      <Badge variant="outline" className={cn("text-[10px] ml-auto", getBadgeColorModal(status))}>{items.length}</Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Nº OS</TableHead>
                            <TableHead className="text-xs">Veículo</TableHead>
                            <TableHead className="text-xs">Problema</TableHead>
                            <TableHead className="text-xs">Mecânico</TableHead>
                            <TableHead className="text-xs">Entrada</TableHead>
                            <TableHead className="text-xs text-right">T. Parado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((r, i) => (
                            <TableRow key={r.id || i}>
                              <TableCell className="text-xs font-mono">{r.id || '-'}</TableCell>
                              <TableCell className="text-xs font-semibold">{r.veiculo}</TableCell>
                              <TableCell className="text-xs max-w-[200px] truncate">{r.problema || '-'}</TableCell>
                              <TableCell className="text-xs">{r.mecanico || '-'}</TableCell>
                              <TableCell className="text-xs">{r.dataEntrada || '-'}</TableCell>
                              <TableCell className="text-xs text-right font-medium">
                                {r.horasParado ? (
                                  <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/5 text-[10px]">
                                    {r.horasParado}
                                  </Badge>
                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
