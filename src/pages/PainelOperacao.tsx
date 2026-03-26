import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import FormPedreiraCiclo from '@/pages/mobile/forms/FormPedreiraCiclo';
import { Mountain, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PainelOperacao() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/painel-operacao/auth', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Mountain className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Painel de Operação</h1>
              <p className="text-sm text-muted-foreground">
                Apontamento Pedreira — Britador, Balança e Obra
                {profile?.nome && <span className="ml-2 text-xs opacity-60">• {profile.nome}</span>}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-1" />
            Sair
          </Button>
        </div>

        {/* Form */}
        <FormPedreiraCiclo desktopMode />
      </div>
    </div>
  );
}
