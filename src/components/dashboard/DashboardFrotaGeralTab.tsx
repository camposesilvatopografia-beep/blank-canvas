import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Loader2, RefreshCw, Truck, Search, Building2, Settings2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface FrotaItem {
  codigo: string;
  motorista: string;
  potencia: string;
  categoria: string;
  descricao: string;
  empresa: string;
  obra: string;
  status: string;
}

export function DashboardFrotaGeralTab() {
  const { readSheet, loading } = useGoogleSheets();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [frota, setFrota] = useState<FrotaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('todas');
  const [filterCategoria, setFilterCategoria] = useState('todas');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterDescricao, setFilterDescricao] = useState('todas');
  const [activeDetailFilter, setActiveDetailFilter] = useState<{ type: 'empresa' | 'descricao'; value: string } | null>(null);
  const [expandedSubDesc, setExpandedSubDesc] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await readSheet('Frota Geral');
      console.log('Frota Geral raw data:', data.length, 'rows');
      
      if (data.length > 1) {
        const hdrs = data[0].map((h: string) => String(h).trim());
        const getIdx = (name: string) => hdrs.findIndex((h: string) => h.toLowerCase() === name.toLowerCase());

        const codIdx = getIdx('Codigo');
        const motIdx = getIdx('Motorista');
        const potIdx = getIdx('Potencia');
        const catIdx = getIdx('Categoria');
        const descIdx = getIdx('Descricao');
        const empIdx = getIdx('Empresa');
        const obraIdx = getIdx('Obra');
        const statusIdx = getIdx('Status');

        console.log('Column indices:', { codIdx, motIdx, potIdx, catIdx, descIdx, empIdx, obraIdx, statusIdx });

        const items: FrotaItem[] = data.slice(1)
          .filter((row: any[]) => row.some((cell: any) => cell?.toString().trim()))
          .map((row: any[]) => ({
            codigo: codIdx >= 0 ? String(row[codIdx] || '').trim() : '',
            motorista: motIdx >= 0 ? String(row[motIdx] || '').trim() : '',
            potencia: potIdx >= 0 ? String(row[potIdx] || '').trim() : '',
            categoria: catIdx >= 0 ? String(row[catIdx] || '').trim() : '',
            descricao: descIdx >= 0 ? String(row[descIdx] || '').trim() : '',
            empresa: empIdx >= 0 ? String(row[empIdx] || '').trim() : '',
            obra: obraIdx >= 0 ? String(row[obraIdx] || '').trim() : '',
            status: statusIdx >= 0 ? String(row[statusIdx] || '').trim() : '',
          }))
          .filter(item => item.codigo || item.descricao || item.empresa);

        console.log('Frota Geral parsed items:', items.length);
        setFrota(items);
      }
    } catch (error) {
      console.error('Error loading Frota Geral:', error);
    } finally {
      setIsLoading(false);
    }
  }, [readSheet]);

  useEffect(() => {
    loadData();
  }, []);

  const empresas = useMemo(() => [...new Set(frota.map(f => f.empresa).filter(Boolean))].sort(), [frota]);
  const categorias = useMemo(() => [...new Set(frota.map(f => f.categoria).filter(Boolean))].sort(), [frota]);
  const statuses = useMemo(() => [...new Set(frota.map(f => f.status).filter(Boolean))].sort(), [frota]);
  const descricoes = useMemo(() => [...new Set(frota.map(f => f.descricao).filter(Boolean))].sort(), [frota]);

  const filteredFrota = useMemo(() => {
    return frota.filter(f => {
      if (searchTerm && !f.codigo.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !f.motorista.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !f.descricao.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterEmpresa !== 'todas' && f.empresa !== filterEmpresa) return false;
      if (filterCategoria !== 'todas' && f.categoria !== filterCategoria) return false;
      if (filterStatus !== 'todos' && f.status !== filterStatus) return false;
      if (filterDescricao !== 'todas' && f.descricao !== filterDescricao) return false;
      if (activeDetailFilter) {
        if (activeDetailFilter.type === 'empresa' && f.empresa !== activeDetailFilter.value) return false;
        if (activeDetailFilter.type === 'descricao' && f.descricao !== activeDetailFilter.value) return false;
      }
      return true;
    });
  }, [frota, searchTerm, filterEmpresa, filterCategoria, filterStatus, filterDescricao, activeDetailFilter]);

  const kpis = useMemo(() => {
    const totalEquipamentos = frota.length;
    const isObraSaneamento = (f: FrotaItem) => f.empresa.toLowerCase().includes('obra saneamento');
    const mobilizados = frota.filter(f => f.status.toLowerCase() === 'mobilizado' && !isObraSaneamento(f)).length;
    const desmobilizados = frota.filter(f => f.status.toLowerCase() === 'desmobilizado' || isObraSaneamento(f)).length;
    const veiculos = frota.filter(f => f.categoria.toLowerCase().includes('veiculo') || f.categoria.toLowerCase().includes('veículo')).length;
    const equipamentos = frota.filter(f => f.categoria.toLowerCase().includes('equipamento')).length;

    const porEmpresa = new Map<string, number>();
    frota.forEach(f => {
      if (f.empresa) porEmpresa.set(f.empresa, (porEmpresa.get(f.empresa) || 0) + 1);
    });

    const porDescricao = new Map<string, number>();
    frota.forEach(f => {
      if (f.descricao) porDescricao.set(f.descricao, (porDescricao.get(f.descricao) || 0) + 1);
    });

    return {
      totalEquipamentos, mobilizados, desmobilizados, veiculos, equipamentos,
      porEmpresa: Array.from(porEmpresa.entries()).sort((a, b) => b[1] - a[1]),
      porDescricao: Array.from(porDescricao.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [frota]);

  const RESUMO_EMPRESAS = ['Engemat', 'L. Pereira', 'A. Barreto', 'Consórcio', 'Terceiro'];

  const resumoData = useMemo(() => {
    const frotaResumo = frota.filter(f => RESUMO_EMPRESAS.some(e => f.empresa.toLowerCase() === e.toLowerCase()) && f.status.toLowerCase() === 'mobilizado');

    const descCount = new Map<string, number>();
    frotaResumo.forEach(f => {
      if (f.descricao) descCount.set(f.descricao, (descCount.get(f.descricao) || 0) + 1);
    });
    // Only keep descriptions that have at least 1 item (filter out zero columns)
    const descricoes = Array.from(descCount.entries())
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    const map = new Map<string, { byDesc: Map<string, number>; total: number }>();
    frotaResumo.forEach(f => {
      if (!f.empresa) return;
      const entry = map.get(f.empresa) || { byDesc: new Map(), total: 0 };
      entry.total++;
      if (f.descricao) entry.byDesc.set(f.descricao, (entry.byDesc.get(f.descricao) || 0) + 1);
      map.set(f.empresa, entry);
    });

    const rows = RESUMO_EMPRESAS
      .filter(e => map.has(e))
      .map(e => ({ empresa: e, byDesc: map.get(e)!.byDesc, total: map.get(e)!.total }));

    const colTotals = new Map<string, number>();
    descricoes.forEach(d => {
      const total = rows.reduce((s, r) => s + (r.byDesc.get(d) || 0), 0);
      if (total > 0) colTotals.set(d, total);
    });

    // Final filter: only descriptions with total > 0
    const filteredDescricoes = descricoes.filter(d => (colTotals.get(d) || 0) > 0);

    return { descricoes: filteredDescricoes, rows, colTotals, grandTotal: rows.reduce((s, r) => s + r.total, 0) };
  }, [frota]);

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'mobilizado') return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700';
    if (s === 'desmobilizado') return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700';
    return 'bg-muted text-muted-foreground border-border';
  };

  const handleClickEmpresa = (empresa: string) => {
    setActiveDetailFilter(prev => 
      prev?.type === 'empresa' && prev.value === empresa ? null : { type: 'empresa', value: empresa }
    );
    setExpandedSubDesc(null);
  };

  const handleClickDescricao = (descricao: string) => {
    setActiveDetailFilter(prev =>
      prev?.type === 'descricao' && prev.value === descricao ? null : { type: 'descricao', value: descricao }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base md:text-2xl font-bold">Frota Geral da Obra</h1>
          <p className="text-[10px] md:text-sm text-muted-foreground">
            {frota.length} equipamentos cadastrados
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          <span className="ml-1.5 hidden md:inline">Atualizar</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-1.5 md:gap-2 grid-cols-3">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
          <CardContent className="p-2 md:p-4">
            <p className="text-[9px] md:text-xs font-medium opacity-80">Total Geral</p>
            <p className="text-lg md:text-3xl font-bold">{kpis.totalEquipamentos}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
          <CardContent className="p-2 md:p-4">
            <p className="text-[9px] md:text-xs font-medium opacity-80">Mobilizados</p>
            <p className="text-lg md:text-3xl font-bold">{kpis.mobilizados}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0">
          <CardContent className="p-2 md:p-4">
            <p className="text-[9px] md:text-xs font-medium opacity-80">Desmobilizados</p>
            <p className="text-lg md:text-3xl font-bold">{kpis.desmobilizados}</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Empresa */}
      <Card>
        <CardHeader className="pb-1 p-2 md:p-4">
          <CardTitle className="text-xs md:text-base flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
            Resumo por Empresa <span className="text-muted-foreground font-normal text-[10px] md:text-xs ml-1">(Mobilizados)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-1.5 md:p-4 pt-0">
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="text-[10px] md:text-sm w-full">
                <TableHeader>
                  <TableRow className="bg-primary/10">
                    <TableHead className="font-bold whitespace-nowrap sticky left-0 bg-primary/10 z-10 min-w-[80px] md:min-w-[120px] py-2 px-2 md:px-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">Empresa</TableHead>
                    {resumoData.descricoes.map(d => (
                      <TableHead key={d} className="font-bold text-center whitespace-nowrap px-2 md:px-3 py-2 min-w-[50px]">
                        {d.replace('Caminhão ', 'Cam. ').replace('Escavadeira ', 'Esc. ').replace('Motoniveladora', 'Moto.')}
                      </TableHead>
                    ))}
                    <TableHead className="font-bold text-center whitespace-nowrap px-2 md:px-3 py-2 bg-primary/20 min-w-[50px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumoData.rows.map((r, idx) => (
                    <TableRow key={r.empresa} className={cn("cursor-pointer hover:bg-primary/5 transition-colors", idx % 2 === 0 && "bg-muted/20")} onClick={() => handleClickEmpresa(r.empresa)}>
                      <TableCell className={cn("font-semibold whitespace-nowrap sticky left-0 z-10 py-2 px-2 md:px-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]", idx % 2 === 0 ? "bg-muted/20" : "bg-card", activeDetailFilter?.type === 'empresa' && activeDetailFilter.value === r.empresa && "text-primary")}>{r.empresa}</TableCell>
                      {resumoData.descricoes.map(d => {
                        const val = r.byDesc.get(d) || 0;
                        return (
                          <TableCell key={d} className={cn("text-center py-2 px-2 md:px-3", val === 0 ? "text-muted-foreground/30" : "font-semibold text-foreground")}>
                            {val > 0 ? val : '–'}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold py-2 px-2 md:px-3 bg-primary/5">{r.total}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/10 font-bold border-t-2 border-primary/30">
                    <TableCell className="font-bold whitespace-nowrap sticky left-0 bg-primary/10 z-10 py-2 px-2 md:px-3 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">TOTAL</TableCell>
                    {resumoData.descricoes.map(d => (
                      <TableCell key={d} className="text-center font-bold py-2 px-2 md:px-3">{resumoData.colTotals.get(d) || 0}</TableCell>
                    ))}
                    <TableCell className="text-center font-bold py-2 px-2 md:px-3 bg-primary/20">{resumoData.grandTotal}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totais por Empresa */}
      <Card>
        <CardHeader className="pb-1 p-2 md:p-4">
          <CardTitle className="text-xs md:text-base flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
            Totais por Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 pt-0">
          <div className="space-y-0.5">
            {kpis.porEmpresa.map(([empresa, total]) => {
              const isExpanded = activeDetailFilter?.type === 'empresa' && activeDetailFilter.value === empresa;
              const descBreakdown = isExpanded
                ? Array.from(
                    frota
                      .filter(f => f.empresa === empresa)
                      .reduce((map, f) => {
                        if (f.descricao) map.set(f.descricao, (map.get(f.descricao) || 0) + 1);
                        return map;
                      }, new Map<string, number>())
                      .entries()
                  ).sort((a, b) => b[1] - a[1])
                : [];

              return (
                <div key={empresa}>
                  <div
                    onClick={() => handleClickEmpresa(empresa)}
                    className={cn(
                      "flex items-center justify-between py-1 px-2 rounded-md border-b last:border-0 cursor-pointer transition-colors hover:bg-primary/10",
                      isExpanded && "bg-primary/10 ring-1 ring-primary/30"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {isExpanded ? <ChevronDown className="w-3 h-3 text-primary shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                      <span className="text-[11px] md:text-sm font-medium truncate">{empresa}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] md:text-xs font-bold shrink-0">{total}</Badge>
                  </div>
                  {isExpanded && descBreakdown.length > 0 && (
                    <div className="ml-5 pl-2 border-l-2 border-primary/20 my-0.5 space-y-0.5">
                      {descBreakdown.map(([desc, qty]) => {
                        const subKey = `${empresa}::${desc}`;
                        const isSubExpanded = expandedSubDesc === subKey;
                        const vehicles = isSubExpanded
                          ? frota.filter(f => f.empresa === empresa && f.descricao === desc)
                          : [];
                        return (
                          <div key={desc}>
                            <div
                              onClick={() => setExpandedSubDesc(prev => prev === subKey ? null : subKey)}
                              className={cn(
                                "flex items-center justify-between py-0.5 px-2 text-[11px] cursor-pointer hover:bg-muted/50 rounded transition-colors",
                                isSubExpanded && "bg-muted/60"
                              )}
                            >
                              <div className="flex items-center gap-1">
                                {isSubExpanded ? <ChevronDown className="w-3 h-3 text-primary shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                                <span className="truncate text-muted-foreground">{desc}</span>
                              </div>
                              <span className="font-semibold text-foreground shrink-0">{qty}</span>
                            </div>
                            {isSubExpanded && vehicles.length > 0 && (
                              <div className="ml-4 pl-2 border-l border-muted my-0.5 space-y-0.5">
                                {vehicles.map((v, i) => (
                                  <div key={v.codigo + i} className="flex items-center justify-between py-0.5 px-2 text-[10px] text-muted-foreground">
                                    <span className="font-semibold text-primary">{v.codigo}</span>
                                    <span className="truncate mx-2 flex-1 text-right">{v.motorista || '-'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
