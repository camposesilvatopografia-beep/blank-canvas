import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';

// All submenu keys matching mobile menu structure
export const ALL_SUBMENUS: { key: string; label: string; module: string }[] = [
  // Apropriação
  { key: 'carga_form', label: 'Carga', module: 'apropriacao' },
  { key: 'lancamento_form', label: 'Lançamento', module: 'apropriacao' },
  { key: 'apropriacao_report', label: 'Relatório (Apropriação)', module: 'apropriacao' },
  { key: 'apropriacao_registros', label: 'Registros (Apropriação)', module: 'apropriacao' },
  // Pedreira
  { key: 'pedreira_form', label: 'Apontar Carregamento', module: 'pedreira' },
  { key: 'pedreira_ciclo', label: 'Apontar Ciclo', module: 'pedreira' },
  { key: 'pedreira_ciclo_britador', label: 'Ciclo - Britador', module: 'pedreira' },
  { key: 'pedreira_ciclo_balanca', label: 'Ciclo - Balança', module: 'pedreira' },
  { key: 'pedreira_ciclo_obra', label: 'Ciclo - Obra', module: 'pedreira' },
  { key: 'pedreira_report', label: 'Relatório (Pedreira)', module: 'pedreira' },
  { key: 'pedreira_registros', label: 'Registros (Pedreira)', module: 'pedreira' },
  // Pipas
  { key: 'pipas_form', label: 'Apontar Viagens', module: 'pipas' },
  { key: 'pipas_report', label: 'Relatório (Pipas)', module: 'pipas' },
  { key: 'pipas_registros', label: 'Registros (Pipas)', module: 'pipas' },
  // Cal
  { key: 'cal_entrada_form', label: 'Registrar Entrada', module: 'cal' },
  { key: 'cal_form', label: 'Registrar Mov. Simples', module: 'cal' },
  { key: 'cal_report', label: 'Relatório (Cal)', module: 'cal' },
  { key: 'cal_registros', label: 'Registros (Cal)', module: 'cal' },
];

export const SUBMENU_MODULES = ['apropriacao', 'pedreira', 'pipas', 'cal'] as const;

export const MODULE_LABELS_SUBMENU: Record<string, string> = {
  apropriacao: 'Apropriação',
  pedreira: 'Pedreira',
  pipas: 'Pipas',
  cal: 'Cal',
};

interface SubmenuPermissions {
  [key: string]: boolean;
}

// Hook for mobile to check submenu permissions
export function useSubmenuPermissions() {
  const { user, profile, isAdmin } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const [permissions, setPermissions] = useState<SubmenuPermissions>({});
  const [loading, setLoading] = useState(true);

  const effectiveUserId = isImpersonating ? impersonatedUser?.user_id : user?.id;
  const effectiveType = isImpersonating ? impersonatedUser?.tipo : profile?.tipo;
  const effectiveIsAdmin = isImpersonating ? false : isAdmin;

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setPermissions({});
        setLoading(false);
        return;
      }

      // Only bypass if NOT impersonating and is admin
      if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
        const all: SubmenuPermissions = {};
        ALL_SUBMENUS.forEach(s => all[s.key] = true);
        setPermissions(all);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_submenu_permissions')
          .select('submenu_key, enabled')
          .eq('user_id', effectiveUserId!);

        if (error) throw error;

        // Default all to true
        const perms: SubmenuPermissions = {};
        ALL_SUBMENUS.forEach(s => perms[s.key] = true);

        // Override with stored
        data?.forEach((p: { submenu_key: string; enabled: boolean }) => {
          perms[p.submenu_key] = p.enabled;
        });

        setPermissions(perms);
      } catch (error) {
        console.error('Error loading submenu permissions:', error);
        const all: SubmenuPermissions = {};
        ALL_SUBMENUS.forEach(s => all[s.key] = true);
        setPermissions(all);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, effectiveUserId, effectiveIsAdmin, effectiveType, isImpersonating]);

  const hasSubmenuPermission = useCallback((submenuKey: string): boolean => {
    if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) return true;
    return permissions[submenuKey] !== false;
  }, [permissions, effectiveIsAdmin, effectiveType, isImpersonating]);

  return { permissions, loading, hasSubmenuPermission };
}

// Admin hook for managing submenu permissions
export function useManageSubmenuPermissions() {
  const getUserSubmenuPermissions = useCallback(async (userId: string): Promise<SubmenuPermissions> => {
    try {
      const { data, error } = await supabase
        .from('user_submenu_permissions')
        .select('submenu_key, enabled')
        .eq('user_id', userId);

      if (error) throw error;

      const perms: SubmenuPermissions = {};
      ALL_SUBMENUS.forEach(s => perms[s.key] = true);

      data?.forEach((p: { submenu_key: string; enabled: boolean }) => {
        perms[p.submenu_key] = p.enabled;
      });

      return perms;
    } catch (error) {
      console.error('Error fetching submenu permissions:', error);
      const def: SubmenuPermissions = {};
      ALL_SUBMENUS.forEach(s => def[s.key] = true);
      return def;
    }
  }, []);

  const setUserSubmenuPermissions = useCallback(async (userId: string, permissions: SubmenuPermissions): Promise<boolean> => {
    try {
      await supabase
        .from('user_submenu_permissions')
        .delete()
        .eq('user_id', userId);

      const rows = Object.entries(permissions)
        .filter(([_, enabled]) => !enabled)
        .map(([submenu_key, enabled]) => ({
          user_id: userId,
          submenu_key,
          enabled,
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('user_submenu_permissions')
          .insert(rows);
        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error setting submenu permissions:', error);
      return false;
    }
  }, []);

  return { getUserSubmenuPermissions, setUserSubmenuPermissions };
}
