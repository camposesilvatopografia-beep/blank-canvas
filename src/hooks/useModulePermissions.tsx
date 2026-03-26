import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export type ModuleName = 'carga' | 'lancamento' | 'pedreira' | 'pipas' | 'cal';

export const MODULE_LABELS: Record<ModuleName, string> = {
  carga: 'Carga',
  lancamento: 'Lançamento',
  pedreira: 'Pedreira',
  pipas: 'Pipas',
  cal: 'CAL',
};

export const ALL_MODULES: ModuleName[] = ['carga', 'lancamento', 'pedreira', 'pipas', 'cal'];

interface ModulePermissions {
  [key: string]: boolean;
}

export function useModulePermissions() {
  const { user, profile, isAdmin } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const [permissions, setPermissions] = useState<ModulePermissions>({});
  const [loading, setLoading] = useState(true);

  // When impersonating, use impersonated user's ID and type
  const effectiveUserId = isImpersonating ? impersonatedUser?.user_id : user?.id;
  const effectiveType = isImpersonating ? impersonatedUser?.tipo : profile?.tipo;
  const effectiveIsAdmin = isImpersonating ? false : isAdmin; // When impersonating, act as the user

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) {
        setPermissions({});
        setLoading(false);
        return;
      }

      // Only bypass if NOT impersonating and is admin
      if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
        const allPerms: ModulePermissions = {};
        ALL_MODULES.forEach(m => allPerms[m] = true);
        setPermissions(allPerms);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('module, enabled')
          .eq('user_id', effectiveUserId!);

        if (error) throw error;

        // Default all modules to true, then override with stored permissions
        const perms: ModulePermissions = {};
        ALL_MODULES.forEach(m => perms[m] = true);
        
        data?.forEach((p: { module: string; enabled: boolean }) => {
          perms[p.module] = p.enabled;
        });

        setPermissions(perms);
      } catch (error) {
        console.error('Error loading permissions:', error);
        // Default to all enabled on error
        const allPerms: ModulePermissions = {};
        ALL_MODULES.forEach(m => allPerms[m] = true);
        setPermissions(allPerms);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user, effectiveUserId, effectiveIsAdmin, effectiveType, isImpersonating]);

  const hasPermission = useCallback((module: ModuleName): boolean => {
    if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
      return true;
    }
    return permissions[module] !== false;
  }, [permissions, effectiveIsAdmin, effectiveType, isImpersonating]);

  return {
    permissions,
    loading,
    hasPermission,
  };
}

// Admin hook for managing user permissions
export function useManagePermissions() {
  const [loading, setLoading] = useState(false);

  const getUserPermissions = useCallback(async (userId: string): Promise<ModulePermissions> => {
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('module, enabled')
        .eq('user_id', userId);

      if (error) throw error;

      const perms: ModulePermissions = {};
      ALL_MODULES.forEach(m => perms[m] = true); // Default all to true
      
      data?.forEach((p: { module: string; enabled: boolean }) => {
        perms[p.module] = p.enabled;
      });

      return perms;
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      const defaultPerms: ModulePermissions = {};
      ALL_MODULES.forEach(m => defaultPerms[m] = true);
      return defaultPerms;
    }
  }, []);

  const setUserPermissions = useCallback(async (userId: string, permissions: ModulePermissions): Promise<boolean> => {
    setLoading(true);
    try {
      // Delete existing permissions for this user
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId);

      // Insert new permissions (only if not all enabled - saves storage)
      const toInsert = Object.entries(permissions)
        .filter(([_, enabled]) => !enabled) // Only store disabled permissions
        .map(([module, enabled]) => ({
          user_id: userId,
          module,
          enabled,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(toInsert);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error setting user permissions:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    getUserPermissions,
    setUserPermissions,
  };
}
