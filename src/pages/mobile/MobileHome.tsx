import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Mountain, 
  Droplets, 
  FlaskConical, 
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Home,
  Clock,
  CheckCircle2,
  Truck,
  X,
  MessageCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  LogOut,
  Monitor,
  Lock,
  ClipboardList,
  PackageOpen,
  Factory,
  Waves,
  Beaker,
  Camera,
  Loader2,
  HardHat,
} from 'lucide-react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { OfflineIndicator } from '@/components/mobile/OfflineIndicator';
import { CacheStatusIndicator } from '@/components/mobile/CacheStatusIndicator';
import { MeusRegistrosModal } from '@/components/mobile/MeusRegistrosModal';
import { HistoricoApontamentosModal } from '@/components/mobile/HistoricoApontamentosModal';
import { UpdateNotification } from '@/components/mobile/UpdateNotification';
import { PendenteCicloNotification } from '@/components/mobile/PendenteCicloNotification';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { useModulePermissions, ModuleName } from '@/hooks/useModulePermissions';
import { useSubmenuPermissions } from '@/hooks/useSubmenuPermissions';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface MenuItemType {
  id: string;
  moduleKey: ModuleName | 'apropriacao' | 'engenharia';
  title: string;
  subtitle: string;
  icon: React.ElementType;
  bgColor: string;
  iconColor: string;
  externalLink?: string; // for items that navigate directly (not to mobile form)
  submenus: {
    title: string;
    icon: React.ElementType;
    path: string;
    type: 'action' | 'report' | 'registros' | 'external';
    moduleKey?: ModuleName;
    submenuKey?: string;
    isExternal?: boolean;
    customBg?: string;
    customIconBg?: string;
    customIconColor?: string;
  }[];
}

const mobileMenuItems: MenuItemType[] = [
  {
    id: 'apropriacao',
    moduleKey: 'apropriacao',
    title: 'Apropriação',
    subtitle: 'Carga e Lançamento',
    icon: PackageOpen,
    bgColor: 'bg-gradient-to-br from-amber-200 to-amber-100',
    iconColor: 'text-amber-700',
    submenus: [
      { title: 'Carga', icon: Truck, path: '/mobile/carga', type: 'action', moduleKey: 'carga', submenuKey: 'carga_form', customBg: 'bg-gradient-to-br from-blue-200 to-blue-100', customIconBg: 'bg-blue-300/60', customIconColor: 'text-blue-700' },
      { title: 'Lançamento', icon: Download, path: '/mobile/lancamento', type: 'action', moduleKey: 'lancamento', submenuKey: 'lancamento_form', customBg: 'bg-gradient-to-br from-violet-200 to-violet-100', customIconBg: 'bg-violet-300/60', customIconColor: 'text-violet-700' },
      { title: 'Usina Solos', icon: Factory, path: '/mobile/usina-solos', type: 'action', submenuKey: 'usina_solos_form', customBg: 'bg-gradient-to-br from-yellow-200 to-amber-100', customIconBg: 'bg-amber-300/60', customIconColor: 'text-amber-700' },
      { title: 'Relatório', icon: FileText, path: '/mobile/relatorios-carga', type: 'report', submenuKey: 'apropriacao_report' },
    ],
  },
  {
    id: 'pedreira',
    moduleKey: 'pedreira',
    title: 'Pedreira',
    subtitle: 'Controle de Carregamento',
    icon: Factory,
    bgColor: 'bg-gradient-to-br from-orange-200 to-orange-100',
    iconColor: 'text-orange-700',
    submenus: [
      { title: 'Apontar Carregamento', icon: Truck, path: '/mobile/pedreira', type: 'action', moduleKey: 'pedreira', submenuKey: 'pedreira_form' },
      { title: 'Apontar Ciclo', icon: RefreshCw, path: '/mobile/pedreira-ciclo', type: 'action', moduleKey: 'pedreira', submenuKey: 'pedreira_ciclo' },
      { title: 'Caminhões Areia Express', icon: Truck, path: '/mobile/caminhoes-areia-express', type: 'action', submenuKey: 'caminhoes_areia_express', customBg: 'bg-gradient-to-br from-amber-200 to-amber-100', customIconBg: 'bg-amber-300/60', customIconColor: 'text-amber-700' },
      { title: 'Caminhões Herval', icon: Truck, path: '/mobile/caminhoes-herval', type: 'action', submenuKey: 'caminhoes_herval', customBg: 'bg-gradient-to-br from-emerald-200 to-emerald-100', customIconBg: 'bg-emerald-300/60', customIconColor: 'text-emerald-700' },
      { title: 'Relatório', icon: FileText, path: '/mobile/relatorios-pedreira', type: 'report', submenuKey: 'pedreira_report' },
    ],
  },
  {
    id: 'pipas',
    moduleKey: 'pipas',
    title: 'Pipas',
    subtitle: 'Controle de Viagens',
    icon: Waves,
    bgColor: 'bg-gradient-to-br from-sky-200 to-sky-100',
    iconColor: 'text-sky-700',
    submenus: [
      { title: 'Apontar Viagens', icon: Waves, path: '/mobile/pipas', type: 'action', moduleKey: 'pipas', submenuKey: 'pipas_form' },
      { title: 'Relatório', icon: FileText, path: '/mobile/relatorios-pipas', type: 'report', submenuKey: 'pipas_report' },
    ],
  },
  {
    id: 'cal',
    moduleKey: 'cal',
    title: 'Cal',
    subtitle: 'Entrada e Saída',
    icon: Beaker,
    bgColor: 'bg-gradient-to-br from-emerald-200 to-emerald-100',
    iconColor: 'text-emerald-700',
    submenus: [
      { title: 'Registrar Entrada', icon: Truck, path: '/mobile/cal-entrada', type: 'action', moduleKey: 'cal', submenuKey: 'cal_entrada_form', customBg: 'bg-gradient-to-br from-emerald-200 to-emerald-100', customIconBg: 'bg-emerald-300/60', customIconColor: 'text-emerald-700' },
      { title: 'Registrar Saída', icon: FlaskConical, path: '/mobile/cal-saida', type: 'action', moduleKey: 'cal', submenuKey: 'cal_saida_form', customBg: 'bg-gradient-to-br from-red-200 to-red-100', customIconBg: 'bg-red-300/60', customIconColor: 'text-red-700' },
      { title: 'Relatório', icon: FileText, path: '/mobile/relatorios-cal', type: 'report', submenuKey: 'cal_report' },
    ],
  },
];

