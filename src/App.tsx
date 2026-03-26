import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { OfflineSyncProvider } from "@/hooks/useOfflineSync";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { SplashScreen } from "@/components/layout/SplashScreen";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Carga from "./pages/operacao/Carga";
import Descarga from "./pages/operacao/Descarga";
import Pedreira from "./pages/operacao/Pedreira";
import Pipas from "./pages/operacao/Pipas";
import Pluviometria from "./pages/operacao/Pluviometria";
import Cal from "./pages/operacao/Cal";
import Locais from "./pages/cadastros/Locais";
import Materiais from "./pages/cadastros/Materiais";
import MateriaisPedreira from "./pages/cadastros/MateriaisPedreira";
import Apontadores from "./pages/cadastros/Apontadores";
import Fornecedores from "./pages/cadastros/Fornecedores";
import FornecedoresPedreira from "./pages/cadastros/FornecedoresPedreira";
import Usuarios from "./pages/cadastros/Usuarios";
import Obra from "./pages/cadastros/Obra";
import Equipamentos from "./pages/cadastros/Equipamentos";
import Frota from "./pages/Frota";
import HistoricoVeiculos from "./pages/HistoricoVeiculos";
import Alertas from "./pages/Alertas";
import Perfil from "./pages/Perfil";
import Abastech from "./pages/Abastech";
import NotFound from "./pages/NotFound";
import DashboardOnly from "./pages/DashboardOnly";
import PainelApontador from "./pages/painel-apontador/Index";
import RDO from "./pages/engenharia/RDO";
import RDOEtapas from "./pages/engenharia/RDOEtapas";
import RDOResponsaveis from "./pages/engenharia/RDOResponsaveis";
import RDOAprovacao from "./pages/engenharia/RDOAprovacao";
import RDOUsuarios from "./pages/engenharia/RDOUsuarios";
import RDOPortal from "./pages/engenharia/RDOPortal";

import EquipamentosMobilizacao from "./pages/engenharia/EquipamentosMobilizacao";
import RetigraficoTopografico from "./pages/engenharia/RetigraficoTopografico";
import MedicaoEquipamentos from "./pages/engenharia/MedicaoEquipamentos";
import Almoxarifado from "./pages/Almoxarifado";
import Relatorios from "./pages/sala-tecnica/Relatorios";
import RelatorioCombinado from "./pages/sala-tecnica/RelatorioCombinado";
import FrotaGeralObra from "./pages/sala-tecnica/FrotaGeralObra";
import CaminhoesAreiaExpress from "./pages/sala-tecnica/CaminhoesAreiaExpress";
import CaminhoesHerval from "./pages/sala-tecnica/CaminhoesHerval";
import ConfiguracaoColunas from "./pages/cadastros/ConfiguracaoColunas";
import ConfiguracaoLayout from "./pages/cadastros/ConfiguracaoLayout";
import SupportInbox from "./pages/SupportInbox";
import ApontadorDesktop from "./pages/ApontadorDesktop";
import PainelOperacao from "./pages/PainelOperacao";
import PainelOperacaoAuth from "./pages/PainelOperacaoAuth";
// Mobile pages
import MobileHome from "./pages/mobile/MobileHome";
import MobileAuth from "./pages/mobile/MobileAuth";
import FormCarga from "./pages/mobile/forms/FormCarga";
import FormLancamento from "./pages/mobile/forms/FormLancamento";
import FormPedreira from "./pages/mobile/forms/FormPedreira";
import FormPedreiraCiclo from "./pages/mobile/forms/FormPedreiraCiclo";
import FormPipas from "./pages/mobile/forms/FormPipas";
import FormCal from "./pages/mobile/forms/FormCal";
import FormCalEntrada from "./pages/mobile/forms/FormCalEntrada";
import FormCalSaida from "./pages/mobile/forms/FormCalSaida";
import FormUsinaSolos from "./pages/mobile/forms/FormUsinaSolos";
import FormCaminhoesAreiaExpress from "./pages/mobile/forms/FormCaminhoesAreiaExpress";
import FormCaminhoesHerval from "./pages/mobile/forms/FormCaminhoesHerval";
import InstallApp from "./pages/mobile/InstallApp";
// Mobile reports
import MobileReportCarga from "./pages/mobile/reports/MobileReportCarga";
import MobileReportPedreira from "./pages/mobile/reports/MobileReportPedreira";
import MobileReportPipas from "./pages/mobile/reports/MobileReportPipas";
import MobileReportCal from "./pages/mobile/reports/MobileReportCal";

const queryClient = new QueryClient();

