import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Smartphone, Eye, EyeOff, AtSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoApropriapp from '@/assets/logo-apropriapp.png';

export default function MobileAuth() {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, user, profile, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect based on user type after login
  const MOBILE_TYPES = ['Apontador', 'Supervisor', 'Encarregado'];
  
  useEffect(() => {
    if (user && !authLoading) {
      if (profile) {
        // Apontador types go to mobile, others go to the full system
        if (MOBILE_TYPES.includes(profile.tipo)) {
          navigate('/mobile');
        } else {
          navigate('/dashboard');
        }
      }
    }
  }, [user, authLoading, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginInput.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Digite seu usuário' });
      return;
    }

    if (!password.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Digite sua senha' });
      return;
    }

    setLoading(true);

    try {
      const raw = loginInput.trim();
      const normalizedLogin = raw.toLowerCase();
      let emailToUse = raw;

      // Check if input is username (not email format)
      if (!raw.includes('@')) {
        // Lookup email by username through backend function (avoids RLS issues on unauthenticated screens)
        const { data, error } = await supabase.functions.invoke('lookup-user-email', {
          body: { login: normalizedLogin },
        });

        if (error) {
          toast({
            variant: 'destructive',
            title: 'Erro',
            description: 'Falha ao buscar usuário. Tente novamente.',
          });
          setLoading(false);
          return;
        }

        if (!data?.email) {
          toast({
            variant: 'destructive',
            title: 'Erro',
            description: data?.error || 'Usuário não encontrado ou inativo.',
          });
          setLoading(false);
          return;
        }

        emailToUse = data.email;
      }

      const { error } = await signIn(emailToUse, password);

      if (error) {
        // Prefer showing a more actionable message on mobile.
        let message = 'Erro ao fazer login';
        const rawMsg = (error as any)?.message || '';

        if (rawMsg.includes('Invalid login credentials')) {
          message = 'Usuário ou senha inválidos.';
        } else if (rawMsg.includes('Email not confirmed')) {
          message = 'Conta não confirmada. Contate o administrador.';
        }

        // Dev-only: expose original error for debugging.
        if (import.meta.env.DEV && rawMsg) {
          message = `${message} (${rawMsg})`;
        }

        toast({
          variant: 'destructive',
          title: 'Erro',
          description: message,
        });
      } else {
        toast({
          title: 'Bem-vindo!',
          description: 'Login realizado com sucesso.',
        });
      }
    } catch (error: any) {
      const rawMsg = error?.message;
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: import.meta.env.DEV && rawMsg ? rawMsg : 'Ocorreu um erro. Tente novamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2d3e50] via-[#1a2634] to-[#0f1419] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url(${logoApropriapp})`,
          backgroundSize: '150%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Logo and Title */}
      <div className="text-center mb-8 relative z-10">
        <div className="w-28 h-28 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 shadow-2xl">
          <img src={logoApropriapp} alt="ApropriAPP" className="w-20 h-20 object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">ApropriAPP</h1>
        <p className="text-white/60 text-sm">Apontamento em Campo</p>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-sm bg-white/10 backdrop-blur-lg border-white/20 p-6 relative z-10">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Smartphone className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-xl font-semibold text-white">Acesso do Apontador</h2>
          <p className="text-white/60 text-sm mt-1">Entre com seu usuário e senha</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login" className="text-white/80 flex items-center gap-1">
              <AtSign className="w-3 h-3" />
              Usuário
            </Label>
            <Input
              id="login"
              type="text"
              placeholder="seu.usuario"
              value={loginInput}
              onChange={e => setLoginInput(e.target.value)}
              required
              disabled={loading}
              className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-amber-500"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-amber-500 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-semibold bg-amber-500 hover:bg-amber-600 text-white" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>


        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-amber-500 text-[10px] font-medium text-center leading-relaxed bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
            Crie o login de acesso do adm principal, jeanallbuquerque@gmail.com, senha 051525... Para continuar configuração do sistema
          </p>
        </div>
      </Card>

      {/* Install App Link */}
      <button
        onClick={() => navigate('/install')}
        className="mt-6 text-white/50 text-sm hover:text-white/70 transition-colors relative z-10"
      >
        Primeira vez? <span className="text-amber-500 underline">Instale o App</span>
      </button>

      {/* Footer */}
      <p className="text-white/30 text-xs mt-8 relative z-10">
        © 2026 ApropriAPP - Gestão Inteligente
      </p>
    </div>
  );
}