type MessageType = 'resumo' | 'problema' | 'outro';
type ResumoModule = 'geral' | 'carga' | 'pedreira' | 'pipas' | 'cal';

export default function MobileHome() {
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const { canImpersonate, isImpersonating, impersonatedUser, setImpersonatedUser, effectiveName, effectiveProfile, apontadores, loadingApontadores } = useImpersonation();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [messageType, setMessageType] = useState<MessageType>('resumo');
  const [resumoModule, setResumoModule] = useState<ResumoModule>('geral');
  const [customMessage, setCustomMessage] = useState('');
  const [observacao, setObservacao] = useState('');
  const { isOnline, pendingCount, isSyncing, syncAllPending } = useOfflineSync();
  const { refreshCache, isCacheStale, isLoading: cacheLoading, lastSynced, getCacheItemCount } = useOfflineCache();
  const { hasPermission, loading: permissionsLoading } = useModulePermissions();
  const { hasSubmenuPermission, loading: submenuPermissionsLoading } = useSubmenuPermissions();
  const { readSheet } = useGoogleSheets();
  
  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Inactivity logout - only after 30 minutes of inactivity
  useInactivityLogout();

  // Clear desktop mode flag when on mobile home
  useEffect(() => { sessionStorage.removeItem('apontadorDesktopMode'); }, []);

  // Sync avatar from profile
  useEffect(() => {
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
  }, [profile?.avatar_url]);

  // Refresh cache on mount if stale or first load
  useEffect(() => {
    if (isOnline && isCacheStale) {
      refreshCache();
    }
  }, [isOnline, isCacheStale, refreshCache]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: urlWithTimestamp }).eq('user_id', user.id);
      setAvatarUrl(urlWithTimestamp);
    } catch (error) {
      console.error('Avatar upload error:', error);
    } finally {
      setUploadingAvatar(false);
    }
  };


  // Record counts from Google Sheets
  const [recordCounts, setRecordCounts] = useState({
    apropriacao: 0,
    pedreira: 0,
    pipas: 0,
    cal: 0
  });
  
  // Total general Carga trips (from all users)
  const [totalCargaGeral, setTotalCargaGeral] = useState(0);
  
  // Equipment summaries for WhatsApp export
  const [escavadeiraSummary, setEscavadeiraSummary] = useState<{prefixo: string; viagens: number}[]>([]);
  const [caminhaoSummary, setCaminhaoSummary] = useState<{prefixo: string; viagens: number}[]>([]);
  
  // Per-module summaries for WhatsApp export
  const [pedreiraSummary, setPedreiraSummary] = useState<{veiculo: string; material: string; viagens: number}[]>([]);
  const [pipasSummary, setPipasSummary] = useState<{prefixo: string; local: string; viagens: number}[]>([]);
  const [calSummary, setCalSummary] = useState<{tipo: string; quantidade: number; fornecedor: string}[]>([]);
  
  // Modal state for "Ver Meus Registros"
  const [showMeusRegistros, setShowMeusRegistros] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);

  // Fetch record counts from Google Sheets - filtered by current user
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const today = new Date();
        const todayStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
        const userName = effectiveName;
        
        // Fetch all sheets in parallel
        const [cargaData, descargaData, pedreiraData, pipasData, calData] = await Promise.all([
          readSheet('Carga').catch(() => []),
          readSheet('Descarga').catch(() => []),
          readSheet('Apontamento_Pedreira').catch(() => []),
          readSheet('Apontamento_Pipa').catch(() => []),
          readSheet('Mov_Cal').catch(() => [])
        ]);

        // Count records for today filtered by user
        const countTodayRecordsByUser = (data: any[][], dateColumn: string = 'Data', userColumn: string = 'Usuario', altUserColumn?: string) => {
          if (!data || data.length < 2) return 0;
          const headers = data[0];
          const dateIdx = headers.indexOf(dateColumn);
          const userIdx = headers.indexOf(userColumn);
          const altUserIdx = altUserColumn ? headers.indexOf(altUserColumn) : -1;
          if (dateIdx === -1) return 0;
          
          return data.slice(1).filter(row => {
            const matchDate = (row[dateIdx] || '').split('/').map(p => p.padStart(2, '0')).join('/') === todayStr;
            // Strict user filter - only show records from logged-in user
            if (userName) {
              const recordUser = userIdx !== -1 ? (row[userIdx] || '').trim() : '';
              const altRecordUser = altUserIdx !== -1 ? (row[altUserIdx] || '').trim() : '';
              return matchDate && (recordUser === userName || altRecordUser === userName);
            }
            return matchDate;
          }).length;
        };
        
        // Count ALL Carga records for today (general count - not filtered by user)
        const countTodayRecordsGeneral = (data: any[][], dateColumn: string = 'Data') => {
          if (!data || data.length < 2) return 0;
          const headers = data[0];
          const dateIdx = headers.indexOf(dateColumn);
          if (dateIdx === -1) return 0;
          
          return data.slice(1).filter(row => (row[dateIdx] || '').split('/').map(p => p.padStart(2, '0')).join('/') === todayStr).length;
        };

        // Calculate equipment summaries from Carga data filtered by user
        const calculateEquipmentSummary = (data: any[][]) => {
          if (!data || data.length < 2) return { escavadeiras: [], caminhoes: [] };
          
          const headers = data[0];
          const dateIdx = headers.indexOf('Data');
          const userIdx = headers.indexOf('Usuario');
          
          // Escavadeira column: Prefixo_Eq
          let escavadeiraIdx = headers.indexOf('Prefixo_Eq');
          if (escavadeiraIdx === -1) escavadeiraIdx = headers.indexOf('PrefixoEq');
          
          // Caminhão column: Prefixo_Cb
          let caminhaoIdx = headers.indexOf('Prefixo_Cb');
          if (caminhaoIdx === -1) caminhaoIdx = headers.indexOf('PrefixoCb');
          
          // Viagens column
          let viagensIdx = headers.indexOf('N_Viagens');
          if (viagensIdx === -1) viagensIdx = headers.indexOf('I_Viagens');
          if (viagensIdx === -1) viagensIdx = headers.indexOf('Viagens');
          
          if (dateIdx === -1) return { escavadeiras: [], caminhoes: [] };
          
          const escMap = new Map<string, number>();
          const camMap = new Map<string, number>();
          
          data.slice(1).forEach(row => {
            const matchDate = (row[dateIdx] || '').split('/').map(p => p.padStart(2, '0')).join('/') === todayStr;
            const recordUser = userIdx !== -1 ? (row[userIdx] || '').trim() : '';
            // Strict filter - only show records from logged-in user
            const matchUser = !userName || (recordUser === userName);
            
            if (matchDate && matchUser) {
              const escavadeira = escavadeiraIdx !== -1 ? (row[escavadeiraIdx] || '') : '';
              const caminhao = caminhaoIdx !== -1 ? (row[caminhaoIdx] || '') : '';
              const viagens = viagensIdx !== -1 ? (parseInt(row[viagensIdx]) || 1) : 1;
              
              if (escavadeira && escavadeira.trim()) {
                escMap.set(escavadeira.trim(), (escMap.get(escavadeira.trim()) || 0) + viagens);
              }
              if (caminhao && caminhao.trim()) {
                camMap.set(caminhao.trim(), (camMap.get(caminhao.trim()) || 0) + viagens);
              }
            }
          });
          
          const escavadeiras = Array.from(escMap.entries())
            .map(([prefixo, viagens]) => ({ prefixo, viagens }))
            .sort((a, b) => b.viagens - a.viagens);
          
          const caminhoes = Array.from(camMap.entries())
            .map(([prefixo, viagens]) => ({ prefixo, viagens }))
            .sort((a, b) => b.viagens - a.viagens);
          
          return { escavadeiras, caminhoes };
        };

        const cargaCount = countTodayRecordsByUser(cargaData, 'Data', 'Usuario');
        const descargaCount = countTodayRecordsByUser(descargaData, 'Data', 'Usuario');
        const pedreiraCount = countTodayRecordsByUser(pedreiraData, 'Data', 'Usuario', 'Usuario_Obra');
        const pipasCount = countTodayRecordsByUser(pipasData, 'Data', 'Usuario');
        const calCount = countTodayRecordsByUser(calData, 'Data', 'Usuario');
        
        // Get general Carga count (all users)
        const cargaGeralCount = countTodayRecordsGeneral(cargaData, 'Data');
        setTotalCargaGeral(cargaGeralCount);

        // Calculate equipment summaries
        const { escavadeiras, caminhoes } = calculateEquipmentSummary(cargaData);
        setEscavadeiraSummary(escavadeiras);
        setCaminhaoSummary(caminhoes);

        // Calculate Pedreira summary (user-filtered)
        const calcPedreiraSummary = (data: any[][]) => {
          if (!data || data.length < 2) return [];
          const headers = data[0];
          const dateIdx = headers.indexOf('Data');
          const userIdx = headers.indexOf('Usuario');
          const veiculoIdx = headers.indexOf('Veiculo') !== -1 ? headers.indexOf('Veiculo') : headers.indexOf('Prefixo');
          const materialIdx = headers.indexOf('Material');
          const viagensIdx = headers.indexOf('Viagens') !== -1 ? headers.indexOf('Viagens') : -1;
          if (dateIdx === -1) return [];
          const results: {veiculo: string; material: string; viagens: number}[] = [];
          data.slice(1).forEach(row => {
            if ((row[dateIdx] || '').split('/').map(p => p.padStart(2, '0')).join('/') !== todayStr) return;
            if (userIdx !== -1 && userName && (row[userIdx] || '').trim() !== userName) return;
            results.push({
              veiculo: veiculoIdx !== -1 ? (row[veiculoIdx] || '') : '',
              material: materialIdx !== -1 ? (row[materialIdx] || '') : '',
              viagens: viagensIdx !== -1 ? (parseInt(row[viagensIdx]) || 1) : 1,
            });
          });
          return results;
        };
        setPedreiraSummary(calcPedreiraSummary(pedreiraData));

        // Calculate Pipas summary (user-filtered)
        const calcPipasSummary = (data: any[][]) => {
          if (!data || data.length < 2) return [];
          const headers = data[0];
          const dateIdx = headers.indexOf('Data');
          const userIdx = headers.indexOf('Usuario');
          const prefixoIdx = headers.indexOf('Prefixo') !== -1 ? headers.indexOf('Prefixo') : headers.indexOf('Veiculo');
          const localIdx = headers.indexOf('Local_Trabalho') !== -1 ? headers.indexOf('Local_Trabalho') : headers.indexOf('Local');
          const viagensIdx = headers.indexOf('Viagens') !== -1 ? headers.indexOf('Viagens') : -1;
          if (dateIdx === -1) return [];
          const results: {prefixo: string; local: string; viagens: number}[] = [];
          data.slice(1).forEach(row => {
            if ((row[dateIdx] || '').split('/').map(p => p.padStart(2, '0')).join('/') !== todayStr) return;
            if (userIdx !== -1 && userName && (row[userIdx] || '').trim() !== userName) return;
            results.push({
              prefixo: prefixoIdx !== -1 ? (row[prefixoIdx] || '') : '',
              local: localIdx !== -1 ? (row[localIdx] || '') : '',
              viagens: viagensIdx !== -1 ? (parseInt(row[viagensIdx]) || 1) : 1,
            });
          });
          return results;
        };
        setPipasSummary(calcPipasSummary(pipasData));

        // Calculate Cal summary (user-filtered)
        const calcCalSummary = (data: any[][]) => {
          if (!data || data.length < 2) return [];
          const headers = data[0];
          const dateIdx = headers.indexOf('Data');
          const userIdx = headers.indexOf('Usuario');
          const tipoIdx = headers.indexOf('Tipo');
          const qtdIdx = headers.indexOf('Quantidade') !== -1 ? headers.indexOf('Quantidade') : headers.indexOf('Peso');
          const fornIdx = headers.indexOf('Fornecedor');
          if (dateIdx === -1) return [];
          const results: {tipo: string; quantidade: number; fornecedor: string}[] = [];
          data.slice(1).forEach(row => {
            if ((row[dateIdx] || '').split('/').map(p => p.padStart(2, '0')).join('/') !== todayStr) return;
            if (userIdx !== -1 && userName && (row[userIdx] || '').trim() !== userName) return;
            results.push({
              tipo: tipoIdx !== -1 ? (row[tipoIdx] || '') : '',
              quantidade: qtdIdx !== -1 ? (parseFloat(row[qtdIdx]) || 0) : 0,
              fornecedor: fornIdx !== -1 ? (row[fornIdx] || '') : '',
            });
          });
          return results;
        };
        setCalSummary(calcCalSummary(calData));

        setRecordCounts({
          apropriacao: cargaCount + descargaCount,
          pedreira: pedreiraCount,
          pipas: pipasCount,
          cal: calCount
        });
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    fetchCounts();

    // Re-fetch counts when the page becomes visible again (returning from a form)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCounts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [readSheet, effectiveName]);

  // Filter menu items based on permissions (respect impersonation)
  const effectiveIsAdmin = isImpersonating ? false : isAdmin;
  
  const filteredMenuItems = useMemo(() => {
    return mobileMenuItems.filter(item => {
      if (item.moduleKey === 'apropriacao') {
        return hasPermission('carga') || hasPermission('lancamento');
      }
      // Engenharia removido do mobile
      if (item.moduleKey === 'engenharia') {
        return false;
      }
      return hasPermission(item.moduleKey as ModuleName);
    }).map(item => {
      const filteredSubmenus = item.submenus.filter(sub => {
        // External items (RDO links) - sem filtro de submenu
        if (sub.isExternal) return true;
        // Module-level check
        if (sub.moduleKey && !hasPermission(sub.moduleKey)) return false;
        // Submenu-level check
        if (sub.submenuKey && !hasSubmenuPermission(sub.submenuKey)) return false;
        return true;
      });
      return { ...item, submenus: filteredSubmenus };
    }).filter(item => item.submenus.length > 0); // Hide menu if all submenus filtered out
  }, [hasPermission, hasSubmenuPermission, effectiveIsAdmin]);

  const handleLogout = async () => {
    await signOut();
    navigate('/mobile/auth');
  };

  // Get count for a specific menu item
  const getCountForItem = (itemId: string): number => {
    switch (itemId) {
      case 'apropriacao': return recordCounts.apropriacao;
      case 'pedreira': return recordCounts.pedreira;
      case 'pipas': return recordCounts.pipas;
      case 'cal': return recordCounts.cal;
      default: return 0;
    }
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenu(prev => prev === menuId ? null : menuId);
  };

  const today = new Date();
  const dayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const dayOfWeek = dayNames[today.getDay()];
  const formattedDate = `${dayOfWeek}, ${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  const fullDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;

  const totalRecords = recordCounts.apropriacao + recordCounts.pedreira + recordCounts.pipas + recordCounts.cal;
  const totalViagensEquip = escavadeiraSummary.reduce((acc, e) => acc + e.viagens, 0);
  const totalViagensCam = caminhaoSummary.reduce((acc, c) => acc + c.viagens, 0);

  const generateMessage = (): string => {
    const userName = effectiveName || 'Usuário';
    
    if (messageType === 'resumo') {
      if (resumoModule === 'carga' || resumoModule === 'geral') {
        const escavadeirasText = escavadeiraSummary.length > 0
          ? escavadeiraSummary.map(e => `• ${e.prefixo}: ${e.viagens} viagens`).join('\n')
          : '• Nenhum registro';
        
        const caminhoesText = caminhaoSummary.length > 0
          ? caminhaoSummary.map(c => `• ${c.prefixo}: ${c.viagens} viagens`).join('\n')
          : '• Nenhum registro';

        if (resumoModule === 'carga') {
          return `📦 *RESUMO DE CARGA - ${fullDate}*

