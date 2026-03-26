import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, Menu, LayoutDashboard, Truck, Upload, Download, Mountain, Droplets, FlaskConical, MapPin, Package, Building2, Users, UserCog, Smartphone, LogOut, ChevronDown, ChevronRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { NotificationPanel } from './NotificationPanel';
import { useAppLogo } from '@/hooks/useAppLogo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import logoApropriapp from '@/assets/logo-apropriapp.png';

export const AppHeader = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const { customLogo } = useAppLogo();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, isAdmin } = useAuth();

  const checkForUpdates = async () => {
    if (!('serviceWorker' in navigator)) {
      toast.info('Atualizações automáticas não disponíveis neste navegador');
      return;
    }

    setIsCheckingUpdate(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      
      if (registration.waiting) {
        // New version available
        toast.success('Nova versão encontrada! Atualizando...', { duration: 2000 });
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => window.location.reload(), 1500);
      } else if (registration.installing) {
        // Update installing
        toast.info('Atualização em andamento...', { duration: 2000 });
        registration.installing.addEventListener('statechange', () => {
          if (registration.installing?.state === 'installed') {
            window.location.reload();
          }
        });
      } else {
        toast.success('Sistema já está na versão mais recente!');
      }
    } catch (error) {
      console.error('Erro ao verificar atualizações:', error);
      toast.error('Erro ao verificar atualizações');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if current user is Administrador (can configure permissions)
  const canConfigurePermissions = profile?.tipo === 'Administrador' || 
    profile?.email === 'jeanallbuquerque@gmail.com';

  const mainMenuItems = [
    { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { title: 'Carga', icon: Upload, path: '/operacao/carga' },
    { title: 'Lançamento', icon: Download, path: '/operacao/descarga' },
    { title: 'Pedreira', icon: Mountain, path: '/operacao/pedreira' },
    { title: 'Pipas', icon: Droplets, path: '/operacao/pipas' },
    { title: 'Cal', icon: FlaskConical, path: '/operacao/cal' },
  ];

  const cadastroItems = [
    { title: 'Apontadores', icon: Users, path: '/cadastros/apontadores' },
    { title: 'Usuários', icon: UserCog, path: '/cadastros/usuarios' },
    { title: 'Locais', icon: MapPin, path: '/cadastros/locais' },
    { title: 'Materiais', icon: Package, path: '/cadastros/materiais' },
    { title: 'Mat. Pedreira', icon: Mountain, path: '/cadastros/materiais-pedreira' },
    { title: 'Fornecedores CAL', icon: Building2, path: '/cadastros/fornecedores' },
    { title: 'Equipamentos', icon: Truck, path: '/cadastros/equipamentos' },
  ];

  const otherMenuItems = [
    { title: 'Frota Geral', icon: Truck, path: '/frota' },
    { title: 'Alertas', icon: Bell, path: '/alertas' },
  ];

  const isCadastroActive = cadastroItems.some(item => location.pathname === item.path);

  return (
    <header className="h-14 md:h-16 border-b border-border bg-card px-3 md:px-6 flex items-center justify-between gap-2 sticky top-0 z-40">
      {/* Mobile Menu Button */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon" className="shrink-0">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0 bg-sidebar text-sidebar-foreground overflow-y-auto">
          {/* Logo */}
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <img src={customLogo || logoApropriapp} alt="ApropriAPP" className="w-12 h-12 object-contain rounded" />
              <div>
                <h1 className="font-bold text-lg">ApropriAPP</h1>
                <p className="text-xs text-sidebar-foreground/70">Gestão Inteligente</p>
              </div>
            </div>
          </div>

          {/* Mobile App Button */}
          <div className="p-4 border-b border-sidebar-border">
            <Button
              variant="outline"
              onClick={() => handleNavigation('/mobile')}
              className="w-full justify-start gap-3 bg-sidebar-accent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/80 h-12"
            >
              <Smartphone className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">App Mobile</div>
                <div className="text-xs opacity-70">Apontar em campo</div>
              </div>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {/* Main Menu Items */}
            {mainMenuItems.map(item => (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors',
                  isActive(item.path)
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'hover:bg-sidebar-accent text-sidebar-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.title}</span>
              </button>
            ))}

            {/* Cadastros (Collapsible) */}
            <Collapsible open={cadastrosOpen || isCadastroActive} onOpenChange={setCadastrosOpen}>
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium transition-colors',
                    isCadastroActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'hover:bg-sidebar-accent text-sidebar-foreground'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5" />
                    <span>Cadastros</span>
                  </div>
                  {cadastrosOpen || isCadastroActive ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-4 mt-1 pl-4 border-l border-sidebar-border space-y-1">
                  {cadastroItems.map(item => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                        isActive(item.path)
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                          : 'hover:bg-sidebar-accent text-sidebar-foreground/80'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Other Menu Items */}
            {otherMenuItems.map(item => (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors',
                  isActive(item.path)
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'hover:bg-sidebar-accent text-sidebar-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.title}</span>
              </button>
            ))}

            {/* Gerenciar Permissões (Admin only) */}
            {canConfigurePermissions && (
              <button
                onClick={() => handleNavigation('/cadastros/usuarios')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors mt-4 border border-dashed border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground/70"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>Gerenciar Permissões</span>
              </button>
            )}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-sidebar-border mt-auto bg-sidebar-accent/30">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 bg-primary">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {profile?.nome ? getInitials(profile.nome) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base truncate">{profile?.nome || 'Usuário'}</p>
                <p className="text-sm text-sidebar-foreground/70">
                  {profile?.tipo || (isAdmin ? 'Administrador' : 'Usuário')}
                </p>
              </div>
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
        </SheetContent>
      </Sheet>

      {/* Logo for mobile */}
      <div className="flex items-center gap-2 lg:hidden">
        <img src={customLogo || logoApropriapp} alt="ApropriAPP" className="w-8 h-8 object-contain rounded" />
        <span className="font-bold text-base">ApropriAPP</span>
      </div>

      {/* Search - hidden on mobile */}
      <div className="hidden md:flex flex-1 max-w-xl lg:ml-0">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar equipamentos, locais, materiais..."
            className="pl-10 bg-background"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-1 md:gap-2">
        {/* Update Button */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={checkForUpdates}
          disabled={isCheckingUpdate}
          title="Verificar atualizações"
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn("w-5 h-5", isCheckingUpdate && "animate-spin")} />
        </Button>

        <NotificationPanel />
        
        {/* User avatar for desktop */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="hidden lg:flex"
          onClick={() => navigate('/perfil')}
        >
          <Avatar className="w-8 h-8 bg-primary">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {profile?.nome ? getInitials(profile.nome) : 'U'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  );
};
