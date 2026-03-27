import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useModulePermissions, ModuleName } from '@/hooks/useModulePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import {
  Truck, Mountain, Droplets, FlaskConical, RefreshCw, LogOut,
  Clock, AlertTriangle, CheckCircle2, Package, Upload, Download,
  Cog, Plus, ExternalLink, Loader2, X, Minimize2, Maximize2, FileText,
  LayoutDashboard, ClipboardList, Search,
} from 'lucide-react';

interface SheetRecord {
  rowIndex: number;
  data: Record<string, string>;
  status?: string;
  isPending?: boolean;
}

interface ModuleWindow {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
  sheetNames: string[];
  records: SheetRecord[];
  pendingCount: number;
  totalCount: number;
  loading: boolean;
  minimized: boolean;
  formPaths: { label: string; path: string }[];
  reportPath?: string;
}

import AiAssistantChat from '@/components/ai/AiAssistantChat';

export default function ApontadorDesktop() {
  const navigate = useNavigate();
  const { profile, signOut, isAdmin } = useAuth();
  const { effectiveName } = useImpersonation();
  const { readSheet } = useGoogleSheets();
  const { hasPermission } = useModulePermissions();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'painel' | 'registros'>('painel');
  const [registrosFilter, setRegistrosFilter] = useState('');

  // Registros data - all records from Pedreira for today (all users)
  const [registrosData, setRegistrosData] = useState<{ data: string; veiculo: string; motorista: string; material: string; pesoBruto: string; status: string }[]>([]);
  const [registrosLoading, setRegistrosLoading] = useState(false);

  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  const [windows, setWindows] = useState<ModuleWindow[]>([
    {
      id: 'apropriacao',
      title: 'Apropriação (Carga/Lançamento)',
      icon: Truck,
      color: 'from-amber-500 to-amber-600',
      iconColor: 'text-amber-600',
      sheetNames: ['Carga', 'Descarga'],
      records: [],
      pendingCount: 0,
      totalCount: 0,
      loading: true,
      minimized: false,
      formPaths: [
        { label: 'Nova Carga', path: '/mobile/carga' },
        { label: 'Novo Lançamento', path: '/mobile/lancamento' },
      ],
      reportPath: '/mobile/relatorios-carga',
    },
    {
      id: 'pedreira',
      title: 'Pedreira',
      icon: Mountain,
      color: 'from-orange-500 to-orange-600',
      iconColor: 'text-orange-600',
      sheetNames: ['Apontamento_Pedreira'],
      records: [],
      pendingCount: 0,
      totalCount: 0,
      loading: true,
      minimized: false,
      formPaths: [
        { label: 'Carregamento', path: '/mobile/pedreira' },
        { label: 'Ciclo', path: '/mobile/pedreira-ciclo' },
      ],
      reportPath: '/mobile/relatorios-pedreira',
    },
    {
      id: 'pipas',
      title: 'Pipas',
      icon: Droplets,
      color: 'from-sky-500 to-sky-600',
      iconColor: 'text-sky-600',
      sheetNames: ['Apontamento_Pipa'],
      records: [],
      pendingCount: 0,
      totalCount: 0,
      loading: true,
      minimized: false,
      formPaths: [
        { label: 'Nova Viagem', path: '/mobile/pipas' },
      ],
      reportPath: '/mobile/relatorios-pipas',
    },
    {
      id: 'cal',
      title: 'Cal',
      icon: FlaskConical,
      color: 'from-emerald-500 to-emerald-600',
      iconColor: 'text-emerald-600',
      sheetNames: ['Mov_Cal'],
      records: [],
      pendingCount: 0,
      totalCount: 0,
      loading: true,
      minimized: false,
      formPaths: [
        { label: 'Entrada', path: '/mobile/cal-entrada' },
        { label: 'Saída', path: '/mobile/cal-saida' },
      ],
      reportPath: '/mobile/relatorios-cal',
    },
  ]);

  const filteredWindows = useMemo(() => {
    return windows.filter(w => {
      if (w.id === 'apropriacao') return hasPermission('carga') || hasPermission('lancamento');
      return hasPermission(w.id as ModuleName);
    });
  }, [windows, hasPermission]);

  const fetchAllData = async () => {
    setRefreshing(true);
    const userName = effectiveName;

    try {
      const [cargaData, descargaData, pedreiraData, pipasData, calData] = await Promise.all([
        readSheet('Carga').catch(() => []),
        readSheet('Descarga').catch(() => []),
        readSheet('Apontamento_Pedreira').catch(() => []),
        readSheet('Apontamento_Pipa').catch(() => []),
        readSheet('Mov_Cal').catch(() => []),
      ]);

      const parseSheet = (data: any[][], userColumns: string[] = ['Usuario']): SheetRecord[] => {
        if (!data || data.length < 2) return [];
        const headers = (data[0] as string[]).map(h => h.trim().toLowerCase());
        const userColsLower = userColumns.map(c => c.toLowerCase());
        
        const findIdx = (name: string) => headers.indexOf(name.toLowerCase());
        
        const dateIdx = findIdx('Data');
        const statusIdx = findIdx('Status');
        const userIdxes = userColsLower.map(col => headers.indexOf(col)).filter(i => i !== -1);

        const rawHeaders = data[0] as string[];

        return data.slice(1).map((row, idx) => {
          const record: Record<string, string> = {};
          rawHeaders.forEach((h, i) => { record[h] = row[i] || ''; });
          
          const status = statusIdx !== -1 ? (row[statusIdx] || '') : '';
          const isPending = status.toLowerCase().includes('pendente') || status.toLowerCase().includes('em aberto');
          
          return { rowIndex: idx + 1, data: record, status, isPending };
        }).filter(r => {
          const matchDate = r.data[rawHeaders[dateIdx]] === todayStr;
          if (!userName) return matchDate;
          const matchUser = userIdxes.some(i => (data[r.rowIndex]?.[i] || '').trim().toLowerCase() === userName.toLowerCase());
          return matchDate && matchUser;
        });
      };

      const cargaRecords = parseSheet(cargaData);
      const descargaRecords = parseSheet(descargaData);
      const pedreiraRecords = parseSheet(pedreiraData, ['Usuario', 'Usuario_Obra']);
      const pipasRecords = parseSheet(pipasData);
      const calRecords = parseSheet(calData);

      const apropriacaoRecords = [...cargaRecords, ...descargaRecords];

      setWindows(prev => prev.map(w => {
        let records: SheetRecord[] = [];
        switch (w.id) {
          case 'apropriacao': records = apropriacaoRecords; break;
          case 'pedreira': records = pedreiraRecords; break;
          case 'pipas': records = pipasRecords; break;
          case 'cal': records = calRecords; break;
        }
        return {
          ...w,
          records,
          pendingCount: records.filter(r => r.isPending).length,
          totalCount: records.length,
          loading: false,
        };
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchRegistros = useCallback(async () => {
    setRegistrosLoading(true);
    try {
      const [pedreiraData, cargaData, pipasData, calData] = await Promise.all([
        readSheet('Apontamento_Pedreira').catch(() => []),
        readSheet('Carga').catch(() => []),
        readSheet('Apontamento_Pipa').catch(() => []),
        readSheet('Mov_Cal').catch(() => []),
      ]);

      const results: typeof registrosData = [];

      // Helper for case-insensitive column finding
      const findColIdx = (headers: string[], name: string) => {
        const hLower = headers.map(h => h.trim().toLowerCase());
        const nLower = name.toLowerCase();
        return hLower.indexOf(nLower);
      };

      // Parse Pedreira
      if (pedreiraData && pedreiraData.length > 1) {
        const h = pedreiraData[0] as string[];
        const dateIdx = findColIdx(h, 'Data');
        const prefixIdx = findColIdx(h, 'Prefixo_Eq') !== -1 ? findColIdx(h, 'Prefixo_Eq') : findColIdx(h, 'Prefixo');
        const motoristaIdx = findColIdx(h, 'Motorista');
        const materialIdx = findColIdx(h, 'Material');
        const pesoIdx = findColIdx(h, 'Peso_Final');
        const statusIdx = findColIdx(h, 'Status');

        for (let i = 1; i < pedreiraData.length; i++) {
          const row = pedreiraData[i];
          if ((row[dateIdx] || '') !== todayStr) continue;
          results.push({
            data: row[dateIdx] || '',
            veiculo: row[prefixIdx] || '',
            motorista: row[motoristaIdx] || '',
            material: row[materialIdx] || '',
            pesoBruto: row[pesoIdx] || '',
            status: row[statusIdx] || '',
          });
        }
      }

      // Parse Carga
      if (cargaData && cargaData.length > 1) {
        const h = cargaData[0] as string[];
        const dateIdx = findColIdx(h, 'Data');
        const prefixIdx = findColIdx(h, 'Prefixo_Eq') !== -1 ? findColIdx(h, 'Prefixo_Eq') : findColIdx(h, 'Prefixo');
        const motoristaIdx = findColIdx(h, 'Motorista');
        const materialIdx = findColIdx(h, 'Material');
        const pesoIdx = findColIdx(h, 'Peso_Final') !== -1 ? findColIdx(h, 'Peso_Final') : findColIdx(h, 'Peso');
        const statusIdx = findColIdx(h, 'Status');

        for (let i = 1; i < cargaData.length; i++) {
          const row = cargaData[i];
          if ((row[dateIdx] || '') !== todayStr) continue;
          results.push({
            data: row[dateIdx] || '',
            veiculo: row[prefixIdx] || '',
            motorista: row[motoristaIdx] || '',
            material: row[materialIdx] || '',
            pesoBruto: row[pesoIdx] || '',
            status: row[statusIdx] || '',
          });
        }
      }

      // Parse Pipas
      if (pipasData && pipasData.length > 1) {
        const h = pipasData[0] as string[];
        const dateIdx = findColIdx(h, 'Data');
        const prefixIdx = findColIdx(h, 'Prefixo');
        const motoristaIdx = findColIdx(h, 'Motorista');
        const statusIdx = findColIdx(h, 'Status');

        for (let i = 1; i < pipasData.length; i++) {
          const row = pipasData[i];
          if ((row[dateIdx] || '') !== todayStr) continue;
          results.push({
            data: row[dateIdx] || '',
            veiculo: row[prefixIdx] || '',
            motorista: row[motoristaIdx] || '',
            material: 'Água',
            pesoBruto: '',
            status: row[statusIdx] || '',
          });
        }
      }

      // Parse Cal
      if (calData && calData.length > 1) {
        const h = calData[0] as string[];
        const dateIdx = findColIdx(h, 'Data');
        const prefixIdx = findColIdx(h, 'Placa') !== -1 ? findColIdx(h, 'Placa') : findColIdx(h, 'Prefixo');
        const motoristaIdx = findColIdx(h, 'Motorista');
        const qtyIdx = findColIdx(h, 'Quantidade');
        const statusIdx = findColIdx(h, 'Status');

        for (let i = 1; i < calData.length; i++) {
          const row = calData[i];
          if ((row[dateIdx] || '') !== todayStr) continue;
          results.push({
            data: row[dateIdx] || '',
            veiculo: row[prefixIdx] || '',
            motorista: row[motoristaIdx] || '',
            material: 'Cal',
            pesoBruto: row[qtyIdx] || '',
            status: row[statusIdx] || '',
          });
        }
      }

      setRegistrosData(results);
    } catch (error) {
      console.error('Error fetching registros:', error);
    } finally {
      setRegistrosLoading(false);
    }
  }, [readSheet, todayStr]);

  // Set desktop mode flag so forms know to return here
  useEffect(() => {
    sessionStorage.setItem('apontadorDesktopMode', 'true');
    return () => {
      // Don't remove on unmount - forms need it after navigation
    };
  }, []);

  useEffect(() => {
    fetchAllData();
    fetchRegistros();
    const interval = setInterval(() => {
      fetchAllData();
      fetchRegistros();
    }, 60000);
    return () => clearInterval(interval);
  }, [effectiveName, fetchRegistros]);

  const toggleMinimize = (id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: !w.minimized } : w));
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const totalPending = filteredWindows.reduce((a, w) => a + w.pendingCount, 0);
  const totalRecords = filteredWindows.reduce((a, w) => a + w.totalCount, 0);

  const getDisplayColumns = (moduleId: string): string[] => {
    switch (moduleId) {
      case 'apropriacao': return ['Hora', 'Prefixo_Eq', 'Prefixo_Cb', 'Material', 'Local_da_Obra', 'N_Viagens', 'Status'];
      case 'pedreira': return ['Hora', 'Prefixo', 'Material', 'Peso_Liquido', 'Tonelada', 'Status'];
      case 'pipas': return ['Hora', 'Prefixo', 'Local_Trabalho', 'Viagens', 'Status'];
      case 'cal': return ['Hora', 'Tipo', 'Placa', 'Fornecedor', 'Quantidade', 'Status'];
      default: return [];
    }
  };

  const getColumnLabel = (col: string): string => {
    const map: Record<string, string> = {
      'Hora': 'Hora', 'Prefixo_Eq': 'Escavadeira', 'Prefixo_Cb': 'Caminhão',
      'Material': 'Material', 'Local_da_Obra': 'Local', 'N_Viagens': 'Viagens',
      'Status': 'Status', 'Prefixo': 'Veículo', 'Peso_Liquido': 'Peso Liq.',
      'Tonelada': 'Ton', 'Local_Trabalho': 'Local', 'Viagens': 'Viagens',
      'Tipo': 'Tipo', 'Placa': 'Placa', 'Fornecedor': 'Fornecedor',
      'Quantidade': 'Qtd (t)',
    };
    return map[col] || col;
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Watermark */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none z-0"
        style={{
          backgroundImage: `url(${logoApropriapp})`,
          backgroundSize: '250px',
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat',
        }}
      />

      {/* ===== Desktop Sidebar ===== */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 bg-secondary text-secondary-foreground fixed inset-y-0 left-0 z-50 border-r border-sidebar-border">
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
          <img src={logoApropriapp} alt="ApropriAPP" className="w-10 h-10 object-contain rounded-lg" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-sidebar-foreground leading-tight truncate">ApropriAPP</h1>
            <p className="text-[11px] text-sidebar-foreground/60">Gestão Inteligente</p>
          </div>
        </div>

        {/* User Info */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/50 uppercase tracking-wider mb-1">Apontador</p>
          <p className="text-sm font-semibold text-sidebar-foreground truncate">{effectiveName || profile?.nome}</p>
          <p className="text-[11px] text-sidebar-foreground/60">{dayNames[today.getDay()]}, {todayStr}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button
            onClick={() => setActiveTab('painel')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'painel'
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <LayoutDashboard className="w-4.5 h-4.5 shrink-0" />
            Painel de Operações
          </button>
          <button
            onClick={() => setActiveTab('registros')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === 'registros'
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <ClipboardList className="w-4.5 h-4.5 shrink-0" />
            Registros do Dia
            {registrosData.length > 0 && (
              <Badge className="ml-auto bg-sidebar-primary text-sidebar-primary-foreground text-[10px] h-5 min-w-5 px-1.5 border-0">
                {registrosData.length}
              </Badge>
            )}
          </button>

          {/* Quick Actions Section */}
          <div className="pt-4">
            <p className="px-3 text-[10px] text-sidebar-foreground/40 uppercase tracking-widest font-semibold mb-2">Novo Registro</p>
            {filteredWindows.flatMap(w => w.formPaths.map(fp => (
              <button
                key={fp.path}
                onClick={() => navigate(fp.path)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                {fp.label}
              </button>
            )))}
          </div>

          {/* Reports Section */}
          <div className="pt-4">
            <p className="px-3 text-[10px] text-sidebar-foreground/40 uppercase tracking-widest font-semibold mb-2">Relatórios</p>
            {filteredWindows.filter(w => w.reportPath).map(w => (
              <button
                key={w.reportPath}
                onClick={() => navigate(w.reportPath!)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                {w.title}
              </button>
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 text-xs"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* ===== Main Content Area ===== */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border h-14 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2">
              <img src={logoApropriapp} alt="ApropriAPP" className="w-8 h-8 object-contain" />
              <span className="font-bold text-sm text-foreground">ApropriAPP</span>
            </div>
            <h2 className="text-base font-semibold text-foreground hidden lg:block">
              {activeTab === 'painel' ? 'Painel de Operações' : 'Registros do Dia'}
            </h2>
            {/* Mobile tab toggle */}
            <div className="lg:hidden flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
              <Button size="sm" variant={activeTab === 'painel' ? 'default' : 'ghost'} className={cn("gap-1 h-7 text-xs", activeTab === 'painel' && "bg-primary text-primary-foreground")} onClick={() => setActiveTab('painel')}>
                <LayoutDashboard className="w-3 h-3" /> Painel
              </Button>
              <Button size="sm" variant={activeTab === 'registros' ? 'default' : 'ghost'} className={cn("gap-1 h-7 text-xs", activeTab === 'registros' && "bg-primary text-primary-foreground")} onClick={() => setActiveTab('registros')}>
                <ClipboardList className="w-3 h-3" /> Registros
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalPending > 0 && (
              <Badge variant="destructive" className="animate-pulse gap-1 text-xs">
                <AlertTriangle className="w-3 h-3" />
                {totalPending} pendente{totalPending > 1 ? 's' : ''}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-xs border-border text-foreground">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              {totalRecords} registros hoje
            </Badge>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { fetchAllData(); fetchRegistros(); }} disabled={refreshing}>
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="relative z-10 flex-1 p-4 lg:p-6 overflow-auto">
          {activeTab === 'painel' && (
            <>
              {/* Summary Cards Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
                {filteredWindows.map(w => {
                  const Icon = w.icon;
                  return (
                    <Card key={w.id + '-summary'} className="border shadow-sm">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br", w.color)}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground font-medium truncate">{w.title}</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold text-foreground">{w.totalCount}</span>
                            {w.pendingCount > 0 && (
                              <span className="text-xs text-orange-600 font-medium">{w.pendingCount} pend.</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Module Windows Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredWindows.map(w => {
                  const Icon = w.icon;
                  const columns = getDisplayColumns(w.id);

                  return (
                    <Card key={w.id} className={cn("overflow-hidden transition-all duration-200 border shadow-sm", w.pendingCount > 0 && "ring-2 ring-orange-400/40")}>
                      {/* Window Title Bar */}
                      <div className={cn("bg-gradient-to-r text-white px-4 py-2 flex items-center justify-between", w.color)}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span className="font-semibold text-sm">{w.title}</span>
                          <Badge variant="secondary" className="bg-white/20 text-white text-[10px] border-0 h-5">
                            {w.totalCount}
                          </Badge>
                          {w.pendingCount > 0 && (
                            <Badge className="bg-white/25 text-white text-[10px] border-0 animate-pulse gap-0.5 h-5">
                              <Clock className="w-2.5 h-2.5" />
                              {w.pendingCount}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          {w.formPaths.map(fp => (
                            <Button key={fp.path} size="sm" variant="ghost" className="h-6 px-2 text-white/80 hover:text-white hover:bg-white/20 text-[11px]" onClick={() => navigate(fp.path)}>
                              <Plus className="w-3 h-3 mr-0.5" />
                              {fp.label}
                            </Button>
                          ))}
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/20" onClick={() => toggleMinimize(w.id)}>
                            {w.minimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>

                      {/* Window Content */}
                      {!w.minimized && (
                        <CardContent className="p-0">
                          {w.loading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : w.records.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                              <Package className="w-8 h-8 mb-2 opacity-30" />
                              <p className="text-xs">Nenhum registro hoje</p>
                              <Button variant="link" size="sm" className="mt-0.5 text-xs h-6" onClick={() => w.formPaths[0] && navigate(w.formPaths[0].path)}>
                                Criar primeiro registro
                              </Button>
                            </div>
                          ) : (
                            <div className="overflow-x-auto max-h-[320px] overflow-y-auto scrollbar-thin">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50 sticky top-0 z-[1]">
                                  <tr>
                                    {columns.map(col => (
                                      <th key={col} className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                        {getColumnLabel(col)}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {[...w.records].sort((a, b) => {
                                    if (a.isPending && !b.isPending) return -1;
                                    if (!a.isPending && b.isPending) return 1;
                                    return 0;
                                  }).map((record, idx) => (
                                    <tr key={idx} className={cn("hover:bg-muted/30 transition-colors", record.isPending && "bg-orange-50 dark:bg-orange-950/20")}>
                                      {columns.map(col => (
                                        <td key={col} className="px-3 py-1.5 whitespace-nowrap">
                                          {col === 'Status' ? (
                                            <Badge
                                              variant={record.isPending ? 'destructive' : 'secondary'}
                                              className={cn(
                                                "text-[9px] h-5",
                                                record.isPending && "bg-orange-100 text-orange-700 border-orange-300 animate-pulse",
                                                !record.isPending && record.data[col]?.toLowerCase().includes('finalizado') && "bg-emerald-100 text-emerald-700"
                                              )}
                                            >
                                              {record.isPending && <Clock className="w-2.5 h-2.5 mr-0.5" />}
                                              {record.data[col] || '—'}
                                            </Badge>
                                          ) : (
                                            <span className={cn("text-foreground", record.isPending && "font-medium")}>
                                              {record.data[col] || '—'}
                                            </span>
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* =================== TAB: REGISTROS =================== */}
          {activeTab === 'registros' && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    Todos os Registros
                    <Badge variant="outline" className="text-xs border-border">{todayStr}</Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Filtrar registros..."
                        value={registrosFilter}
                        onChange={e => setRegistrosFilter(e.target.value)}
                        className="h-9 pl-9 pr-3 rounded-lg border border-input bg-background text-sm w-64 focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => { fetchRegistros(); fetchAllData(); }} disabled={registrosLoading}>
                      <RefreshCw className={cn("w-3.5 h-3.5", registrosLoading && "animate-spin")} />
                      Atualizar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {registrosLoading && registrosData.length === 0 ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (() => {
                  const filter = registrosFilter.toLowerCase();
                  const filtered = filter
                    ? registrosData.filter(r =>
                        r.veiculo.toLowerCase().includes(filter) ||
                        r.motorista.toLowerCase().includes(filter) ||
                        r.material.toLowerCase().includes(filter) ||
                        r.pesoBruto.toLowerCase().includes(filter) ||
                        r.status.toLowerCase().includes(filter)
                      )
                    : registrosData;

                  return filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Package className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm font-medium">{registrosFilter ? 'Nenhum resultado para o filtro' : 'Nenhum registro hoje'}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/60 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Data</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Veículo</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Motorista</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Material</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Peso Bruto</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filtered.map((r, idx) => {
                            const isPending = r.status.toLowerCase().includes('pendente') || r.status.toLowerCase().includes('em aberto') || r.status.toLowerCase().includes('saiu');
                            return (
                              <tr key={idx} className={cn("hover:bg-muted/30 transition-colors", isPending && "bg-orange-50 dark:bg-orange-950/20")}>
                                <td className="px-4 py-2.5 whitespace-nowrap text-foreground">{r.data}</td>
                                <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-foreground">{r.veiculo || '—'}</td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-foreground">{r.motorista || '—'}</td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-foreground">{r.material || '—'}</td>
                                <td className="px-4 py-2.5 whitespace-nowrap font-medium text-foreground">{r.pesoBruto || '—'}</td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <Badge
                                    variant={isPending ? 'destructive' : 'secondary'}
                                    className={cn(
                                      "text-[10px]",
                                      isPending && "bg-orange-100 text-orange-700 border-orange-300",
                                      r.status.toLowerCase().includes('finalizado') && "bg-emerald-100 text-emerald-700",
                                      r.status.toLowerCase().includes('pesado') && "bg-blue-100 text-blue-700",
                                    )}
                                  >
                                    {isPending && <Clock className="w-3 h-3 mr-1" />}
                                    {r.status || '—'}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
                <div className="px-5 py-2.5 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{registrosData.length} registro(s) no total</span>
                  <span>Atualização automática a cada 60s</span>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
