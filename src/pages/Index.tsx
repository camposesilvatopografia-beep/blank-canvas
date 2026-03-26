import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import logo from '@/assets/logo-apropriapp.png';

const Index = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    // Aguarda o perfil carregar antes de redirecionar
    // Para o admin principal, redireciona imediatamente se email corresponder
    const isMainAdmin = user.email === 'jeanallbuquerque@gmail.com';
    
    // Todos os usuários vão para o dashboard
    if (isMainAdmin || isAdmin || profile?.tipo === 'Administrador' || profile?.tipo === 'Sala Técnica') {
      navigate('/dashboard', { replace: true });
    } else if (profile) {
      // Apontadores também vão para o dashboard (acesso comum)
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, isAdmin, loading, navigate]);

  const firstName = profile?.nome?.split(' ')[0];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        {/* Logo com animação de pulse suave */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <img 
            src={logo} 
            alt="ApropriAPP" 
            className="w-24 h-24 object-contain relative z-10 animate-scale-in"
          />
        </div>
        
        {/* Mensagem de boas-vindas e spinner */}
        <div className="flex flex-col items-center gap-3 text-center">
          {firstName ? (
            <p className="text-lg font-semibold text-foreground">
              Olá, {firstName}! 👋
            </p>
          ) : null}
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">
            {user ? 'Preparando seu painel...' : 'Verificando acesso...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
