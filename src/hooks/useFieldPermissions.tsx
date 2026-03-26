import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/contexts/ImpersonationContext';

// Define all fields for each module
export const MODULE_FIELDS: { [module: string]: { name: string; label: string }[] } = {
  carga: [
    { name: 'data', label: 'Data' },
    { name: 'hora', label: 'Hora' },
    { name: 'veiculo', label: 'Veículo' },
    { name: 'equipamento', label: 'Equipamento' },
    { name: 'material', label: 'Material' },
    { name: 'local', label: 'Local' },
    { name: 'volume', label: 'Volume' },
    { name: 'viagens', label: 'Nº de Viagens' },
  ],
  lancamento: [
    { name: 'data', label: 'Data' },
    { name: 'hora', label: 'Hora' },
    { name: 'veiculo', label: 'Veículo' },
    { name: 'material', label: 'Material' },
    { name: 'local', label: 'Local' },
    { name: 'volume', label: 'Volume' },
    { name: 'viagens', label: 'Nº de Viagens' },
  ],
  pedreira: [
    { name: 'data', label: 'Data' },
    { name: 'hora', label: 'Hora' },
    { name: 'veiculo', label: 'Veículo' },
    { name: 'material', label: 'Material' },
    { name: 'peso_bruto', label: 'Peso Bruto' },
    { name: 'peso_liquido', label: 'Peso Líquido' },
    { name: 'valor_frete', label: 'Valor Frete' },
  ],
  pipas: [
    { name: 'data', label: 'Data' },
    { name: 'veiculo', label: 'Veículo' },
    { name: 'hora_chegada', label: 'Hora Chegada' },
    { name: 'hora_saida', label: 'Hora Saída' },
    { name: 'viagens', label: 'Nº de Viagens' },
  ],
  cal: [
    { name: 'data', label: 'Data' },
    { name: 'hora', label: 'Hora' },
    { name: 'tipo', label: 'Tipo (Entrada/Saída)' },
    { name: 'fornecedor', label: 'Fornecedor' },
    { name: 'quantidade', label: 'Quantidade' },
    { name: 'nota_fiscal', label: 'Nota Fiscal' },
    { name: 'valor', label: 'Valor' },
    { name: 'frete', label: 'Frete' },
  ],
  pedreira_ciclo: [
    { name: 'hora_saida_britador', label: 'Hora de Saída (Britador)' },
    { name: 'veiculo_britador', label: 'Veículo (Britador)' },
    { name: 'hora_chegada_balanca', label: 'Hora Chegada (Balança)' },
    { name: 'hora_saida_balanca', label: 'Hora Saída (Balança)' },
    { name: 'material_balanca', label: 'Material (Balança)' },
    { name: 'peso_vazio', label: 'Peso Vazio (Balança)' },
    { name: 'peso_final', label: 'Peso Final (Balança)' },
    { name: 'hora_chegada_obra', label: 'Hora Chegada (Obra)' },
  ],
};

export interface FieldPermission {
  field_name: string;
  visible: boolean;
  editable: boolean;
}

export interface FieldPermissionsMap {
  [fieldName: string]: { visible: boolean; editable: boolean };
}

export function useManageFieldPermissions() {
  // Get field permissions for a user and module
  const getUserFieldPermissions = useCallback(async (
    userId: string, 
    module: string
  ): Promise<FieldPermissionsMap> => {
    try {
      const { data, error } = await supabase
        .from('user_field_permissions')
        .select('field_name, visible, editable')
        .eq('user_id', userId)
        .eq('module', module);

      if (error) throw error;

      // Build map with defaults (all visible/editable if not specified)
      const permsMap: FieldPermissionsMap = {};
      
      // Start with defaults (all visible and editable)
      const moduleFields = MODULE_FIELDS[module] || [];
      moduleFields.forEach(f => {
        permsMap[f.name] = { visible: true, editable: true };
      });

      // Override with saved permissions
      (data || []).forEach((p: any) => {
        permsMap[p.field_name] = { 
          visible: p.visible ?? true, 
          editable: p.editable ?? true 
        };
      });

      return permsMap;
    } catch (error) {
      console.error('Error fetching field permissions:', error);
      // Return all visible/editable as default
      const defaultMap: FieldPermissionsMap = {};
      const moduleFields = MODULE_FIELDS[module] || [];
      moduleFields.forEach(f => {
        defaultMap[f.name] = { visible: true, editable: true };
      });
      return defaultMap;
    }
  }, []);

  // Set field permissions for a user and module
  const setUserFieldPermissions = useCallback(async (
    userId: string,
    module: string,
    permissions: FieldPermissionsMap
  ): Promise<boolean> => {
    try {
      // Delete existing permissions for this user/module
      await supabase
        .from('user_field_permissions')
        .delete()
        .eq('user_id', userId)
        .eq('module', module);

      // Insert new permissions (only non-default ones to save space)
      const rows = Object.entries(permissions)
        .filter(([_, perm]) => !perm.visible || !perm.editable) // Only save if not default
        .map(([fieldName, perm]) => ({
          user_id: userId,
          module,
          field_name: fieldName,
          visible: perm.visible,
          editable: perm.editable,
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('user_field_permissions')
          .insert(rows);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error setting field permissions:', error);
      return false;
    }
  }, []);

  return {
    getUserFieldPermissions,
    setUserFieldPermissions,
    MODULE_FIELDS,
  };
}

// Hook for mobile forms to check field visibility/editability
export function useFieldPermissions() {
  const { isImpersonating, impersonatedUser } = useImpersonation();

  const checkFieldPermission = useCallback(async (
    userId: string,
    module: string,
    fieldName: string
  ): Promise<{ visible: boolean; editable: boolean }> => {
    try {
      const effectiveId = isImpersonating ? impersonatedUser?.user_id : userId;
      const { data, error } = await supabase
        .from('user_field_permissions')
        .select('visible, editable')
        .eq('user_id', effectiveId!)
        .eq('module', module)
        .eq('field_name', fieldName)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { visible: true, editable: true };
      return { visible: data.visible ?? true, editable: data.editable ?? true };
    } catch (error) {
      console.error('Error checking field permission:', error);
      return { visible: true, editable: true };
    }
  }, [isImpersonating, impersonatedUser]);

  const getMyFieldPermissions = useCallback(async (
    module: string
  ): Promise<FieldPermissionsMap> => {
    try {
      let userId: string;
      if (isImpersonating && impersonatedUser?.user_id) {
        userId = impersonatedUser.user_id;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('User not authenticated');
        userId = userData.user.id;
      }

      const { data, error } = await supabase
        .from('user_field_permissions')
        .select('field_name, visible, editable')
        .eq('user_id', userId)
        .eq('module', module);

      if (error) throw error;

      // Build map with defaults
      const permsMap: FieldPermissionsMap = {};
      const moduleFields = MODULE_FIELDS[module] || [];
      moduleFields.forEach(f => {
        permsMap[f.name] = { visible: true, editable: true };
      });

      // Override with saved permissions
      (data || []).forEach((p: any) => {
        permsMap[p.field_name] = { 
          visible: p.visible ?? true, 
          editable: p.editable ?? true 
        };
      });

      return permsMap;
    } catch (error) {
      console.error('Error fetching my field permissions:', error);
      const defaultMap: FieldPermissionsMap = {};
      const moduleFields = MODULE_FIELDS[module] || [];
      moduleFields.forEach(f => {
        defaultMap[f.name] = { visible: true, editable: true };
      });
      return defaultMap;
    }
  }, []);

  return {
    checkFieldPermission,
    getMyFieldPermissions,
    MODULE_FIELDS,
  };
}
