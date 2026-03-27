import { Outlet, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
// AiAssistantChat removed
const SupportChatWidget = lazy(() => import('@/components/support/SupportChatWidget'));
import logoApropriapp from '@/assets/logo-apropriapp.png';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRdoPushNotifications } from '@/hooks/useRdoPushNotifications';
import { UpdateNotification } from '@/components/mobile/UpdateNotification';
import { Loader2, Eye } from 'lucide-react';


export const AppLayout = () => {
  const { isAdmin, loading, user, isReadOnly } = useAuth();
  useRdoPushNotifications();
  

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // All authenticated users can access the desktop system when they login via /auth

  return (
    <div className="flex w-full bg-background">
      {/* Update Notification - persistent banner */}
      <UpdateNotification />
      {/* Sidebar - fixed on left */}
      <div className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:z-50">
        <AppSidebar />
      </div>
      {/* Main content area - with left margin for sidebar */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <AppHeader />
        {isReadOnly && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-center gap-2 text-sm">
            <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="font-medium text-amber-700 dark:text-amber-300">
              Modo Visualização — Acesso somente leitura
            </span>
          </div>
        )}
        <main className="flex-1 p-3 md:p-6 overflow-auto min-h-screen relative">
          <div
            className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
            style={{
              backgroundImage: `url(${logoApropriapp})`,
              backgroundSize: '300px',
              backgroundPosition: 'center',
              backgroundRepeat: 'repeat',
            }}
          />
          <div className="relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* AI Assistant removed */}

      {/* Support Chat */}
      <Suspense fallback={null}>
        <SupportChatWidget />
      </Suspense>

    </div>
  );
};
