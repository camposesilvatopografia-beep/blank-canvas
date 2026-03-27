import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Share, Smartphone, CheckCircle2, Copy, ExternalLink, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import logoApropriapp from '@/assets/logo-apropriapp.png';

export default function InstallApp() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const appUrl = window.location.origin + '/mobile';

  useEffect(() => {
    // Detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        toast({ title: 'App instalado!', description: 'O ApropriAPP foi adicionado à sua tela inicial.' });
      }
      setDeferredPrompt(null);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(appUrl);
    toast({ title: 'Link copiado!', description: 'Compartilhe com os apontadores.' });
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ApropriAPP - App Mobile',
          text: 'Instale o ApropriAPP para apontamento em campo',
          url: appUrl,
        });
      } catch (err) {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const goToApp = () => {
    navigate('/mobile/auth');
  };

  return (
    <div className="min-h-screen bg-[#111827] flex flex-col items-center justify-center p-4">
      {/* Logo and Title */}
      <div className="text-center mb-10">
        <div className="w-28 h-28 bg-[#1f2937] rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/10 overflow-hidden">
          <img src={logoApropriapp} alt="ApropriAPP" className="w-20 h-20 object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">ApropriAPP Mobile</h1>
        <p className="text-gray-400 max-w-xs mx-auto">
          Instale o aplicativo oficial para realizar apontamentos em campo, mesmo sem internet.
        </p>
      </div>

      {/* Main Card */}
      <Card className="bg-white/10 backdrop-blur-lg border-white/20 p-6 max-w-md w-full">
        {isInstalled ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">App Instalado!</h2>
            <p className="text-white/60 mb-6">O ApropriAPP já está na sua tela inicial.</p>
            <Button onClick={goToApp} className="w-full h-12 text-lg gap-2 bg-amber-500 hover:bg-amber-600">
              Abrir App
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <>
            {/* Install Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Instalar Aplicativo
              </h2>

              {deferredPrompt ? (
                <Button onClick={handleInstall} className="w-full h-12 text-lg gap-2 bg-green-500 hover:bg-green-600">
                  <Download className="w-5 h-5" />
                  Instalar Agora
                </Button>
              ) : (
                <div className="space-y-4">
                  {isIOS && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                        <span>📱</span> iPhone / iPad
                      </h3>
                      <ol className="text-white/70 text-sm space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                          <span>Toque no botão <Share className="w-4 h-4 inline" /> na barra do navegador</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                          <span>Role e toque em "Adicionar à Tela de Início"</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                          <span>Toque em "Adicionar" para confirmar</span>
                        </li>
                      </ol>
                    </div>
                  )}

                  {isAndroid && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                        <span>🤖</span> Android
                      </h3>
                      <ol className="text-white/70 text-sm space-y-2">
                        <li className="flex items-start gap-2">
                          <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">1</span>
                          <span>Toque no menu ⋮ no canto superior direito</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">2</span>
                          <span>Selecione "Instalar aplicativo" ou "Adicionar à tela inicial"</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">3</span>
                          <span>Confirme a instalação</span>
                        </li>
                      </ol>
                    </div>
                  )}

                  {!isIOS && !isAndroid && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <p className="text-white/70 text-sm text-center">
                        Acesse este link no seu celular para instalar o app.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Continue Without Installing */}
            <Button 
              variant="outline" 
              onClick={goToApp} 
              className="w-full h-12 gap-2 border-white/20 text-white hover:bg-white/10"
            >
              <ExternalLink className="w-4 h-4" />
              Continuar no Navegador
            </Button>
          </>
        )}
      </Card>

      {/* Share Section */}
      <Card className="bg-white/5 backdrop-blur-lg border-white/10 p-4 max-w-md w-full mt-4">
        <p className="text-white/60 text-sm mb-3 text-center">Compartilhe com sua equipe:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={appUrl}
            readOnly
            className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <Button variant="outline" size="icon" onClick={copyLink} className="border-white/20 text-white hover:bg-white/10">
            <Copy className="w-4 h-4" />
          </Button>
          <Button onClick={shareLink} className="gap-2 bg-green-500 hover:bg-green-600">
            <Share className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Footer */}
      <p className="text-white/40 text-xs mt-8">
        © 2026 ApropriAPP - Gestão Inteligente
      </p>
    </div>
  );
}
