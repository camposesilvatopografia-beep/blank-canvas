import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminPermissions, AdminSection } from '@/hooks/useAdminPermissions';
import { useAppLogo } from '@/hooks/useAppLogo';
import { useSidebarMenuConfig } from '@/hooks/useSidebarMenuConfig';
import {
  LayoutDashboard, Truck, Upload, Download, Mountain, Droplets,
  CloudRain, FlaskConical, Settings, Users, MapPin, Package,
  Building2, ChevronDown, ChevronRight, Smartphone, LogOut, Bell,
  ShieldCheck, Clock, ClipboardList, BarChart3, Warehouse, LayoutGrid, Menu, ExternalLink,
  MessageCircle, Gauge, Wrench, Fuel,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TypePermissionsModal } from '@/components/crud/TypePermissionsModal';
import { SidebarMenuConfigModal } from '@/components/crud/SidebarMenuConfigModal';

import logoApropriapp from '@/assets/logo-apropriapp.png';

interface MenuItem {
  title: string;
  icon: React.ElementType;
  path?: string;
  sectionKey?: AdminSection;
  children?: MenuItem[];
  adminOnly?: boolean;
  menuKey: string;
}

const menuColorMap: Record<string, { border: string; bg: string; activeBg: string; text: string }> = {
  'Dashboard':    { border: 'border-l-orange-400',  bg: '',                        activeBg: 'bg-orange-500/20',   text: 'text-orange-300' },
  'Painel de Operação': { border: 'border-l-amber-400', bg: 'bg-amber-500/5', activeBg: 'bg-amber-500/20', text: 'text-amber-300' },
  'Engenharia':   { border: 'border-l-sky-400',     bg: 'bg-sky-500/5',           activeBg: 'bg-sky-500/20',      text: 'text-sky-300' },
  'Carga':        { border: 'border-l-emerald-400',  bg: '',                        activeBg: 'bg-emerald-500/20',  text: 'text-emerald-300' },
  'Lançamento':   { border: 'border-l-violet-400',   bg: '',                        activeBg: 'bg-violet-500/20',   text: 'text-violet-300' },
  'Pedreira':     { border: 'border-l-amber-400',    bg: '',                        activeBg: 'bg-amber-500/20',    text: 'text-amber-300' },
  'Pipas':        { border: 'border-l-cyan-400',     bg: '',                        activeBg: 'bg-cyan-500/20',     text: 'text-cyan-300' },
  'Cal':          { border: 'border-l-lime-400',     bg: '',                        activeBg: 'bg-lime-500/20',     text: 'text-lime-300' },
  'Pluviometria': { border: 'border-l-blue-400',     bg: '',                        activeBg: 'bg-blue-500/20',     text: 'text-blue-300' },
  'Sala Técnica': { border: 'border-l-rose-400', bg: 'bg-rose-500/5', activeBg: 'bg-rose-500/20', text: 'text-rose-300' },
  'Frota Geral':  { border: 'border-l-teal-400',     bg: '',                        activeBg: 'bg-teal-500/20',     text: 'text-teal-300' },
  'Alertas':      { border: 'border-l-red-400',      bg: '',                        activeBg: 'bg-red-500/20',      text: 'text-red-300' },
  'Almoxarifado': { border: 'border-l-yellow-400',   bg: '',                        activeBg: 'bg-yellow-500/20',   text: 'text-yellow-300' },
  'Cadastros':    { border: 'border-l-purple-400',   bg: 'bg-purple-500/5',        activeBg: 'bg-purple-500/20',   text: 'text-purple-300' },
  'Controle de Manutenção e Abastecimentos': { border: 'border-l-indigo-400', bg: 'bg-indigo-500/5', activeBg: 'bg-indigo-500/20', text: 'text-indigo-300' },
};