👷 Apontador: ${userName}

📈 *Total de Viagens:* ${totalViagensEquip}

🚜 *Escavadeiras (${escavadeiraSummary.length}):*
${escavadeirasText}

🚚 *Caminhões (${caminhaoSummary.length}):*
${caminhoesText}
${observacao ? `\n📝 *Observação:*\n${observacao}\n` : ''}
---
_Enviado via ApropriAPP_`;
        }

        // Geral - all modules
        let msg = `📊 *RESUMO GERAL - ${fullDate}*\n\n👷 Apontador: ${userName}\n\n`;
        msg += `📦 *Apropriação:* ${recordCounts.apropriacao} registros\n`;
        msg += `⛰️ *Pedreira:* ${recordCounts.pedreira} registros\n`;
        msg += `💧 *Pipas:* ${recordCounts.pipas} registros\n`;
        msg += `🧪 *Cal:* ${recordCounts.cal} registros\n`;
        msg += `\n📈 *Total:* ${totalRecords} registros\n`;
        
        if (escavadeiraSummary.length > 0) {
          msg += `\n🚜 *Escavadeiras (Carga):*\n${escavadeirasText}\n`;
        }
        if (caminhaoSummary.length > 0) {
          msg += `\n🚚 *Caminhões (Carga):*\n${caminhoesText}\n`;
        }
        if (observacao) {
          msg += `\n📝 *Observação:*\n${observacao}\n`;
        }
        msg += `\n---\n_Enviado via ApropriAPP_`;
        return msg;
      }

      if (resumoModule === 'pedreira') {
        const detalhes = pedreiraSummary.length > 0
          ? pedreiraSummary.map(p => `• ${p.veiculo}${p.material ? ` - ${p.material}` : ''}: ${p.viagens} viagem(ns)`).join('\n')
          : '• Nenhum registro';
        
        return `⛰️ *RESUMO PEDREIRA - ${fullDate}*

