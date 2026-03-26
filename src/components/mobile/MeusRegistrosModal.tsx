import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Upload,
  Download,
  Mountain,
  Droplets,
  FlaskConical,
  Clock,
  MapPin,
  Package,
  Cog,
  Truck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MeusRegistrosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Record {
  id: string;
  type: 'carga' | 'descarga' | 'pedreira' | 'pipas' | 'cal';
  hora: string;
  details: {
    escavadeira?: string;
    caminhao?: string;
    material?: string;
    local?: string;
    viagens?: string;
    volume?: string;
    tipo?: string;
    fornecedor?: string;
    quantidade?: string;
  };
}

interface EquipmentGroup {
  prefixo: string;
  viagens: number;
  records: Record[];
}

interface PedreiraGroup {
  prefixo: string;
  count: number;
  materiais: string[];
}

interface CalSummary {
  tipo: string;
  totalKg: number;
  count: number;
}

const RECORD_TYPE_CONFIG = {
  carga: { label: 'Carga', icon: Upload, color: 'bg-amber-100 text-amber-700' },
  descarga: { label: 'Lançamento', icon: Download, color: 'bg-green-100 text-green-700' },
  pedreira: { label: 'Pedreira', icon: Mountain, color: 'bg-stone-100 text-stone-700' },
  pipas: { label: 'Pipas', icon: Droplets, color: 'bg-blue-100 text-blue-700' },
  cal: { label: 'CAL', icon: FlaskConical, color: 'bg-teal-100 text-teal-700' },
};