const menuItems: MenuItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', sectionKey: 'dashboard', menuKey: 'dashboard' },
  {
    title: 'Painel de Operação', icon: Mountain, menuKey: 'painel_operacao',
    children: [
      { title: 'Abrir Painel', icon: ExternalLink, path: '/painel-operacao', menuKey: 'painel_operacao_abrir' },
    ],
  },
  {
    title: 'Engenharia', icon: ClipboardList, menuKey: 'engenharia',
    children: [
      { title: "RDO's", icon: ClipboardList, menuKey: 'eng_rdos', children: [
        { title: 'RDO - Relatórios', icon: ClipboardList, path: '/engenharia/rdo', menuKey: 'eng_rdo' },
        { title: 'RDO - Etapas', icon: Building2, path: '/engenharia/rdo/etapas', menuKey: 'eng_etapas' },
        { title: 'RDO - Responsáveis', icon: Users, path: '/engenharia/rdo/responsaveis', menuKey: 'eng_resp' },
      ]},
      { title: 'Equipamentos', icon: Truck, path: '/engenharia/equipamentos', menuKey: 'eng_equipamentos' },
      { title: 'Medição de Equipamentos', icon: Clock, path: '/engenharia/medicao-equipamentos', menuKey: 'eng_medicao' },
    ],
  },
  { title: 'Carga', icon: Upload, path: '/operacao/carga', sectionKey: 'carga', menuKey: 'carga' },
  { title: 'Lançamento', icon: Download, path: '/operacao/descarga', sectionKey: 'lancamento', menuKey: 'lancamento' },
  { title: 'Pedreira', icon: Mountain, path: '/operacao/pedreira', sectionKey: 'pedreira', menuKey: 'pedreira' },
  { title: 'Pipas', icon: Droplets, path: '/operacao/pipas', sectionKey: 'pipas', menuKey: 'pipas' },
  { title: 'Cal', icon: FlaskConical, path: '/operacao/cal', sectionKey: 'cal', menuKey: 'cal' },
  { title: 'Pluviometria', icon: CloudRain, path: '/operacao/pluviometria', menuKey: 'pluviometria' },
  {
    title: 'Sala Técnica', icon: ClipboardList, menuKey: 'sala_tecnica',
    children: [
      
      { title: 'Frota Geral da Obra', icon: Truck, path: '/sala-tecnica/frota-geral-obra', menuKey: 'sala_tecnica_frota_geral' },
      { title: 'Histórico dos Veículos', icon: Clock, path: '/historico-veiculos', sectionKey: 'frota', menuKey: 'historico_veiculos' },
      { title: 'Caminhões Areia Express', icon: Truck, path: '/sala-tecnica/caminhoes-areia-express', menuKey: 'sala_tecnica_areia_express' },
      { title: 'Caminhões Herval', icon: Truck, path: '/sala-tecnica/caminhoes-herval', menuKey: 'sala_tecnica_herval' },
    ],
  },
  {
    title: 'Controle de Manutenção e Abastecimentos', icon: Fuel, menuKey: 'manutencao_abastecimento',
    children: [
      { title: 'Abastecimentos', icon: Droplets, path: '/manutencao/abastecimentos', menuKey: 'manut_abastecimentos' },
      { title: 'Horímetros', icon: Gauge, path: '/manutencao/horimetros', menuKey: 'manut_horimetros' },
      { title: 'Manutenções', icon: Wrench, path: '/manutencao/manutencoes', menuKey: 'manut_manutencoes' },
    ],
  },
  { title: 'Frota Geral', icon: Truck, path: '/frota', sectionKey: 'frota', menuKey: 'frota_geral' },
  { title: 'Alertas', icon: Bell, path: '/alertas', sectionKey: 'alertas', menuKey: 'alertas' },
  { title: 'Almoxarifado', icon: Warehouse, path: '/almoxarifado', adminOnly: true, menuKey: 'almoxarifado' },
  { title: 'Suporte', icon: MessageCircle, path: '/suporte', adminOnly: true, menuKey: 'suporte' },
  {
    title: 'Cadastros', icon: Settings, sectionKey: 'cadastros', menuKey: 'cadastros',
    children: [
      { title: 'Dados da Obra', icon: Building2, path: '/cadastros/obra', menuKey: 'cad_obra' },
      { title: 'Apontadores', icon: Users, path: '/cadastros/apontadores', menuKey: 'cad_apontadores' },
      { title: 'Usuários', icon: Users, path: '/cadastros/usuarios', menuKey: 'cad_usuarios' },
      { title: 'Locais', icon: MapPin, path: '/cadastros/locais', menuKey: 'cad_locais' },
      { title: 'Materiais', icon: Package, path: '/cadastros/materiais', menuKey: 'cad_materiais' },
      { title: 'Mat. Pedreira', icon: Mountain, path: '/cadastros/materiais-pedreira', menuKey: 'cad_mat_pedreira' },
      { title: 'Fornecedores CAL', icon: Building2, path: '/cadastros/fornecedores', menuKey: 'cad_forn_cal' },
      { title: 'Forn. Pedreira', icon: Mountain, path: '/cadastros/fornecedores-pedreira', menuKey: 'cad_forn_pedreira' },
      { title: 'Equipamentos', icon: Truck, path: '/cadastros/equipamentos', menuKey: 'cad_equipamentos' },
      { title: 'Config. Colunas', icon: Settings, path: '/cadastros/configuracao-colunas', adminOnly: true, menuKey: 'cad_config_colunas' },
      { title: 'Config. Layout', icon: LayoutGrid, path: '/cadastros/configuracao-layout', adminOnly: true, menuKey: 'cad_config_layout' },
      { title: 'Importação de Tabelas', icon: Download, path: '/importacao-sheets', adminOnly: true, menuKey: 'importacao_sheets' },
    ],
  },
];

