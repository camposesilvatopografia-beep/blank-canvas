import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Mountain, Scale } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoApropriapp from '@/assets/logo-apropriapp.png';

export default function PainelOperacaoAuth() {
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/painel-operacao', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loginInput.trim() || !password.trim()) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Preencha usuário e senha.' });
      return;
    }

    setLoading(true);

    try {
      const raw = loginInput.trim();
      let emailToUse = raw;

      if (!raw.includes('@')) {
        const { data, error } = await supabase.functions.invoke('lookup-user-email', {
          body: { login: raw.toLowerCase() },
        });

        if (error || !data?.email) {
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
        let message = 'Erro ao fazer login';
        const rawMsg = (error as any)?.message || '';
        if (rawMsg.includes('Invalid login credentials')) message = 'Usuário ou senha inválidos.';
        else if (rawMsg.includes('Email not confirmed')) message = 'Conta não confirmada. Contate o administrador.';

        toast({ variant: 'destructive', title: 'Erro', description: message });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha inesperada. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border-white/10 shadow-2xl">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <img src={logoApropriapp} alt="ApropriaApp" className="h-10 mx-auto opacity-80" />
            <div className="flex items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Mountain className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold text-white">Painel de Operação</h1>
                <p className="text-xs text-white/50">Pedreira — Britador · Balança · Obra</p>
              </div>
            </div>
          </div>

          {/* Features badges */}
          <div className="flex justify-center gap-2 flex-wrap">
            {[
              { icon: Scale, label: 'Balança Serial' },
              { icon: Mountain, label: 'Pedreira' },
            ].map((f) => (
              <span
                key={f.label}
                className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 rounded-full px-3 py-1.5 border border-white/10"
              >
                <f.icon className="w-3 h-3 text-amber-400" />
                {f.label}
              </span>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Usuário ou E-mail</Label>
              <Input
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Digite seu usuário"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-amber-500 focus:ring-amber-500/30"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 pr-10 focus:border-amber-500 focus:ring-amber-500/30"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Entrar no Painel
            </Button>
          </form>

          <p className="text-center text-white/30 text-xs">
            Acesso exclusivo para operadores de pedreira
          </p>
        </div>
      </Card>
    </div>
  );
}
