import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Profile types that are allowed to access the mobile field app
const MOBILE_ALLOWED_TYPES = ['Apontador', 'Supervisor', 'Encarregado'];

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { user, profile, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if it's a mobile route
  const isMobileRoute = location.pathname.startsWith('/mobile');
  const isRdoPortal = location.pathname === '/rdo/portal';
  const isPainelOperacao = location.pathname.startsWith('/painel-operacao');

  if (!user) {
    // Redirect to appropriate auth page
    if (isPainelOperacao) {
      return <Navigate to="/painel-operacao/auth" state={{ from: location }} replace />;
    }
    if (isMobileRoute) {
      return <Navigate to="/mobile/auth" state={{ from: location }} replace />;
    }
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Restrict mobile field app to Apontador-type users only (admins can always access)
  if (isMobileRoute && profile && !MOBILE_ALLOWED_TYPES.includes(profile.tipo) && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2d3e50] via-[#1a2634] to-[#0f1419] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full bg-white/10 backdrop-blur-lg border-white/20 p-6 text-center">
          <Shield className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
          <p className="text-white/60 text-sm mb-6">
            O app de campo é exclusivo para Apontadores. Acesse o sistema completo pelo link abaixo.
          </p>
          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => window.location.href = '/auth'}
          >
            Acessar Sistema Completo
          </Button>
        </Card>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    // Non-admins should go to mobile interface
    return <Navigate to="/mobile" replace />;
  }

  // Responsavel RDO: can only access /rdo/portal
  if (!isAdmin && !isMobileRoute && !isRdoPortal) {
    // Check if they should be redirected to portal (handled by auth page redirect)
    return <>{children}</>;
  }

  return <>{children}</>;
};
