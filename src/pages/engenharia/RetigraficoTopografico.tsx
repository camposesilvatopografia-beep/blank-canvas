import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plane, Layers, MapPin, FileText, Database, Ruler, Mountain, ArrowDownUp, Grid3X3, Map } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, ReferenceArea,
} from 'recharts';

// ── Project JSON Data ──
const PROJECT_DATA = {
  projeto: {
    nome_projeto: "Aeroporto Maragogi",
    arquivo_origem: "Superfície SoloCAL - PPD, Taxi A, Taxi B - Anderson - Atual.xml",
    sistema_coordenadas: "Aratu",
    epsg: 4208,
    unidade_linear: "meter",
    unidade_area: "squareMeter",
    unidade_volume: "cubicMeter",
    software_origem: "Autodesk Civil 3D",
    versao_software: "2021",
    data_arquivo: "2025-12-02",
    superficie_nome: "SoloCAL",
    superficie_tipo: "TIN",
    area_2d: 572466.5105292289,
    area_3d: 577811.2941408174,
    cota_min: 1.015,
    cota_max: 42.163,
  },
  execucao_eixos: [
    {
      id: "patio_aeronaves",
      nome: "Pátio de Aeronaves",
      tipo: "alinhamento",
      estaca_inicial: -80.0,
      comprimento: 412.197197709471,
      direcao_graus: 316.49622871225,
      x_inicio: 9005086.621891975,
      y_inicio: 253202.6437379662,
      x_fim: 9004802.864385042,
      y_fim: 253501.62234432236,
    },
    {
      id: "ppd",
      nome: "PPD",
      tipo: "alinhamento",
      estaca_inicial: -300.0,
      comprimento: 2799.999999999456,
      direcao_graus: 316.496253261365,
      x_inicio: 9005214.012441665,
      y_inicio: 252530.94244609447,
      x_fim: 9003286.486817658,
      y_fim: 254561.8646427316,
    },
    {
      id: "taxi_a",
      nome: "TAXI A",
      tipo: "alinhamento",
      estaca_inicial: 0.0,
      comprimento: 450.36466048973,
      direcao_graus: 46.496255353546,
      x_inicio: 9004629.182242721,
      y_inicio: 253147.07855773595,
      x_fim: 9004955.844963174,
      y_fim: 253457.11048267962,
    },
    {
      id: "taxi_b",
      nome: "TAXI B",
      tipo: "alinhamento",
      estaca_inicial: 0.0,
      comprimento: 450.36466048973,
      direcao_graus: 46.496255353546,
      x_inicio: 9004574.110110529,
      y_inicio: 253205.10493316528,
      x_fim: 9004900.772830982,
      y_fim: 253515.13685810895,
    },
  ],
  execucao_pontos_superficie: [] as any[],
  execucao_contorno: [] as any[],
};

const EIXO_COLORS: Record<string, string> = {
  ppd: 'hsl(217, 91%, 50%)',
  taxi_a: 'hsl(142, 71%, 40%)',
  taxi_b: 'hsl(25, 95%, 53%)',
  patio_aeronaves: 'hsl(262, 60%, 55%)',
};

const ALTITUDE_BANDS = [
  { y1: 0, y2: 10, fill: 'hsl(142, 60%, 85%)', label: '0-10m' },
  { y1: 10, y2: 20, fill: 'hsl(45, 80%, 85%)', label: '10-20m' },
  { y1: 20, y2: 30, fill: 'hsl(25, 80%, 85%)', label: '20-30m' },
  { y1: 30, y2: 45, fill: 'hsl(0, 60%, 85%)', label: '30-42m' },
];

const fmt = (n: number, d = 2) => n.toLocaleString('pt-BR', { maximumFractionDigits: d });

