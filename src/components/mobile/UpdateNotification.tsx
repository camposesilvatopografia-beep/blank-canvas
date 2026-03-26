import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, AlertTriangle } from 'lucide-react';

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        const checkForUpdates = async () => {
          try {
            await reg.update();
          } catch (error) {
            console.log('Update check failed:', error);
          }
        };

        checkForUpdates();
        const interval = setInterval(checkForUpdates, 2 * 60 * 1000);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdate(true);
              }
            });
          }
        });

        return () => clearInterval(interval);
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    // Also check via version file (for non-SW updates)
    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const stored = localStorage.getItem('app_version');
          if (stored && stored !== data.version) {
            setShowUpdate(true);
          }
          localStorage.setItem('app_version', data.version);
        }
      } catch {}
    };
    checkVersion();
    const versionInterval = setInterval(checkVersion, 3 * 60 * 1000);
    return () => clearInterval(versionInterval);
  }, []);

  // Pulse animation every 5 seconds to grab attention
  useEffect(() => {
    if (!showUpdate) return;
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, [showUpdate]);

  const handleUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Clear caches
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    setTimeout(() => window.location.reload(), 300);
  }, [registration]);

  if (!showUpdate) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999]">
      {/* Full-width persistent banner — NO close button */}
      <div
        className={`bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 shadow-2xl transition-all duration-300 ${
          pulse ? 'scale-[1.02] brightness-110' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm md:text-base">🚀 Nova versão disponível!</p>
              <p className="text-xs opacity-90">Atualize agora para ter a melhor experiência</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleUpdate}
            className="bg-white text-red-600 hover:bg-white/90 gap-1 font-bold shadow-lg animate-pulse"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar Agora
          </Button>
        </div>
      </div>
    </div>
  );
}