// Wrapper component to handle splash screen on mobile routes
function MobileRouteWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [showSplash, setShowSplash] = useState(false);
  const [splashComplete, setSplashComplete] = useState(false);
  
  useEffect(() => {
    // Only show splash screen on mobile auth route (TWA entry point)
    // and only once per session
    const isMobileAuth = location.pathname === '/mobile/auth';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasShownSplash = sessionStorage.getItem('splashShown');
    
    if (isMobileAuth && isStandalone && !hasShownSplash) {
      setShowSplash(true);
      sessionStorage.setItem('splashShown', 'true');
    } else {
      setSplashComplete(true);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    setSplashComplete(true);
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} duration={2500} />}
      {splashComplete && children}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ImpersonationProvider>
          <OfflineSyncProvider>
            <MobileRouteWrapper>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<Auth />} />
                
                {/* Mobile Routes */}
                <Route path="/mobile/auth" element={<MobileAuth />} />
                <Route path="/mobile" element={<ProtectedRoute><MobileHome /></ProtectedRoute>} />
                <Route path="/mobile/carga" element={<ProtectedRoute><FormCarga /></ProtectedRoute>} />
                <Route path="/mobile/lancamento" element={<ProtectedRoute><FormLancamento /></ProtectedRoute>} />
                <Route path="/mobile/pedreira" element={<ProtectedRoute><FormPedreira /></ProtectedRoute>} />
                <Route path="/mobile/pedreira-ciclo" element={<ProtectedRoute><FormPedreiraCiclo /></ProtectedRoute>} />
                <Route path="/mobile/pipas" element={<ProtectedRoute><FormPipas /></ProtectedRoute>} />
                <Route path="/mobile/cal" element={<ProtectedRoute><FormCal /></ProtectedRoute>} />
                <Route path="/mobile/cal-entrada" element={<ProtectedRoute><FormCalEntrada /></ProtectedRoute>} />
                <Route path="/mobile/cal-saida" element={<ProtectedRoute><FormCalSaida /></ProtectedRoute>} />
                <Route path="/mobile/usina-solos" element={<ProtectedRoute><FormUsinaSolos /></ProtectedRoute>} />
                <Route path="/mobile/caminhoes-areia-express" element={<ProtectedRoute><FormCaminhoesAreiaExpress /></ProtectedRoute>} />
                <Route path="/mobile/caminhoes-herval" element={<ProtectedRoute><FormCaminhoesHerval /></ProtectedRoute>} />
                {/* Mobile Reports */}
                <Route path="/mobile/relatorios-carga" element={<ProtectedRoute><MobileReportCarga /></ProtectedRoute>} />
                <Route path="/mobile/relatorios-pedreira" element={<ProtectedRoute><MobileReportPedreira /></ProtectedRoute>} />
                <Route path="/mobile/relatorios-pipas" element={<ProtectedRoute><MobileReportPipas /></ProtectedRoute>} />
                <Route path="/mobile/relatorios-cal" element={<ProtectedRoute><MobileReportCal /></ProtectedRoute>} />
                <Route path="/install" element={<InstallApp />} />
                <Route path="/painel-operacao/auth" element={<PainelOperacaoAuth />} />
                <Route path="/painel-operacao" element={<ProtectedRoute><PainelOperacao /></ProtectedRoute>} />
                <Route path="/dashboard-only" element={<DashboardOnly />} />
                <Route path="/apontador-desktop" element={<ProtectedRoute><ApontadorDesktop /></ProtectedRoute>} />
                <Route path="/rdo/aprovar/:token" element={<RDOAprovacao />} />
                <Route path="/rdo/portal" element={<RDOPortal />} />
                
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/operacao/carga" element={<Carga />} />
                  <Route path="/operacao/descarga" element={<Descarga />} />
                  <Route path="/operacao/pedreira" element={<Pedreira />} />
                  <Route path="/operacao/pipas" element={<Pipas />} />
                  <Route path="/operacao/pluviometria" element={<Pluviometria />} />
                  <Route path="/operacao/cal" element={<Cal />} />
                  <Route path="/cadastros/locais" element={<Locais />} />
                  <Route path="/cadastros/materiais" element={<Materiais />} />
                  <Route path="/cadastros/materiais-pedreira" element={<MateriaisPedreira />} />
                  <Route path="/cadastros/apontadores" element={<Apontadores />} />
                  <Route path="/cadastros/fornecedores" element={<Fornecedores />} />
                  <Route path="/cadastros/fornecedores-pedreira" element={<FornecedoresPedreira />} />
                  <Route path="/cadastros/usuarios" element={<Usuarios />} />
                  <Route path="/cadastros/obra" element={<Obra />} />
                  <Route path="/cadastros/equipamentos" element={<Equipamentos />} />
                  <Route path="/cadastros/configuracao-colunas" element={<ConfiguracaoColunas />} />
                  <Route path="/cadastros/configuracao-layout" element={<ConfiguracaoLayout />} />
                  <Route path="/painel-apontador" element={<PainelApontador />} />
                  <Route path="/engenharia/rdo" element={<RDO />} />
                  <Route path="/engenharia/rdo/etapas" element={<RDOEtapas />} />
                  <Route path="/engenharia/rdo/responsaveis" element={<RDOResponsaveis />} />
                  <Route path="/engenharia/rdo/usuarios" element={<RDOUsuarios />} />
                  
                  <Route path="/engenharia/equipamentos" element={<EquipamentosMobilizacao />} />
                  <Route path="/engenharia/medicao-equipamentos" element={<MedicaoEquipamentos />} />
                  <Route path="/engenharia/retigrafico" element={<RetigraficoTopografico />} />
                  <Route path="/perfil" element={<Perfil />} />
                  <Route path="/frota" element={<Frota />} />
                  <Route path="/historico-veiculos" element={<HistoricoVeiculos />} />
                  <Route path="/sala-tecnica/relatorios" element={<Relatorios />} />
                  <Route path="/sala-tecnica/relatorio-combinado" element={<RelatorioCombinado />} />
                  <Route path="/sala-tecnica/frota-geral-obra" element={<FrotaGeralObra />} />
                  <Route path="/sala-tecnica/caminhoes-areia-express" element={<CaminhoesAreiaExpress />} />
                  <Route path="/sala-tecnica/caminhoes-herval" element={<CaminhoesHerval />} />
                  <Route path="/abastech" element={<Abastech />} />
                  <Route path="/alertas" element={<Alertas />} />
                  <Route path="/almoxarifado" element={<Almoxarifado />} />
                  <Route path="/suporte" element={<SupportInbox />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </MobileRouteWrapper>
          </OfflineSyncProvider>
          </ImpersonationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