// Generate simulated profile data for each eixo
const generateProfileData = (eixo: typeof PROJECT_DATA.execucao_eixos[0]) => {
  const steps = 50;
  const interval = eixo.comprimento / steps;
  const data = [];
  const baseElev = eixo.id === 'ppd' ? 15 : eixo.id === 'taxi_a' ? 12 : eixo.id === 'taxi_b' ? 14 : 18;
  for (let i = 0; i <= steps; i++) {
    const dist = i * interval;
    const estaca = eixo.estaca_inicial + i;
    const noise = Math.sin(i * 0.3) * 3 + Math.cos(i * 0.15) * 2;
    const slope = (dist / eixo.comprimento) * 5;
    data.push({
      estaca,
      distancia: Math.round(dist),
      [eixo.id]: Math.round((baseElev + noise + slope) * 100) / 100,
    });
  }
  return data;
};

const mergeProfileData = () => {
  // Create unified dataset using distancia as key
  const maxLen = Math.max(
    ...PROJECT_DATA.execucao_eixos.map(e => Math.ceil(e.comprimento / (e.comprimento / 50)) + 1)
  );
  const profiles = PROJECT_DATA.execucao_eixos.map(e => generateProfileData(e));
  const merged: any[] = [];
  for (let i = 0; i <= 50; i++) {
    const row: any = { index: i };
    profiles.forEach((p, j) => {
      const eixo = PROJECT_DATA.execucao_eixos[j];
      if (p[i]) {
        row[`dist_${eixo.id}`] = p[i].distancia;
        row[eixo.id] = p[i][eixo.id];
        row[`est_${eixo.id}`] = p[i].estaca;
      }
    });
    row.distancia = Math.round((i / 50) * 2800);
    merged.push(row);
  }
  return merged;
};

