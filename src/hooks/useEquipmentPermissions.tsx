import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export type EquipmentType = 'escavadeira' | 'caminhao';

interface EquipmentPermission {
  equipment_prefixo: string;
  equipment_type: EquipmentType;
  enabled: boolean;
}

interface EquipmentPermissions {
  [prefixo: string]: boolean;
}

export function useEquipmentPermissions() {
  const { user, profile, isAdmin } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const [disabledEscavadeiras, setDisabledEscavadeiras] = useState<Set<string>>(new Set());
  const [disabledCaminhoes, setDisabledCaminhoes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const effectiveUserId = isImpersonating ? impersonatedUser?.user_id : user?.id;
  const effectiveType = isImpersonating ? impersonatedUser?.tipo : profile?.tipo;
  const effectiveIsAdmin = isImpersonating ? false : isAdmin;

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) {
        setDisabledEscavadeiras(new Set());
        setDisabledCaminhoes(new Set());
        setLoading(false);
        return;
      }

      if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
        setDisabledEscavadeiras(new Set());
        setDisabledCaminhoes(new Set());
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_equipment_permissions')
          .select('equipment_prefixo, equipment_type')
          .eq('user_id', effectiveUserId!)
          .eq('enabled', false);

        if (error) throw error;

        const escavadeiras = new Set<string>();
        const caminhoes = new Set<string>();
        
        data?.forEach(p => {
          if (p.equipment_type === 'escavadeira') {
            escavadeiras.add(p.equipment_prefixo);
          } else if (p.equipment_type === 'caminhao') {
            caminhoes.add(p.equipment_prefixo);
          }
        });

        setDisabledEscavadeiras(escavadeiras);
        setDisabledCaminhoes(caminhoes);
      } catch (error) {
        console.error('Error loading equipment permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user, effectiveUserId, effectiveIsAdmin, effectiveType, isImpersonating]);

  const hasEscavadeiraPermission = useCallback((prefixo: string): boolean => {
    if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
      return true;
    }
    return !disabledEscavadeiras.has(prefixo);
  }, [disabledEscavadeiras, effectiveIsAdmin, effectiveType, isImpersonating]);

  const hasCaminhaoPermission = useCallback((prefixo: string): boolean => {
    if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
      return true;
    }
    return !disabledCaminhoes.has(prefixo);
  }, [disabledCaminhoes, effectiveIsAdmin, effectiveType, isImpersonating]);

  const filterEscavadeiras = useCallback(<T extends { prefixo: string }>(items: T[]): T[] => {
    if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
      return items;
    }
    return items.filter(item => !disabledEscavadeiras.has(item.prefixo));
  }, [disabledEscavadeiras, effectiveIsAdmin, effectiveType, isImpersonating]);

  const filterCaminhoes = useCallback(<T extends { prefixo: string }>(items: T[]): T[] => {
    if (effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'))) {
      return items;
    }
    return items.filter(item => !disabledCaminhoes.has(item.prefixo));
  }, [disabledCaminhoes, effectiveIsAdmin, effectiveType, isImpersonating]);

  return {
    disabledEscavadeiras,
    disabledCaminhoes,
    loading,
    hasEscavadeiraPermission,
    hasCaminhaoPermission,
    filterEscavadeiras,
    filterCaminhoes,
  };
}

// Admin hook for managing user equipment permissions
export function useManageEquipmentPermissions() {
  const [loading, setLoading] = useState(false);

  const getUserEquipmentPermissions = useCallback(async (
    userId: string, 
    equipmentType: EquipmentType,
    allEquipment: string[]
  ): Promise<{ prefixo: string; enabled: boolean }[]> => {
    try {
      // Get disabled equipment for this user
      const { data, error } = await supabase
        .from('user_equipment_permissions')
        .select('equipment_prefixo, enabled')
        .eq('user_id', userId)
        .eq('equipment_type', equipmentType);

      if (error) throw error;

      const permsMap = new Map(data?.map(p => [p.equipment_prefixo, p.enabled]) || []);

      // Build permissions list - default to enabled if no record exists
      return allEquipment.map(prefixo => ({
        prefixo,
        enabled: permsMap.has(prefixo) ? permsMap.get(prefixo)! : true,
      }));
    } catch (error) {
      console.error('Error fetching equipment permissions:', error);
      return allEquipment.map(prefixo => ({ prefixo, enabled: true }));
    }
  }, []);

  const setUserEquipmentPermissions = useCallback(async (
    userId: string, 
    equipmentType: EquipmentType,
    permissions: EquipmentPermissions
  ): Promise<boolean> => {
    setLoading(true);
    try {
      // Delete existing permissions for this user and type
      await supabase
        .from('user_equipment_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('equipment_type', equipmentType);

      // Insert new permissions (only store disabled permissions to save storage)
      const toInsert = Object.entries(permissions)
        .filter(([_, enabled]) => !enabled)
        .map(([equipment_prefixo, enabled]) => ({
          user_id: userId,
          equipment_prefixo,
          equipment_type: equipmentType,
          enabled,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('user_equipment_permissions')
          .insert(toInsert);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error setting equipment permissions:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    getUserEquipmentPermissions,
    setUserEquipmentPermissions,
  };
}