export function MeusRegistrosModal({ open, onOpenChange }: MeusRegistrosModalProps) {
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { readSheet } = useGoogleSheets();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Grouped data
  const [escavadeiraGroups, setEscavadeiraGroups] = useState<EquipmentGroup[]>([]);
  const [caminhaoGroups, setCaminhaoGroups] = useState<EquipmentGroup[]>([]);
  const [pedreiraGroups, setPedreiraGroups] = useState<PedreiraGroup[]>([]);
  const [calSummary, setCalSummary] = useState<CalSummary[]>([]);
  const [pipasRecords, setPipasRecords] = useState<Record[]>([]);

  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  const userName = effectiveName;

  const fetchRecords = async () => {
    if (!userName) return;
    setLoading(true);

    try {
      const [cargaData, descargaData, pedreiraData, pipasData, calData] = await Promise.all([
        readSheet('Carga').catch(() => []),
        readSheet('Descarga').catch(() => []),
        readSheet('Apontamento_Pedreira').catch(() => []),
        readSheet('Apontamento_Pipa').catch(() => []),
        readSheet('Mov_Cal').catch(() => [])
      ]);

      const allRecords: Record[] = [];
      const escMap = new Map<string, EquipmentGroup>();
      const camMap = new Map<string, EquipmentGroup>();

      // Process Carga records
      if (cargaData && cargaData.length > 1) {
        const headers = cargaData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        const horaIdx = headers.indexOf('Hora') !== -1 ? headers.indexOf('Hora') : headers.indexOf('Hora_Carga');
        
        // Escavadeira: Prefixo_Eq
        let escavadeiraIdx = headers.indexOf('Prefixo_Eq');
        if (escavadeiraIdx === -1) escavadeiraIdx = headers.indexOf('PrefixoEq');
        
        // Caminhão: Prefixo_Cb
        let caminhaoIdx = headers.indexOf('Prefixo_Cb');
        if (caminhaoIdx === -1) caminhaoIdx = headers.indexOf('PrefixoCb');
        
        const materialIdx = headers.indexOf('Material');
        const localIdx = headers.indexOf('Local_da_Obra') !== -1 ? headers.indexOf('Local_da_Obra') : headers.indexOf('Local_Origem');
        
        let viagensIdx = headers.indexOf('N_Viagens');
        if (viagensIdx === -1) viagensIdx = headers.indexOf('I_Viagens');

        cargaData.slice(1).forEach((row, idx) => {
          const recordUser = (row[userIdx] || '').trim();
          // Strict filter - only show records from logged-in user
          if (row[dateIdx] === todayStr && recordUser === userName) {
            const escavadeira = row[escavadeiraIdx] || 'Sem Escavadeira';
            const caminhao = row[caminhaoIdx] || 'Sem Caminhão';
            const viagens = parseInt(row[viagensIdx]) || 1;
            
            const record: Record = {
              id: `carga-${idx}`,
              type: 'carga',
              hora: row[horaIdx] || '',
              details: {
                escavadeira,
                caminhao,
                material: row[materialIdx] || '',
                local: row[localIdx] || '',
                viagens: row[viagensIdx] || '1',
              },
            };
            
            allRecords.push(record);
            
            // Group by escavadeira
            if (!escMap.has(escavadeira)) {
              escMap.set(escavadeira, { prefixo: escavadeira, viagens: 0, records: [] });
            }
            escMap.get(escavadeira)!.viagens += viagens;
            escMap.get(escavadeira)!.records.push(record);
            
            // Group by caminhão
            if (!camMap.has(caminhao)) {
              camMap.set(caminhao, { prefixo: caminhao, viagens: 0, records: [] });
            }
            camMap.get(caminhao)!.viagens += viagens;
            camMap.get(caminhao)!.records.push(record);
          }
        });
      }

      // Process Descarga records
      if (descargaData && descargaData.length > 1) {
        const headers = descargaData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        const horaIdx = headers.indexOf('Hora');
        const escavadeiraIdx = headers.indexOf('PrefixoCb');
        const caminhaoIdx = headers.indexOf('Prefixo');
        const materialIdx = headers.indexOf('Material');
        const localIdx = headers.indexOf('Local_da_Obra');
        const viagensIdx = headers.indexOf('N_Viagens');

        descargaData.slice(1).forEach((row, idx) => {
          const recordUser = (row[userIdx] || '').trim();
          if (row[dateIdx] === todayStr && recordUser === userName) {
            const record: Record = {
              id: `descarga-${idx}`,
              type: 'descarga',
              hora: row[horaIdx] || '',
              details: {
                escavadeira: row[escavadeiraIdx] || '',
                caminhao: row[caminhaoIdx] || '',
                material: row[materialIdx] || '',
                local: row[localIdx] || '',
                viagens: row[viagensIdx] || '1',
              },
            };
            allRecords.push(record);
          }
        });
      }

      // Process Pedreira records with grouping
      const pedreiraMap = new Map<string, PedreiraGroup>();
      if (pedreiraData && pedreiraData.length > 1) {
        const headers = pedreiraData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        const userObraIdx = headers.indexOf('Usuario_Obra');
        const prefixoIdx = headers.findIndex((h: string) => h?.includes('Prefixo'));
        const materialIdx = headers.indexOf('Material');

        pedreiraData.slice(1).forEach((row) => {
          const recordUser = (row[userIdx] || '').trim();
          const recordUserObra = userObraIdx !== -1 ? (row[userObraIdx] || '').trim() : '';
          if (row[dateIdx] === todayStr && (recordUser === userName || recordUserObra === userName)) {
            const prefixo = row[prefixoIdx] || 'Sem Prefixo';
            const material = row[materialIdx] || '';
            
            if (!pedreiraMap.has(prefixo)) {
              pedreiraMap.set(prefixo, { prefixo, count: 0, materiais: [] });
            }
            const group = pedreiraMap.get(prefixo)!;
            group.count += 1;
            if (material && !group.materiais.includes(material)) {
              group.materiais.push(material);
            }
          }
        });
      }

      // Process Pipas records
      const pipas: Record[] = [];
      if (pipasData && pipasData.length > 1) {
        const headers = pipasData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        const horaIdx = headers.indexOf('Hora');
        const prefixoIdx = headers.indexOf('Prefixo');
        const localIdx = headers.indexOf('Local_Trabalho');
        const viagensIdx = headers.indexOf('Viagens');

        pipasData.slice(1).forEach((row, idx) => {
          const recordUser = (row[userIdx] || '').trim();
          if (row[dateIdx] === todayStr && recordUser === userName) {
            pipas.push({
              id: `pipas-${idx}`,
              type: 'pipas',
              hora: row[horaIdx] || '',
              details: {
                caminhao: row[prefixoIdx] || '',
                local: row[localIdx] || '',
                viagens: row[viagensIdx] || '1',
              },
            });
          }
        });
      }

      // Process Cal records with aggregation by tipo
      const calMap = new Map<string, CalSummary>();
      if (calData && calData.length > 1) {
        const headers = calData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        const tipoIdx = headers.indexOf('Tipo');
        const qtdIdx = headers.indexOf('Quantidade');

        calData.slice(1).forEach((row) => {
          const recordUser = (row[userIdx] || '').trim();
          if (row[dateIdx] === todayStr && recordUser === userName) {
            const tipo = row[tipoIdx] || 'Outros';
            const quantidade = parseFloat(String(row[qtdIdx] || 0).replace(',', '.')) || 0;
            
            if (!calMap.has(tipo)) {
              calMap.set(tipo, { tipo, totalKg: 0, count: 0 });
            }
            const summary = calMap.get(tipo)!;
            summary.totalKg += quantidade;
            summary.count += 1;
          }
        });
      }

      // Sort groups by viagens/count descending
      const escGroups = Array.from(escMap.values()).sort((a, b) => b.viagens - a.viagens);
      const camGroups = Array.from(camMap.values()).sort((a, b) => b.viagens - a.viagens);
      const pedGroups = Array.from(pedreiraMap.values()).sort((a, b) => b.count - a.count);
      const calGroups = Array.from(calMap.values()).sort((a, b) => b.totalKg - a.totalKg);

      setRecords(allRecords);
      setEscavadeiraGroups(escGroups);
      setCaminhaoGroups(camGroups);
      setPedreiraGroups(pedGroups);
      setCalSummary(calGroups);
      setPipasRecords(pipas.sort((a, b) => b.hora.localeCompare(a.hora)));
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRecords();
    }
  }, [open, userName]);

  const totalViagens = escavadeiraGroups.reduce((acc, g) => acc + g.viagens, 0);
  const totalPedreira = pedreiraGroups.reduce((acc, g) => acc + g.count, 0);
  const totalCal = calSummary.reduce((acc, s) => acc + s.totalKg, 0);
  const totalPipas = pipasRecords.reduce((acc, r) => acc + (parseInt(r.details.viagens || '1')), 0);
  const hasAnyRecords = records.length > 0 || pedreiraGroups.length > 0 || calSummary.length > 0 || pipasRecords.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-4 p-0 gap-0 rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Meus Registros de Hoje</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => fetchRecords()}
              disabled={loading}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{todayStr}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasAnyRecords ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">Nenhum registro encontrado</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                {totalViagens > 0 && (
                  <Card className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      <div>
                        <p className="text-2xl font-bold">{totalViagens}</p>
                        <p className="text-xs opacity-90">Viagens Carga</p>
                      </div>
                    </div>
                  </Card>
                )}
                {totalPedreira > 0 && (
                  <Card className="p-3 bg-gradient-to-br from-stone-500 to-stone-600 text-white">
                    <div className="flex items-center gap-2">
                      <Mountain className="w-5 h-5" />
                      <div>
                        <p className="text-2xl font-bold">{totalPedreira}</p>
                        <p className="text-xs opacity-90">Pedreira</p>
                      </div>
                    </div>
                  </Card>
                )}
                {totalCal > 0 && (
                  <Card className="p-3 bg-gradient-to-br from-teal-500 to-teal-600 text-white">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-5 h-5" />
                      <div>
                        <p className="text-2xl font-bold">{totalCal.toLocaleString('pt-BR')}</p>
                        <p className="text-xs opacity-90">CAL (kg)</p>
                      </div>
                    </div>
                  </Card>
                )}
                {totalPipas > 0 && (
                  <Card className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-5 h-5" />
                      <div>
                        <p className="text-2xl font-bold">{totalPipas}</p>
                        <p className="text-xs opacity-90">Pipas</p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* Escavadeiras Section */}
              {escavadeiraGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Cog className="w-4 h-4 text-amber-600" />
                    Escavadeiras
                  </h3>
                  <Card className="divide-y divide-border">
                    {escavadeiraGroups.map((group) => (
                      <div key={group.prefixo} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Cog className="w-4 h-4 text-amber-600" />
                          </div>
                          <span className="font-medium text-foreground">{group.prefixo}</span>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          {group.viagens} viagens
                        </Badge>
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {/* Caminhões Section */}
              {caminhaoGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    Caminhões
                  </h3>
                  <Card className="divide-y divide-border">
                    {caminhaoGroups.map((group) => (
                      <div key={group.prefixo} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Truck className="w-4 h-4 text-emerald-600" />
                          </div>
                          <span className="font-medium text-foreground">{group.prefixo}</span>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          {group.viagens} viagens
                        </Badge>
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {/* Pedreira Section */}
              {pedreiraGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-stone-600" />
                    Pedreira
                  </h3>
                  <Card className="divide-y divide-border">
                    {pedreiraGroups.map((group) => (
                      <div key={group.prefixo} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center">
                              <Truck className="w-4 h-4 text-stone-600" />
                            </div>
                            <span className="font-medium text-foreground">{group.prefixo}</span>
                          </div>
                          <Badge className="bg-stone-100 text-stone-700 hover:bg-stone-100">
                            {group.count} registro{group.count > 1 ? 's' : ''}
                          </Badge>
                        </div>
                        {group.materiais.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 ml-10 truncate">
                            {group.materiais.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {/* CAL Section */}
              {calSummary.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-600" />
                    CAL
                  </h3>
                  <Card className="divide-y divide-border">
                    {calSummary.map((summary) => (
                      <div key={summary.tipo} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                            <FlaskConical className="w-4 h-4 text-teal-600" />
                          </div>
                          <div>
                            <span className="font-medium text-foreground">{summary.tipo}</span>
                            <p className="text-xs text-muted-foreground">{summary.count} registro{summary.count > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100">
                          {summary.totalKg.toLocaleString('pt-BR')} kg
                        </Badge>
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {/* Pipas Section */}
              {pipasRecords.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-600" />
                    Pipas
                  </h3>
                  <Card className="divide-y divide-border">
                    {pipasRecords.map((record) => (
                      <div key={record.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Droplets className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-medium text-foreground">{record.details.caminhao || 'Sem Prefixo'}</span>
                          </div>
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            {record.details.viagens || '1'} viagem
                          </Badge>
                        </div>
                        {record.details.local && (
                          <p className="text-xs text-muted-foreground mt-1 ml-10 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {record.details.local}
                          </p>
                        )}
                      </div>
                    ))}
                  </Card>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t shrink-0 bg-muted/50">
          <p className="text-center text-sm text-muted-foreground">
            {[
              totalViagens > 0 && `${totalViagens} viagens`,
              totalPedreira > 0 && `${totalPedreira} pedreira`,
              totalCal > 0 && `${totalCal.toLocaleString('pt-BR')} kg CAL`,
              totalPipas > 0 && `${totalPipas} pipas`,
            ].filter(Boolean).join(' • ') || 'Sem registros'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}