👷 Apontador: ${userName}

📈 *Total de Registros:* ${pedreiraSummary.length}

🚛 *Detalhes:*
${detalhes}
${observacao ? `\n📝 *Observação:*\n${observacao}\n` : ''}
---
_Enviado via ApropriAPP_`;
      }

      if (resumoModule === 'pipas') {
        const totalViagens = pipasSummary.reduce((sum, p) => sum + p.viagens, 0);
        const detalhes = pipasSummary.length > 0
          ? pipasSummary.map(p => `• ${p.prefixo}${p.local ? ` (${p.local})` : ''}: ${p.viagens} viagem(ns)`).join('\n')
          : '• Nenhum registro';
        
        return `💧 *RESUMO PIPAS - ${fullDate}*

👷 Apontador: ${userName}

📈 *Total de Viagens:* ${totalViagens}
📝 *Registros:* ${pipasSummary.length}

🚰 *Detalhes:*
${detalhes}
${observacao ? `\n📝 *Observação:*\n${observacao}\n` : ''}
---
_Enviado via ApropriAPP_`;
      }

      if (resumoModule === 'cal') {
        const entradas = calSummary.filter(c => c.tipo.toLowerCase().includes('entrada'));
        const saidas = calSummary.filter(c => c.tipo.toLowerCase().includes('saida') || c.tipo.toLowerCase().includes('saída'));
        const totalEntrada = entradas.reduce((sum, c) => sum + c.quantidade, 0);
        const totalSaida = saidas.reduce((sum, c) => sum + c.quantidade, 0);
        const detalhes = calSummary.length > 0
          ? calSummary.map(c => `• ${c.tipo}: ${c.quantidade.toLocaleString('pt-BR')} ton${c.fornecedor ? ` (${c.fornecedor})` : ''}`).join('\n')
          : '• Nenhum registro';
        
        return `🧪 *RESUMO CAL - ${fullDate}*

