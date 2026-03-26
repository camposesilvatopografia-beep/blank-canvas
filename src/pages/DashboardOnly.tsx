import { useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { Download, Share, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

/**
 * Dashboard-only view: renders the Dashboard page without the full AppLayout sidebar.
 * Responsive for desktop and mobile, with PWA/TWA install support.
 * PUBLIC: no authentication required.
 */
export default function DashboardOnly() {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsInstalled(isStandalone);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Show install banner on mobile if not installed
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isMobile && !isStandalone) {
      setShowInstallBanner(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallBanner(false);
        toast({ title: 'App instalado!', description: 'O Dashboard foi adicionado à sua tela inicial.' });
      }
      setDeferredPrompt(null);
    }
  };

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-background">
      {/* Compact header for mobile */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b px-3 py-2 md:px-6 md:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoApropriapp} alt="ApropriAPP" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
          <h1 className="text-sm md:text-lg font-bold text-foreground truncate">Dashboard</h1>
        </div>
        {!isInstalled && showInstallBanner && deferredPrompt && (
          <Button size="sm" onClick={handleInstall} className="gap-1 text-xs h-8">
            <Download className="w-3.5 h-3.5" />
            Instalar
          </Button>
        )}
      </header>

      {/* iOS install hint */}
      {!isInstalled && showInstallBanner && isIOS && !deferredPrompt && (
        <div className="mx-3 mt-2 p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground flex items-start gap-2">
          <Share className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Para instalar, toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong></span>
          <button onClick={() => setShowInstallBanner(false)} className="ml-auto text-muted-foreground/60">✕</button>
        </div>
      )}

      {isInstalled && (
        <div className="mx-3 mt-2 p-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          App instalado
        </div>
      )}

      {/* Watermark */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `url(${logoApropriapp})`,
          backgroundSize: '300px',
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat',
        }}
      />
      {/* Dashboard content */}
      <div className="max-w-7xl mx-auto p-2 md:p-6 relative z-10">
        <Dashboard />
      </div>
    </div>
  );
}