const RetigraficoTopografico = () => {
  const [filterEixo, setFilterEixo] = useState('');
  const [filterText, setFilterText] = useState('');

  const { projeto, execucao_eixos } = PROJECT_DATA;
  const chartData = useMemo(() => mergeProfileData(), []);

  const filteredEixos = useMemo(() => {
    return execucao_eixos.filter(e => {
      if (filterEixo && e.id !== filterEixo) return false;
      if (filterText && !e.nome.toLowerCase().includes(filterText.toLowerCase())) return false;
      return true;
    });
  }, [filterEixo, filterText]);

  return (
    <div className="space-y-4 p-4">
      {/* ── 1. Project Header ── */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plane className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold">{projeto.nome_projeto}</h1>
                <p className="text-xs text-muted-foreground">Retigráfico Topográfico — {projeto.superficie_nome} ({projeto.superficie_tipo})</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground ml-auto">
              <span><strong>Arquivo:</strong> {projeto.arquivo_origem.substring(0, 40)}...</span>
              <span><strong>Coord:</strong> {projeto.sistema_coordenadas} (EPSG:{projeto.epsg})</span>
              <span><strong>Unid:</strong> m / m² / m³</span>
              <span><strong>Software:</strong> {projeto.software_origem} {projeto.versao_software}</span>
              <span><strong>Data:</strong> {new Date(projeto.data_arquivo).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Área 2D', value: fmt(projeto.area_2d, 0), unit: 'm²', icon: Grid3X3, color: 'text-primary' },
          { label: 'Área 3D', value: fmt(projeto.area_3d, 0), unit: 'm²', icon: Layers, color: 'text-blue-600' },
          { label: 'Cota Mín.', value: fmt(projeto.cota_min), unit: 'm', icon: ArrowDownUp, color: 'text-emerald-600' },
          { label: 'Cota Máx.', value: fmt(projeto.cota_max), unit: 'm', icon: Mountain, color: 'text-amber-600' },
          { label: 'Alinhamentos', value: String(execucao_eixos.length), unit: '', icon: MapPin, color: 'text-violet-600' },
          { label: 'Pontos Sup.', value: String(PROJECT_DATA.execucao_pontos_superficie.length), unit: '', icon: Database, color: 'text-slate-600' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-md bg-muted/60 flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-base font-bold">{kpi.value} <span className="text-xs font-normal text-muted-foreground">{kpi.unit}</span></p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── 3. Retigráfico Principal ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Map className="w-4 h-4" />
            Perfil Longitudinal — Retigráfico
            <div className="ml-auto flex items-center gap-4 text-[10px]">
              {ALTITUDE_BANDS.map(b => (
                <span key={b.label} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm" style={{ background: b.fill }} />
                  {b.label}
                </span>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 30, left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                {ALTITUDE_BANDS.map(b => (
                  <ReferenceArea key={b.label} y1={b.y1} y2={b.y2} fill={b.fill} fillOpacity={0.25} />
                ))}
                <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
                <XAxis
                  dataKey="distancia"
                  fontSize={10}
                  tickFormatter={v => `${v}m`}
                  label={{ value: 'Desenvolvimento (m)', position: 'insideBottom', offset: -15, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  fontSize={10}
                  domain={[0, 45]}
                  tickFormatter={v => `${v}m`}
                  label={{ value: 'Cota (m)', angle: -90, position: 'insideLeft', offset: -35, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                  labelFormatter={v => `Dist: ${v}m`}
                  formatter={(value: number, name: string) => {
                    const eixo = execucao_eixos.find(e => e.id === name);
                    return [`${fmt(value)}m`, eixo?.nome || name];
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={30}
                  formatter={(value: string) => {
                    const eixo = execucao_eixos.find(e => e.id === value);
                    return eixo?.nome || value;
                  }}
                />
                {execucao_eixos.map(eixo => (
                  <Line
                    key={eixo.id}
                    type="monotone"
                    dataKey={eixo.id}
                    stroke={EIXO_COLORS[eixo.id]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Tables ── */}
      <Tabs defaultValue="alinhamentos" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="projeto" className="text-xs gap-1"><FileText className="w-3 h-3" /> Projeto</TabsTrigger>
          <TabsTrigger value="alinhamentos" className="text-xs gap-1"><Ruler className="w-3 h-3" /> Alinhamentos</TabsTrigger>
          <TabsTrigger value="pontos" className="text-xs gap-1"><Database className="w-3 h-3" /> Pontos Superfície</TabsTrigger>
          <TabsTrigger value="contorno" className="text-xs gap-1"><Layers className="w-3 h-3" /> Contorno</TabsTrigger>
        </TabsList>

        {/* Projeto */}
        <TabsContent value="projeto">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Propriedade</TableHead>
                    <TableHead className="text-xs">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(projeto).map(([key, value]) => (
                    <TableRow key={key} className="text-xs">
                      <TableCell className="font-medium capitalize">{key.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{typeof value === 'number' ? fmt(value) : String(value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alinhamentos */}
        <TabsContent value="alinhamentos">
          <Card>
            <CardContent className="p-3">
              <div className="flex gap-3 mb-3">
                <Select value={filterEixo} onValueChange={setFilterEixo}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar eixo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {execucao_eixos.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Buscar..." className="w-48" value={filterText} onChange={e => setFilterText(e.target.value)} />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs text-right">Est. Inicial</TableHead>
                      <TableHead className="text-xs text-right">Comprimento (m)</TableHead>
                      <TableHead className="text-xs text-right">Direção (°)</TableHead>
                      <TableHead className="text-xs text-right">X Início</TableHead>
                      <TableHead className="text-xs text-right">Y Início</TableHead>
                      <TableHead className="text-xs text-right">X Fim</TableHead>
                      <TableHead className="text-xs text-right">Y Fim</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filterEixo === 'all' || !filterEixo ? execucao_eixos : filteredEixos).map(e => (
                      <TableRow key={e.id} className="text-xs">
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: EIXO_COLORS[e.id] }} />
                            {e.nome}
                          </span>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px]">{e.tipo}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{e.estaca_inicial}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(e.comprimento)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(e.direcao_graus, 4)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(e.x_inicio, 3)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(e.y_inicio, 3)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(e.x_fim, 3)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(e.y_fim, 3)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pontos Superfície */}
        <TabsContent value="pontos">
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhum ponto de superfície importado. Importe um arquivo LandXML com dados de superfície para visualizar.
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contorno */}
        <TabsContent value="contorno">
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nenhum contorno importado. Importe um arquivo LandXML com dados de contorno para visualizar.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RetigraficoTopografico;
