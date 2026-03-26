import { useAlmMateriais, useAlmMovimentacoes } from './useAlmData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Boxes, BarChart3, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';

const COLORS = ['#1d3557', '#457b9d', '#a8dadc', '#e63946', '#f4a261', '#2a9d8f', '#264653', '#e9c46a', '#606c38', '#bc6c25'];

export default function AlmDashboard() {
  const { data: materiais = [] } = useAlmMateriais();
  const { data: movs = [] } = useAlmMovimentacoes();

  const now = new Date();
  const ativos = materiais.filter(m => m.status === 'Ativo');

  const mesAtual = useMemo(() => {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return movs.filter(m => {
      const d = new Date(m.data + 'T12:00:00');
      return d >= start && d <= end;
    });
  }, [movs]);

  const matMap = Object.fromEntries(materiais.map(m => [m.id, m]));
  const baixoEstoque = ativos.filter(m => m.estoque_minimo > 0 && m.estoque_atual <= m.estoque_minimo);
  const semEstoque = ativos.filter(m => m.estoque_atual === 0);
  const saidasMes = mesAtual.filter(m => m.tipo === 'saida');
  const entradasMes = mesAtual.filter(m => m.tipo === 'entrada');
  const totalConsumo = saidasMes.reduce((a, m) => a + Number(m.quantidade), 0);
  const totalEntradas = entradasMes.reduce((a, m) => a + Number(m.quantidade), 0);
  const totalItensEstoque = ativos.reduce((a, m) => a + Number(m.estoque_atual), 0);

  // Distribuição por categoria
  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    ativos.forEach(m => {
      const cat = m.categoria || 'Sem categoria';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [ativos]);

  // Top 10 materiais com maior estoque
  const topEstoque = useMemo(() => {
    return [...ativos]
      .filter(m => m.estoque_atual > 0)
      .sort((a, b) => b.estoque_atual - a.estoque_atual)
      .slice(0, 10)
      .map(m => ({ name: m.nome.length > 25 ? m.nome.slice(0, 25) + '…' : m.nome, value: m.estoque_atual, unidade: m.unidade }));
  }, [ativos]);

  // Top 10 materiais mais consumidos
  const consumoPorMat: Record<string, number> = {};
  saidasMes.forEach(m => { consumoPorMat[m.material_id] = (consumoPorMat[m.material_id] || 0) + Number(m.quantidade); });
  const top10Consumo = Object.entries(consumoPorMat)
    .map(([id, qty]) => ({ name: matMap[id]?.nome || id, value: qty }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Consumo por equipe
  const consumoPorEquipe: Record<string, number> = {};
  saidasMes.forEach(m => {
    const eq = m.equipe || 'Não informado';
    consumoPorEquipe[eq] = (consumoPorEquipe[eq] || 0) + Number(m.quantidade);
  });
  const equipeData = Object.entries(consumoPorEquipe).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Últimas movimentações
  const ultimas = movs.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Boxes className="w-6 h-6 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Materiais Cadastrados</p><p className="text-2xl font-bold">{ativos.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30"><Package className="w-6 h-6 text-indigo-600" /></div>
            <div><p className="text-xs text-muted-foreground">Total em Estoque</p><p className="text-2xl font-bold">{totalItensEstoque.toLocaleString('pt-BR')}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30"><ArrowDownToLine className="w-6 h-6 text-emerald-600" /></div>
            <div><p className="text-xs text-muted-foreground">Entradas no Mês</p><p className="text-2xl font-bold text-emerald-600">{entradasMes.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30"><ArrowUpFromLine className="w-6 h-6 text-orange-600" /></div>
            <div><p className="text-xs text-muted-foreground">Saídas no Mês</p><p className="text-2xl font-bold text-orange-600">{saidasMes.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
            <div><p className="text-xs text-muted-foreground">Estoque Baixo</p><p className="text-2xl font-bold text-red-600">{baixoEstoque.length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">Sem Estoque</p>
            <p className="text-xl font-bold text-red-600">{semEstoque.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Categorias</p>
            <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{catData.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Qtd. Entrada (Mês)</p>
            <p className="text-xl font-bold text-emerald-600">{totalEntradas.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Qtd. Consumida (Mês)</p>
            <p className="text-xl font-bold text-amber-600">{totalConsumo.toLocaleString('pt-BR')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Distribuição por Categoria</CardTitle></CardHeader>
          <CardContent>
            {catData.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">Sem dados</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Top 10 — Maior Estoque</CardTitle></CardHeader>
          <CardContent>
            {topEstoque.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">Sem dados</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topEstoque} layout="vertical" margin={{ left: 100 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number, _, { payload }: any) => [`${v} ${payload.unidade}`, 'Estoque']} />
                  <Bar dataKey="value" fill="#457b9d" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 - Consumo (only if data exists) */}
      {(top10Consumo.length > 0 || equipeData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top 10 — Materiais Mais Consumidos (Mês)</CardTitle></CardHeader>
            <CardContent>
              {top10Consumo.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">Sem saídas no mês</p> : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={top10Consumo} layout="vertical" margin={{ left: 100 }}>
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#e63946" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Consumo por Equipe (Mês)</CardTitle></CardHeader>
            <CardContent>
              {equipeData.length === 0 ? <p className="text-muted-foreground text-sm py-8 text-center">Sem dados</p> : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={equipeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                      {equipeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Estoque Baixo / Sem Estoque */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">⚠ Materiais com Estoque Baixo ou Zerado</CardTitle></CardHeader>
          <CardContent>
            {baixoEstoque.length === 0 && semEstoque.length === 0 ? (
              <p className="text-muted-foreground text-sm">Todos os materiais com estoque adequado ✓</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {baixoEstoque.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 rounded">
                    <span className="text-sm font-medium">{m.nome}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-red-600 font-bold">{m.estoque_atual} {m.unidade}</span>
                      <Badge variant="destructive" className="text-xs">Mín: {m.estoque_minimo}</Badge>
                    </div>
                  </div>
                ))}
                {semEstoque.filter(m => !baixoEstoque.includes(m)).slice(0, 10).map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                    <span className="text-sm font-medium">{m.nome}</span>
                    <Badge variant="outline" className="text-orange-600 border-orange-400 text-xs">Zerado</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimas movimentações */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas Movimentações</CardTitle></CardHeader>
          <CardContent>
            {ultimas.length === 0 ? <p className="text-muted-foreground text-sm">Nenhuma movimentação registrada</p> : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {ultimas.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div>
                      <span className="text-sm font-medium">{matMap[m.material_id]?.nome || '-'}</span>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(m.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        {m.fornecedor ? ` · ${m.fornecedor}` : ''}
                        {m.equipe ? ` · ${m.equipe}` : ''}
                      </p>
                    </div>
                    <Badge variant={m.tipo === 'entrada' ? 'default' : 'destructive'} className={m.tipo === 'entrada' ? 'bg-emerald-600' : ''}>
                      {m.tipo === 'entrada' ? '+' : '-'}{m.quantidade}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