👷 Apontador: ${userName}

📈 *Entradas:* ${totalEntrada.toLocaleString('pt-BR')} ton
📉 *Saídas:* ${totalSaida.toLocaleString('pt-BR')} ton
📝 *Movimentos:* ${calSummary.length}

📋 *Detalhes:*
${detalhes}
${observacao ? `\n📝 *Observação:*\n${observacao}\n` : ''}
---
_Enviado via ApropriAPP_`;
      }
    }
    
    if (messageType === 'problema') {
      return `⚠️ *RELATO DE PROBLEMA - ${fullDate}*

👷 Apontador: ${userName}

🔴 *Descrição do Problema:*
${customMessage || '[Descreva o problema aqui]'}

---
_Enviado via ApropriAPP_`;
    } else {
      return `💬 *MENSAGEM - ${fullDate}*

👷 Apontador: ${userName}

📝 *Mensagem:*
${customMessage || '[Digite sua mensagem aqui]'}

---
_Enviado via ApropriAPP_`;
    }
  };

  const sendViaWhatsApp = () => {
    const message = encodeURIComponent(generateMessage());
    // Opens WhatsApp with the message pre-filled
    window.open(`https://wa.me/?text=${message}`, '_blank');
    setShowWhatsAppModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col relative">

      {/* Update Notification Banner */}
      <UpdateNotification />
      
      {/* Background Logo Watermark */}
      <div 
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: `url(${logoApropriapp})`,
          backgroundSize: '120%',
          backgroundPosition: 'center 40%',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Header */}
      <div className="bg-[#2d3e50] text-white p-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoApropriapp} alt="ApropriAPP" className="w-12 h-12 object-contain" />
            <div>
              <h1 className="font-semibold text-lg">Painel dos Apontamentos</h1>
              <p className="text-sm text-white/70">{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Botão Atualizar/Sincronizar */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 relative"
              onClick={async () => {
                if (pendingCount > 0 && isOnline) {
                  await syncAllPending();
                } else if (isOnline) {
                  window.location.reload();
                }
              }}
              disabled={isSyncing || !isOnline}
              title={pendingCount > 0 ? 'Sincronizar' : 'Atualizar'}
            >
              <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </Button>
            {/* Botão Acessar Sistema - apenas para admin */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={() => navigate('/dashboard')}
                title="Acessar Sistema"
              >
                <Monitor className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={handleLogout}
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      <div className="px-4 mt-4">
        <Card className="bg-white rounded-2xl shadow-md border-0 overflow-hidden">
          <div className="bg-[#2d3e50] px-4 py-2.5 flex items-center justify-between">
            <p className="text-white/90 text-sm font-medium tracking-wide">
              {isImpersonating ? '👁️ Acessando como' : 'Apontador'}
            </p>
            <OfflineIndicator 
              isOnline={isOnline} 
              pendingCount={pendingCount} 
              isSyncing={isSyncing}
              className="!px-2 !py-1 !text-xs !rounded-lg !shadow-none"
            />
          </div>
          <div className="p-4 flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-full relative overflow-hidden cursor-pointer group ring-2 ring-[#2d3e50]/20 shrink-0"
              onClick={() => !isImpersonating && avatarInputRef.current?.click()}
            >
              {(isImpersonating ? effectiveProfile?.avatar_url : avatarUrl) ? (
                <img src={(isImpersonating ? effectiveProfile?.avatar_url : avatarUrl)!} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-amber-100 flex items-center justify-center text-2xl">👷</div>
              )}
              {!isImpersonating && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity">
                  {uploadingAvatar ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-white" />
                  )}
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-foreground text-lg leading-tight truncate">{effectiveName || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {isImpersonating ? effectiveProfile?.tipo || 'Apontador' : (isAdmin ? 'Administrador' : profile?.tipo || 'Apontador')}
              </p>
              {isImpersonating && (
                <p className="text-xs text-amber-600 font-medium mt-0.5">
                  Admin: {profile?.nome}
                </p>
              )}
            </div>
            {isImpersonating && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-xs border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setImpersonatedUser(null)}
              >
                <X className="w-3 h-3 mr-1" />
                Sair
              </Button>
            )}
          </div>
        </Card>

        {/* Impersonation Selector - only for main admin */}
        {canImpersonate && (
          <Card className="mt-3 bg-white rounded-2xl shadow-md border-0 overflow-hidden">
            <div className="bg-amber-500 px-4 py-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-white" />
              <p className="text-white text-sm font-medium">Acessar como Apontador</p>
            </div>
            <div className="p-3">
              {loadingApontadores ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <select
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  value={impersonatedUser?.user_id || ''}
                  onChange={(e) => {
                    const userId = e.target.value;
                    if (!userId) {
                      setImpersonatedUser(null);
                    } else {
                      const user = apontadores.find(a => a.user_id === userId);
                      if (user) setImpersonatedUser(user);
                    }
                  }}
                >
                  <option value="">— Meu próprio acesso —</option>
                  {apontadores.map(apt => (
                    <option key={apt.user_id} value={apt.user_id}>
                      {apt.nome} ({apt.tipo})
                    </option>
                  ))}
                </select>
              )}
              {isImpersonating && (
                <p className="text-xs text-amber-600 mt-2 text-center">
                  ⚠️ Todos os lançamentos serão registrados como <strong>{effectiveName}</strong>
                </p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Pedreira Pending Cycle Notification */}
      <PendenteCicloNotification />

      {/* Categories - Card Grid Style */}
      <div className="px-4 mt-6 flex-1">
        <h2 className="text-gray-700 font-semibold mb-3">Categorias</h2>
        
        <div className="grid grid-cols-2 gap-3">
          {(permissionsLoading || submenuPermissionsLoading) ? (
            <div className="col-span-2 flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredMenuItems.length === 0 ? (
            <div className="col-span-2 text-center py-8">
              <Lock className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm">Nenhum módulo disponível</p>
              <p className="text-gray-400 text-xs mt-1">Contate o administrador</p>
            </div>
          ) : (
            filteredMenuItems.map(item => {
              const count = getCountForItem(item.id);
              return (
                <Card 
                  key={item.id}
                  className="bg-white border-0 shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-[0.98]"
                  onClick={() => toggleMenu(item.id)}
                >
                  <div className="p-4 flex flex-col items-center text-center">
                    <div className={cn('w-20 h-20 rounded-2xl flex items-center justify-center mb-3 shadow-sm', item.bgColor)}>
                      <item.icon className={cn('w-10 h-10', item.iconColor)} strokeWidth={1.8} />
                    </div>
                    <p className="font-bold text-gray-900 text-base">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Expanded Submenu Modal */}
        {expandedMenu && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setExpandedMenu(null)}>
            <div 
              className="bg-white w-full rounded-t-3xl p-4 pb-8 animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const item = filteredMenuItems.find(m => m.id === expandedMenu);
                if (!item) return null;
                return (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', item.bgColor)}>
                          <item.icon className={cn('w-6 h-6', item.iconColor)} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{item.title}</p>
                          <p className="text-sm text-gray-500">{item.subtitle}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setExpandedMenu(null)}
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {item.submenus.map(submenu => {
                        const isAction = submenu.type === 'action';
                        const isRegistros = submenu.type === 'registros';
                        const isCiclo = submenu.submenuKey === 'pedreira_ciclo';
                        const cardBgColor = isCiclo ? 'bg-sky-100' : isRegistros ? 'bg-indigo-50' : isAction ? (submenu.customBg || item.bgColor) : 'bg-slate-100';
                        const iconBgColor = isCiclo ? 'bg-sky-200' : isRegistros ? 'bg-indigo-100' : isAction ? (submenu.customIconBg || 'bg-white/60') : 'bg-white';
                        const textColor = isRegistros ? 'text-indigo-600' : isAction ? (submenu.customIconColor || item.iconColor) : 'text-slate-600';
                        
                        return (
                          <Card
                            key={submenu.path}
                            className={cn(
                              'border-0 shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-[0.98]',
                              cardBgColor
                            )}
                            onClick={() => {
                              if (submenu.isExternal) {
                                navigate(submenu.path);
                                setExpandedMenu(null);
                              } else if (isRegistros) {
                                setShowMeusRegistros(true);
                                setExpandedMenu(null);
                              } else {
                                navigate(submenu.path);
                                setExpandedMenu(null);
                              }
                            }}
                          >
                            <div className="p-4 flex flex-col items-center text-center">
                              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center mb-2', iconBgColor)}>
                                <submenu.icon className={cn('w-6 h-6', isCiclo ? 'text-sky-600' : isRegistros ? 'text-indigo-500' : isAction ? (submenu.customIconColor || item.iconColor) : 'text-slate-500')} />
                              </div>
                              <p className={cn('font-medium text-sm', isAction ? 'text-gray-800' : 'text-slate-600')}>
                                {submenu.title}
                              </p>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Offline Mode Banner */}
        {!isOnline && (
          <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-red-800 text-lg">Modo Offline</p>
                <p className="text-red-600 text-sm">Seus registros serão salvos localmente e sincronizados quando a conexão voltar.</p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Records Banner */}
        {pendingCount > 0 && isOnline && (
          <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-amber-800 text-lg">{pendingCount} Registro(s) Pendente(s)</p>
                  <p className="text-amber-600 text-sm">Clique para sincronizar agora</p>
                </div>
              </div>
              <Button
                onClick={syncAllPending}
                disabled={isSyncing}
                className="bg-amber-500 hover:bg-amber-600 text-white h-12 px-4 rounded-xl font-bold"
              >
                {isSyncing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5 mr-2" />}
                {isSyncing ? '' : 'Sincronizar'}
              </Button>
            </div>
          </div>
        )}

        {/* Ação Rápida */}
        <div className="mt-6 mb-24 space-y-3">
          <Card className="bg-slate-50 border border-slate-200 shadow-sm">
            <button 
              className="w-full flex items-center gap-3 p-4 hover:bg-slate-100 transition-colors"
              onClick={() => setShowHistorico(true)}
            >
              <Clock className="w-5 h-5 text-slate-600" />
              <span className="font-medium text-slate-700">HISTÓRICO DE DIAS ANTERIORES</span>
            </button>
          </Card>
        </div>
      </div>

      {/* Floating Action Button */}
      <button 
        className="fixed right-4 bottom-20 w-14 h-14 bg-green-500 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-green-600 transition-colors z-50"
        onClick={() => setShowWhatsAppModal(true)}
      >
        <MessageCircle className="w-7 h-7" />
      </button>

      {/* Bottom Navigation - Simplified */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around py-2">
          <button className="flex flex-col items-center gap-1 px-6 py-2 bg-[#2d3e50] text-white rounded-xl">
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Início</span>
          </button>
          <div className="w-14" /> {/* Spacer for FAB */}
          <button 
            className="flex flex-col items-center gap-1 px-6 py-2 text-muted-foreground hover:bg-[#2d3e50] hover:text-white rounded-xl transition-colors"
            onClick={() => setShowMeusRegistros(true)}
          >
            <ClipboardList className="w-6 h-6" />
            <span className="text-xs font-medium">Registros</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Modal */}
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="max-w-sm mx-4 p-0 gap-0 rounded-2xl overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <DialogTitle className="text-lg font-semibold">Enviar para Sala Técnica</DialogTitle>
              </div>
            </div>
          </DialogHeader>

          {/* Message Type Tabs */}
          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => setMessageType('resumo')}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
                messageType === 'resumo' 
                  ? "bg-green-100 text-green-700 border-2 border-green-300" 
                  : "bg-gray-100 text-gray-600"
              )}
            >
              <span>📊</span> Resumo
            </button>
            <button
              onClick={() => setMessageType('problema')}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
                messageType === 'problema' 
                  ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-300" 
                  : "bg-gray-100 text-gray-600"
              )}
            >
              <AlertTriangle className="w-4 h-4" /> Problema
            </button>
            <button
              onClick={() => setMessageType('outro')}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
                messageType === 'outro' 
                  ? "bg-blue-100 text-blue-700 border-2 border-blue-300" 
                  : "bg-gray-100 text-gray-600"
              )}
            >
              <MessageSquare className="w-4 h-4" /> Outro
            </button>
          </div>

          {/* Module Selector for Resumo */}
          {messageType === 'resumo' && (
            <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
              {([
                { key: 'geral' as ResumoModule, label: '📊 Geral' },
                { key: 'carga' as ResumoModule, label: '📦 Carga' },
                { key: 'pedreira' as ResumoModule, label: '⛰️ Pedreira' },
                { key: 'pipas' as ResumoModule, label: '💧 Pipas' },
                { key: 'cal' as ResumoModule, label: '🧪 Cal' },
              ]).map(mod => (
                <button
                  key={mod.key}
                  onClick={() => setResumoModule(mod.key)}
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                    resumoModule === mod.key
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  )}
                >
                  {mod.label}
                </button>
              ))}
            </div>
          )}

          {/* Message Preview */}
          <div className="mx-4 mb-4 bg-green-50 rounded-xl p-4 max-h-64 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
              {generateMessage()}
            </pre>
          </div>

          {/* Observação for Resumo */}
          {messageType === 'resumo' && (
            <div className="px-4 pb-3">
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Adicionar observação ao resumo (opcional)..."
                className="w-full h-16 p-3 border border-gray-200 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* Custom Message Input for Problema/Outro */}
          {(messageType === 'problema' || messageType === 'outro') && (
            <div className="px-4 pb-4">
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={messageType === 'problema' ? 'Descreva o problema...' : 'Digite sua mensagem...'}
                className="w-full h-24 p-3 border border-gray-200 rounded-xl resize-none text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          )}

          {/* Send Button */}
          <div className="p-4 pt-0">
            <Button 
              onClick={sendViaWhatsApp}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-6 rounded-xl flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              Enviar via WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meus Registros Modal */}
      <MeusRegistrosModal 
        open={showMeusRegistros} 
        onOpenChange={setShowMeusRegistros} 
      />

      {/* Histórico Modal */}
      <HistoricoApontamentosModal
        open={showHistorico}
        onOpenChange={setShowHistorico}
      />
    </div>
  );
}
