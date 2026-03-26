import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, BarChart3, ClipboardList, MapPin, Users, Shield, Smartphone, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import logoApropriapp from '@/assets/logo-apropriapp.png';


const features = [
  { icon: ClipboardList, title: 'Apontamentos', description: 'Registro digital de operações' },
  { icon: BarChart3, title: 'Dashboard', description: 'Métricas em tempo real' },
  { icon: MapPin, title: 'Rastreamento', description: 'Controle de frota completo' },
  { icon: Users, title: 'Equipes', description: 'Gestão de apontadores' },
];

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const { signIn, signOut, user, profile, role, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check for redirect param
  const searchParams = new URLSearchParams(window.location.search);
  const redirectTo = searchParams.get('redirect');

  // Redirect after login — validate allowed email first
  useEffect(() => {
    if (!user || authLoading) return;

    const validateAndRedirect = async () => {
      // Check if user email is in allowed_emails
      const { data: allowed } = await supabase
        .from('allowed_emails')
        .select('id, tipo')
        .eq('email', user.email?.toLowerCase() ?? '')
        .eq('status', 'ativo')
        .maybeSingle();

      if (!allowed) {
        toast({
          variant: 'destructive',
          title: 'Acesso negado',
          description: 'Seu email não está cadastrado no sistema. Contate o administrador.',
        });
        await signOut();
        return;
      }

      // If there's a redirect param, use it
      if (redirectTo) {
        navigate(redirectTo, { replace: true });
        return;
      }

      // Admin override by email — redirect immediately
      if (isAdmin) {
        navigate('/dashboard', { replace: true });
        return;
      }

      // For non-admin users, wait for role and profile
      if (role !== null && profile !== null) {
        if (profile?.tipo === 'Responsavel RDO') {
          navigate('/rdo/portal', { replace: true });
        } else if (role === 'apontador') {
          sessionStorage.setItem('apontadorDesktopMode', 'true');
          navigate('/apontador-desktop', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }
    };

    validateAndRedirect();
  }, [user, authLoading, isAdmin, role, profile, navigate, redirectTo]);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha email e senha.' });
      return;
    }
    setEmailLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        let message = 'Erro ao fazer login';
        const rawMsg = (error as any)?.message || '';
        if (rawMsg.includes('Invalid login credentials')) message = 'Email ou senha inválidos.';
        else if (rawMsg.includes('Email not confirmed')) message = 'Conta não confirmada. Contate o administrador.';
        toast({ variant: 'destructive', title: 'Erro', description: message });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro. Tente novamente.' });
    } finally {
      setEmailLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary via-secondary/95 to-secondary/90 flex relative overflow-hidden">
      {/* Background Logo Watermark */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url(${logoApropriapp})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Left Panel - Presentation (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-between p-8 xl:p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary rounded-full blur-3xl" />
        </div>
        
        {/* Logo and Title */}
        <div
          className={cn(
            'relative z-10 transition-all duration-700',
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          )}
        >
          <div className="flex items-center gap-4 mb-2">
            <img src={logoApropriapp} alt="ApropriAPP" className="w-20 h-20 object-contain" />
            <div>
              <h1 className="text-3xl font-bold text-white">ApropriAPP</h1>
              <p className="text-secondary-foreground/70 text-sm">Gestão Inteligente de Operações</p>
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        <div
          className={cn(
            'relative z-10 max-w-lg transition-all duration-700 delay-200',
            showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}
        >
          <h2 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
            Controle total das suas
            <span className="text-primary block">operações de campo</span>
          </h2>
          <p className="text-secondary-foreground/70 text-lg mb-8">
            Acompanhe em tempo real a produtividade da sua frota, gerencie apontamentos e tome decisões baseadas em dados.
          </p>
          
          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all duration-500',
                  showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                )}
                style={{ transitionDelay: `${300 + index * 100}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{feature.title}</h3>
                  <p className="text-secondary-foreground/60 text-xs">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className={cn(
            'relative z-10 flex items-center gap-6 transition-all duration-700 delay-700',
            showContent ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="flex items-center gap-2 text-secondary-foreground/50 text-sm">
            <Shield className="w-4 h-4" />
            <span>Dados seguros</span>
          </div>
          <div className="flex items-center gap-2 text-secondary-foreground/50 text-sm">
            <Smartphone className="w-4 h-4" />
            <span>App mobile PWA</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-4 sm:p-8">
        <Card
          className={cn(
            'w-full max-w-md bg-card/95 backdrop-blur-sm shadow-2xl transition-all duration-700',
            showContent ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          )}
        >
          <CardHeader className="text-center pb-2">
            {/* Mobile Logo */}
            <div className="lg:hidden flex justify-center mb-4">
              <img src={logoApropriapp} alt="ApropriAPP" className="w-24 h-24 object-contain" />
            </div>
            <CardTitle className="text-2xl lg:text-xl">
              <span className="lg:hidden">ApropriAPP</span>
              <span className="hidden lg:inline">Bem-vindo de volta</span>
            </CardTitle>
            <CardDescription className="text-base lg:text-sm">
              <span className="lg:hidden">Gestão Inteligente de Operações</span>
              <span className="hidden lg:inline">Faça login para acessar o sistema</span>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Email/Password Form */}
              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={emailLoading || loading}
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      disabled={emailLoading || loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 text-base font-medium" disabled={emailLoading || loading}>
                  {emailLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Entrando...</> : 'Entrar'}
                </Button>
              </form>


              <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20 backdrop-blur-sm animate-pulse">
                <p className="text-xs text-primary font-medium text-center leading-relaxed">
                  Crie o login de acesso do adm principal, <span className="font-bold underline">jeanallbuquerque@gmail.com</span>, senha <span className="font-bold underline">051525</span>... Para continuar configuração do sistema
                </p>
              </div>
            </div>

          </CardContent>

          {/* Links e rodapé */}
          <div className="px-6 pb-6 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              onClick={() => navigate('/mobile/auth')}
              className="w-full text-sm text-primary hover:text-primary/80 transition-colors"
            >
              É apontador? <span className="font-medium underline underline-offset-2">Acesse aqui</span>
            </button>

            <button
              onClick={() => navigate('/dashboard-only')}
              className="w-full text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Dashboard Público
            </button>

            <p className="text-[11px] text-muted-foreground/60 text-center pt-1">
              Acesso restrito · Contate o administrador
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
