import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook that listens for new RDOs via Supabase Realtime
 * and triggers native browser push notifications.
 */
export function useRdoPushNotifications() {
  const { profile } = useAuth();
  const permissionGranted = useRef(false);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      permissionGranted.current = true;
      return true;
    }
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    permissionGranted.current = result === 'granted';
    return permissionGranted.current;
  }, []);

  const showNotification = useCallback((title: string, body: string, url: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Try service worker notification (works even when tab is closed/minimized)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'rdo-new-' + Date.now(),
          data: { url },
          requireInteraction: true,
        } as NotificationOptions);
      });
    } else {
      // Fallback to regular Notification API
      const notification = new Notification(title, {
        body,
        icon: '/icon-192.png',
        tag: 'rdo-new-' + Date.now(),
      });
      notification.onclick = () => {
        window.focus();
        window.location.href = url;
        notification.close();
      };
    }
  }, []);

  useEffect(() => {
    if (!profile) return;

    requestPermission();

    const channel = supabase
      .channel('rdo-push-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rdos',
        },
        (payload) => {
          const newRdo = payload.new as any;
          // Don't notify the user who created the RDO
          if (newRdo.created_by === profile.user_id) return;

          const numero = newRdo.numero_rdo || 'S/N';
          const data = newRdo.data || '';
          showNotification(
            '📋 Novo RDO Criado',
            `RDO Nº ${numero} — ${data}`,
            '/engenharia/rdo'
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rdos',
        },
        (payload) => {
          const updated = payload.new as any;
          const old = payload.old as any;

          // Notify on status change to "Aguardando Aprovação"
          if (
            updated.status === 'Aguardando Aprovação' &&
            old.status !== 'Aguardando Aprovação'
          ) {
            if (updated.created_by === profile.user_id) return;
            const numero = updated.numero_rdo || 'S/N';
            showNotification(
              '🔔 RDO Aguardando Aprovação',
              `RDO Nº ${numero} precisa de aprovação`,
              '/engenharia/rdo'
            );
          }

          // Notify on approval/rejection
          const checkApproval = (num: number) => {
            const statusKey = `aprovacao${num}_status` as string;
            if (updated[statusKey] && updated[statusKey] !== old[statusKey]) {
              const numero = updated.numero_rdo || 'S/N';
              const isApproved = updated[statusKey] === 'Aprovado';
              showNotification(
                isApproved ? '✅ RDO Aprovado' : '❌ RDO Reprovado',
                `RDO Nº ${numero} — Aprovador ${num}: ${updated[statusKey]}`,
                '/engenharia/rdo'
              );
            }
          };
          checkApproval(1);
          checkApproval(2);
          checkApproval(3);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, requestPermission, showNotification]);

  return { requestPermission };
}