// Extract flat menu definitions for the config modal
const MENU_DEFS = menuItems.map(item => ({ key: item.menuKey, defaultLabel: item.title }));

export const AppSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, isAdmin, loading: authLoading, isReadOnly } = useAuth();
  const { canView, loading: permissionsLoading } = useAdminPermissions();
  const { customLogo } = useAppLogo();
  const { configs: menuConfigs, getLabel, isVisible: isMenuVisible, getOrder, saveConfigs: saveMenuConfigs } = useSidebarMenuConfig();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [menuConfigModalOpen, setMenuConfigModalOpen] = useState(false);

  const toggleMenu = (title: string) => {
    setOpenMenus(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const isActive = (path?: string) => path && location.pathname === path;
  const isChildActive = (children?: MenuItem[]) =>
    children?.some(child => 
      location.pathname === child.path || 
      child.children?.some(sc => location.pathname === sc.path)
    );

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isFullAdmin = isAdmin || profile?.tipo === 'Administrador' || profile?.email === 'jeanallbuquerque@gmail.com';
  const stillLoading = authLoading || permissionsLoading;
  const canConfigurePermissions = profile?.tipo === 'Administrador' || profile?.email === 'jeanallbuquerque@gmail.com';
  const isMainAdmin = profile?.email === 'jeanallbuquerque@gmail.com';

  // Filter and sort menu items based on config
  const filteredMenuItems = useMemo(() => {
    const filtered = menuItems.filter(item => {
      // Hide Cadastros for read-only (Visualização) users
      if (isReadOnly && item.sectionKey === 'cadastros') return false;
      if (item.adminOnly && !isMainAdmin && !(item.menuKey === 'almoxarifado' && profile?.email === 'almoxarifado@apropriapp.com')) return false;
      if (!isMenuVisible(item.menuKey)) return false;
      if (!item.sectionKey) return true;
      if (stillLoading) return isFullAdmin;
      if (isFullAdmin) return true;
      return canView(item.sectionKey);
    });

    // Sort by saved order
    return filtered.sort((a, b) => {
      const orderA = getOrder(a.menuKey, menuItems.indexOf(a));
      const orderB = getOrder(b.menuKey, menuItems.indexOf(b));
      return orderA - orderB;
    });
  }, [menuConfigs, isFullAdmin, stillLoading, isMainAdmin, canView, getOrder, isMenuVisible, isReadOnly]);

  return (
    <aside className="w-64 h-full bg-sidebar text-sidebar-foreground flex flex-col relative overflow-hidden">
      {/* Background Logo Watermark */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url(${logoApropriapp})`,
          backgroundSize: '180%',
          backgroundPosition: 'center 60%',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border relative z-10">
        <div className="flex items-center gap-3">
          <img src={customLogo || logoApropriapp} alt="ApropriAPP" className="w-12 h-12 object-contain rounded" />
          <div>
            <h1 className="font-bold text-lg">ApropriAPP</h1>
            <p className="text-xs text-sidebar-foreground/70">Gestão Inteligente</p>
          </div>
        </div>
      </div>

      {/* App Mobile Button */}
      <div className="p-4 relative z-10">
        <Button
          variant="outline"
          onClick={() => navigate('/mobile')}
          className="w-full justify-start gap-3 bg-sidebar-accent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/80"
        >
          <Smartphone className="w-5 h-5" />
          <div className="text-left">
            <div className="font-medium">App Mobile</div>
            <div className="text-xs opacity-70">Apontar em campo</div>
          </div>
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4 relative z-10">
        {filteredMenuItems.map(item => {
          const colors = menuColorMap[item.title];
          const displayLabel = getLabel(item.menuKey, item.title);
          return (
          <div key={item.menuKey}>
            {item.children ? (
              <Collapsible
                open={openMenus.includes(item.title)}
                onOpenChange={() => toggleMenu(item.title)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 border-l-2',
                      colors?.border || 'border-l-transparent',
                      isChildActive(item.children)
                        ? cn(colors?.activeBg || 'bg-sidebar-primary', colors?.text || 'text-sidebar-primary-foreground')
                        : cn('hover:bg-sidebar-accent text-sidebar-foreground', colors?.bg)
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={cn('w-5 h-5', isChildActive(item.children) && colors?.text)} />
                      <span>{displayLabel}</span>
                    </div>
                    {openMenus.includes(item.title) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className={cn('ml-3 border-l-2 pl-2 space-y-0.5', colors?.border || 'border-l-sidebar-border')}>
                    {item.children.filter(child => !child.adminOnly || isMainAdmin).map(child => {
                      const childLabel = getLabel(child.menuKey, child.title);
                      
                      // Nested sub-menu (e.g. RDO's inside Engenharia)
                      if (child.children) {
                        const isSubOpen = openMenus.includes(child.menuKey);
                        const isSubChildActive = child.children.some(sc => location.pathname === sc.path);
                        return (
                          <Collapsible key={child.menuKey} open={isSubOpen} onOpenChange={() => toggleMenu(child.menuKey)}>
                            <CollapsibleTrigger asChild>
                              <button
                                className={cn(
                                  'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                                  isSubChildActive
                                    ? cn(colors?.activeBg || 'bg-sidebar-primary', colors?.text || 'text-sidebar-primary-foreground')
                                    : 'hover:bg-sidebar-accent text-sidebar-foreground/80'
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <child.icon className={cn('w-3.5 h-3.5 shrink-0', isSubChildActive && colors?.text)} />
                                  <span className="truncate">{childLabel}</span>
                                </div>
                                {isSubOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className={cn('ml-3 border-l-2 pl-2 space-y-0.5', colors?.border || 'border-l-sidebar-border')}>
                                {child.children.filter(sc => !sc.adminOnly || isMainAdmin).map(sc => {
                                  const scLabel = getLabel(sc.menuKey, sc.title);
                                  return (
                                    <button
                                      key={sc.path}
                                      onClick={() => navigate(sc.path!)}
                                      className={cn(
                                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors min-w-0',
                                        isActive(sc.path)
                                          ? cn(colors?.activeBg || 'bg-sidebar-primary', colors?.text || 'text-sidebar-primary-foreground', 'font-medium')
                                          : 'hover:bg-sidebar-accent text-sidebar-foreground/80'
                                      )}
                                    >
                                      <sc.icon className={cn('w-3.5 h-3.5 shrink-0', isActive(sc.path) && colors?.text)} />
                                      <span className="truncate">{scLabel}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      }

                      return (
                      <button
                        key={child.path}
                        onClick={() => {
                          if (child.path?.startsWith('/painel-operacao')) {
                            window.open(child.path, '_blank');
                          } else {
                            navigate(child.path!);
                          }
                        }}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors min-w-0',
                          isActive(child.path)
                            ? cn(colors?.activeBg || 'bg-sidebar-primary', colors?.text || 'text-sidebar-primary-foreground', 'font-medium')
                            : 'hover:bg-sidebar-accent text-sidebar-foreground/80'
                        )}
                      >
                        <child.icon className={cn('w-3.5 h-3.5 shrink-0', isActive(child.path) && colors?.text)} />
                        <span className="truncate">{childLabel}</span>
                      </button>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <button
                onClick={() => {
                  if (item.path === '/painel-operacao') {
                    window.open(item.path, '_blank');
                  } else {
                    navigate(item.path!);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 border-l-2',
                  colors?.border || 'border-l-transparent',
                  isActive(item.path)
                    ? cn(colors?.activeBg || 'bg-sidebar-primary', colors?.text || 'text-sidebar-primary-foreground')
                    : cn('hover:bg-sidebar-accent text-sidebar-foreground', colors?.bg)
                )}
              >
                <item.icon className={cn('w-5 h-5', isActive(item.path) && colors?.text)} />
                <span>{displayLabel}</span>
              </button>
            )}
          </div>
          );
        })}

        {/* Admin buttons */}
        {canConfigurePermissions && !isReadOnly && (
          <button
            onClick={() => setPermissionsModalOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 mt-2 border border-dashed border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground/70"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Gerenciar Permissões</span>
          </button>
        )}

        {isMainAdmin && !isReadOnly && (
          <button
            onClick={() => setMenuConfigModalOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 border border-dashed border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground/70"
          >
            <Menu className="w-5 h-5" />
            <span>Configurar Menu</span>
          </button>
        )}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border relative z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/perfil')}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
          >
            <Avatar className="w-10 h-10 bg-primary">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {profile?.nome ? getInitials(profile.nome) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <p className="font-medium text-sm truncate">{profile?.nome || 'Usuário'}</p>
              <p className="text-xs text-sidebar-foreground/70 truncate">
                {isReadOnly ? '👁 Visualização' : (profile?.tipo || (isAdmin ? 'Administrador' : 'Usuário'))}
              </p>
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Modals */}
      <TypePermissionsModal open={permissionsModalOpen} onOpenChange={setPermissionsModalOpen} />
      <SidebarMenuConfigModal
        open={menuConfigModalOpen}
        onOpenChange={setMenuConfigModalOpen}
        menuDefs={MENU_DEFS}
        currentConfigs={menuConfigs}
        onSave={saveMenuConfigs}
      />
      
    </aside>
  );
};
