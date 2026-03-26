import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface LocalPermission {
  local_id: string;
  local_nome: string;
  enabled: boolean;
}

interface LocalPermissions {
  [localId: string]: boolean;
}

export function useLocalPermissions() {
  const { user, profile, isAdmin } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const [allowedLocals, setAllowedLocals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveUserId = isImpersonating ? impersonatedUser?.user_id : user?.id;
  const effectiveType = isImpersonating ? impersonatedUser?.tipo : profile?.tipo;
  const effectiveIsAdmin = isImpersonating ? false : isAdmin;

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) {
        setAllowedLocals([]);
        setLoading(false);
        return;
      }

      if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
        const { data: allLocais } = await supabase
          .from('locais')
          .select('id')
          .eq('status', 'Ativo');
        
        setAllowedLocals(allLocais?.map(l => l.id) || []);
        setLoading(false);
        return;
      }

      try {
        const { data: allLocais, error: locaisError } = await supabase
          .from('locais')
          .select('id')
          .eq('status', 'Ativo');

        if (locaisError) throw locaisError;

        const { data: disabledPerms, error: permsError } = await supabase
          .from('user_location_permissions')
          .select('local_id')
          .eq('user_id', effectiveUserId!)
          .eq('enabled', false);

        if (permsError) throw permsError;

        const disabledIds = new Set(disabledPerms?.map(p => p.local_id) || []);
        
        // Filter to only allowed locals
        const allowed = allLocais?.filter(l => !disabledIds.has(l.id)).map(l => l.id) || [];
        setAllowedLocals(allowed);
      } catch (error) {
        console.error('Error loading local permissions:', error);
        // Default to all locais on error
        const { data: allLocais } = await supabase
          .from('locais')
          .select('id')
          .eq('status', 'Ativo');
        setAllowedLocals(allLocais?.map(l => l.id) || []);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user, effectiveUserId, effectiveIsAdmin, effectiveType, isImpersonating]);

  const hasLocalPermission = useCallback((localId: string): boolean => {
    if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
      return true;
    }
    return allowedLocals.includes(localId);
  }, [allowedLocals, effectiveIsAdmin, effectiveType, isImpersonating]);

  return {
    allowedLocals,
    loading,
    hasLocalPermission,
  };
}

// Admin hook for managing user local permissions
export function useManageLocalPermissions() {
  const [loading, setLoading] = useState(false);

  const getUserLocalPermissions = useCallback(async (userId: string): Promise<LocalPermission[]> => {
    try {
      // Get all active locais
      const { data: allLocais, error: locaisError } = await supabase
        .from('locais')
        .select('id, nome')
        .eq('status', 'Ativo')
        .order('nome');

      if (locaisError) throw locaisError;

      // Get existing permissions for this user
      const { data: perms, error: permsError } = await supabase
        .from('user_location_permissions')
        .select('local_id, enabled')
        .eq('user_id', userId);

      if (permsError) throw permsError;

      const permsMap = new Map(perms?.map(p => [p.local_id, p.enabled]) || []);

      // Build permissions list - default to enabled if no record exists
      return allLocais?.map(local => ({
        local_id: local.id,
        local_nome: local.nome,
        enabled: permsMap.has(local.id) ? permsMap.get(local.id)! : true,
      })) || [];
    } catch (error) {
      console.error('Error fetching user local permissions:', error);
      return [];
    }
  }, []);

  const setUserLocalPermissions = useCallback(async (userId: string, permissions: LocalPermissions): Promise<boolean> => {
    setLoading(true);
    try {
      // Delete existing permissions for this user
      await supabase
        .from('user_location_permissions')
        .delete()
        .eq('user_id', userId);

      // Insert new permissions (only store disabled permissions to save storage)
      const toInsert = Object.entries(permissions)
        .filter(([_, enabled]) => !enabled) // Only store disabled permissions
        .map(([local_id, enabled]) => ({
          user_id: userId,
          local_id,
          enabled,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('user_location_permissions')
          .insert(toInsert);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error setting user local permissions:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    getUserLocalPermissions,
    setUserLocalPermissions,
  };
}
