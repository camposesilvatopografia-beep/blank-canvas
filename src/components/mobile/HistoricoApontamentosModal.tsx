import { useState, useEffect, useCallback } from 'react';
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
  Truck,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, subDays, addDays, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoricoApontamentosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EquipmentGroup {
  prefixo: string;
  viagens: number;
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

interface PipasGroup {
  prefixo: string;
  viagens: number;
  locais: string[];
}

interface DescargaGroup {
  caminhao: string;
  viagens: number;
  locais: string[];
}

interface DayData {
  escavadeiraGroups: EquipmentGroup[];
  caminhaoGroups: EquipmentGroup[];
  descargaGroups: DescargaGroup[];
  pedreiraGroups: PedreiraGroup[];
  calSummary: CalSummary[];
  pipasGroups: PipasGroup[];
  totalViagens: number;
}

const emptyDayData: DayData = {
  escavadeiraGroups: [],
  caminhaoGroups: [],
  descargaGroups: [],
  pedreiraGroups: [],
  calSummary: [],
  pipasGroups: [],
  totalViagens: 0,
};

export function HistoricoApontamentosModal({ open, onOpenChange }: HistoricoApontamentosModalProps) {
  const { profile } = useAuth();
  const { effectiveName } = useImpersonation();
  const { readSheet } = useGoogleSheets();
  const [selectedDate, setSelectedDate] = useState(() => subDays(new Date(), 1));
  const [loading, setLoading] = useState(false);
  const [dayData, setDayData] = useState<DayData>(emptyDayData);

  const userName = effectiveName;

  const formatDateForSheet = (date: Date) => {
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  const goToPreviousDay = () => setSelectedDate(prev => subDays(prev, 1));
  const goToNextDay = () => {
    const next = addDays(selectedDate, 1);
    if (isBefore(startOfDay(next), startOfDay(new Date()))) {
      setSelectedDate(next);
    }
  };

  const canGoNext = isBefore(startOfDay(addDays(selectedDate, 1)), startOfDay(new Date()));

  const fetchDayData = useCallback(async () => {
    if (!userName) return;
    setLoading(true);

    try {
      const dateStr = formatDateForSheet(selectedDate);

      const [cargaData, descargaData, pedreiraData, pipasData, calData] = await Promise.all([
        readSheet('Carga').catch(() => []),
        readSheet('Descarga').catch(() => []),
        readSheet('Apontamento_Pedreira').catch(() => []),
        readSheet('Apontamento_Pipa').catch(() => []),
        readSheet('Mov_Cal').catch(() => []),
      ]);

      // Process Carga
      const escMap = new Map<string, number>();
      const camMap = new Map<string, number>();

      if (cargaData && cargaData.length > 1) {
        const headers = cargaData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        let escIdx = headers.indexOf('Prefixo_Eq');
        if (escIdx === -1) escIdx = headers.indexOf('PrefixoEq');
        let camIdx = headers.indexOf('Prefixo_Cb');
        if (camIdx === -1) camIdx = headers.indexOf('PrefixoCb');
        let viagensIdx = headers.indexOf('N_Viagens');
        if (viagensIdx === -1) viagensIdx = headers.indexOf('I_Viagens');

        cargaData.slice(1).forEach(row => {
          if (row[dateIdx] === dateStr && (row[userIdx] || '').trim() === userName) {
            const viagens = parseInt(row[viagensIdx]) || 1;
            const esc = (escIdx !== -1 ? row[escIdx] : '') || 'Sem Escavadeira';
            const cam = (camIdx !== -1 ? row[camIdx] : '') || 'Sem Caminhão';
            escMap.set(esc, (escMap.get(esc) || 0) + viagens);
            camMap.set(cam, (camMap.get(cam) || 0) + viagens);
          }
        });
      }

      // Process Descarga
      const descMap = new Map<string, { viagens: number; locais: Set<string> }>();
      if (descargaData && descargaData.length > 1) {
        const headers = descargaData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        let camIdx = headers.indexOf('Prefixo_Cb');
        if (camIdx === -1) camIdx = headers.indexOf('Prefixo');
        const localIdx = headers.indexOf('Local_da_Obra');
        let viagensIdx = headers.indexOf('N_Viagens');
        if (viagensIdx === -1) viagensIdx = headers.indexOf('I_Viagens');

        descargaData.slice(1).forEach(row => {
          if (row[dateIdx] === dateStr && (row[userIdx] || '').trim() === userName) {
            const cam = (camIdx !== -1 ? row[camIdx] : '') || 'Sem Caminhão';
            const viagens = parseInt(row[viagensIdx]) || 1;
            const local = localIdx !== -1 ? (row[localIdx] || '') : '';
            if (!descMap.has(cam)) descMap.set(cam, { viagens: 0, locais: new Set() });
            const g = descMap.get(cam)!;
            g.viagens += viagens;
            if (local) g.locais.add(local);
          }
        });
      }

      // Process Pedreira
      const pedreiraMap = new Map<string, PedreiraGroup>();
      if (pedreiraData && pedreiraData.length > 1) {
        const headers = pedreiraData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        const userObraIdx = headers.indexOf('Usuario_Obra');
        const prefixoIdx = headers.findIndex((h: string) => h?.includes('Prefixo'));
        const materialIdx = headers.indexOf('Material');

        pedreiraData.slice(1).forEach(row => {
          const recordUser = (row[userIdx] || '').trim();
          const recordUserObra = userObraIdx !== -1 ? (row[userObraIdx] || '').trim() : '';
          if (row[dateIdx] === dateStr && (recordUser === userName || recordUserObra === userName)) {
            const prefixo = row[prefixoIdx] || 'Sem Prefixo';
            const material = row[materialIdx] || '';
            if (!pedreiraMap.has(prefixo)) pedreiraMap.set(prefixo, { prefixo, count: 0, materiais: [] });
            const g = pedreiraMap.get(prefixo)!;
            g.count += 1;
            if (material && !g.materiais.includes(material)) g.materiais.push(material);
          }
        });
      }

      // Process Pipas
      const pipasMap = new Map<string, { viagens: number; locais: Set<string> }>();
      if (pipasData && pipasData.length > 1) {
        const headers = pipasData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        const prefixoIdx = headers.indexOf('Prefixo');
        const localIdx = headers.indexOf('Local_Trabalho');
        const viagensIdx = headers.indexOf('Viagens');

        pipasData.slice(1).forEach(row => {
          if (row[dateIdx] === dateStr && (row[userIdx] || '').trim() === userName) {
            const prefixo = row[prefixoIdx] || 'Sem Prefixo';
            const viagens = parseInt(row[viagensIdx]) || 1;
            const local = row[localIdx] || '';
            if (!pipasMap.has(prefixo)) pipasMap.set(prefixo, { viagens: 0, locais: new Set() });
            const g = pipasMap.get(prefixo)!;
            g.viagens += viagens;
            if (local) g.locais.add(local);
          }
        });
      }

      // Process Cal
      const calMap = new Map<string, CalSummary>();
      if (calData && calData.length > 1) {
        const headers = calData[0];
        const dateIdx = headers.indexOf('Data');
        const userIdx = headers.indexOf('Usuario');
        const tipoIdx = headers.indexOf('Tipo');
        const qtdIdx = headers.indexOf('Quantidade');

        calData.slice(1).forEach(row => {
          if (row[dateIdx] === dateStr && (row[userIdx] || '').trim() === userName) {
            const tipo = row[tipoIdx] || 'Outros';
            const quantidade = parseFloat(String(row[qtdIdx] || 0).replace(',', '.')) || 0;
            if (!calMap.has(tipo)) calMap.set(tipo, { tipo, totalKg: 0, count: 0 });
            const s = calMap.get(tipo)!;
            s.totalKg += quantidade;
            s.count += 1;
          }
        });
      }

      const escGroups = Array.from(escMap.entries())
        .map(([prefixo, viagens]) => ({ prefixo, viagens }))
        .sort((a, b) => b.viagens - a.viagens);

      const camGroups = Array.from(camMap.entries())
        .map(([prefixo, viagens]) => ({ prefixo, viagens }))
        .sort((a, b) => b.viagens - a.viagens);

      const descGroups = Array.from(descMap.entries())
        .map(([caminhao, d]) => ({ caminhao, viagens: d.viagens, locais: Array.from(d.locais) }))
        .sort((a, b) => b.viagens - a.viagens);

      const pedGroups = Array.from(pedreiraMap.values()).sort((a, b) => b.count - a.count);
      const calGroups = Array.from(calMap.values()).sort((a, b) => b.totalKg - a.totalKg);
      const pipGroups = Array.from(pipasMap.entries())
        .map(([prefixo, d]) => ({ prefixo, viagens: d.viagens, locais: Array.from(d.locais) }))
        .sort((a, b) => b.viagens - a.viagens);

      const totalViagens = escGroups.reduce((a, g) => a + g.viagens, 0);

      setDayData({
        escavadeiraGroups: escGroups,
        caminhaoGroups: camGroups,
        descargaGroups: descGroups,
        pedreiraGroups: pedGroups,
        calSummary: calGroups,
        pipasGroups: pipGroups,
        totalViagens,
      });
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, userName, readSheet]);

  useEffect(() => {
    if (open) {
      fetchDayData();
    }
  }, [open, fetchDayData]);

  const hasAnyRecords =
    dayData.escavadeiraGroups.length > 0 ||
    dayData.descargaGroups.length > 0 ||
    dayData.pedreiraGroups.length > 0 ||
    dayData.calSummary.length > 0 ||
    dayData.pipasGroups.length > 0;

  const totalPedreira = dayData.pedreiraGroups.reduce((a, g) => a + g.count, 0);
  const totalCal = dayData.calSummary.reduce((a, s) => a + s.totalKg, 0);
  const totalPipas = dayData.pipasGroups.reduce((a, g) => a + g.viagens, 0);
  const totalDescarga = dayData.descargaGroups.reduce((a, g) => a + g.viagens, 0);

  const dayLabel = format(selectedDate, "EEEE, dd/MM/yyyy", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-4 p-0 gap-0 rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            Histórico de Apontamentos
          </DialogTitle>

          {/* Date navigation */}
          <div className="flex items-center justify-between mt-3">
            <Button variant="ghost" size="icon" onClick={goToPreviousDay} className="h-10 w-10">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center flex-1">
              <p className="text-sm font-semibold capitalize text-foreground">{dayLabel}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextDay}
              disabled={!canGoNext}
              className="h-10 w-10"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasAnyRecords ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">Nenhum registro nesta data</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                {dayData.totalViagens > 0 && (
                  <Card className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                    <div className="flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      <div>
                        <p className="text-2xl font-bold">{dayData.totalViagens}</p>
                        <p className="text-xs opacity-90">Cargas</p>
                      </div>
                    </div>
                  </Card>
                )}
                {totalDescarga > 0 && (
                  <Card className="p-3 bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <div className="flex items-center gap-2">
                      <Download className="w-5 h-5" />
                      <div>
                        <p className="text-2xl font-bold">{totalDescarga}</p>
                        <p className="text-xs opacity-90">Lançamentos</p>
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
              {dayData.escavadeiraGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Cog className="w-4 h-4 text-amber-600" />
                    Escavadeiras (Carga)
                  </h3>
                  <Card className="divide-y divide-border">
                    {dayData.escavadeiraGroups.map(group => (
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

              {/* Caminhões Carga Section */}
              {dayData.caminhaoGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    Caminhões (Carga)
                  </h3>
                  <Card className="divide-y divide-border">
                    {dayData.caminhaoGroups.map(group => (
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

              {/* Descarga / Lançamento Section */}
              {dayData.descargaGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Download className="w-4 h-4 text-green-600" />
                    Lançamentos (Descarga)
                  </h3>
                  <Card className="divide-y divide-border">
                    {dayData.descargaGroups.map(group => (
                      <div key={group.caminhao} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                              <Download className="w-4 h-4 text-green-600" />
                            </div>
                            <span className="font-medium text-foreground">{group.caminhao}</span>
                          </div>
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            {group.viagens} viagens
                          </Badge>
                        </div>
                        {group.locais.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 ml-10 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {group.locais.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {/* Pedreira Section */}
              {dayData.pedreiraGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-stone-600" />
                    Pedreira
                  </h3>
                  <Card className="divide-y divide-border">
                    {dayData.pedreiraGroups.map(group => (
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
              {dayData.calSummary.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-600" />
                    CAL
                  </h3>
                  <Card className="divide-y divide-border">
                    {dayData.calSummary.map(summary => (
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
              {dayData.pipasGroups.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-600" />
                    Pipas
                  </h3>
                  <Card className="divide-y divide-border">
                    {dayData.pipasGroups.map(group => (
                      <div key={group.prefixo} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Droplets className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="font-medium text-foreground">{group.prefixo}</span>
                          </div>
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                            {group.viagens} viagem{group.viagens > 1 ? 'ns' : ''}
                          </Badge>
                        </div>
                        {group.locais.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 ml-10 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {group.locais.join(', ')}
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
              dayData.totalViagens > 0 && `${dayData.totalViagens} cargas`,
              totalDescarga > 0 && `${totalDescarga} lançamentos`,
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
