import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AdminSection = 
  | 'dashboard' 
  | 'carga' 
  | 'lancamento' 
  | 'pedreira' 
  | 'pipas' 
  | 'cal' 
  | 'cadastros' 
  | 'frota' 
  | 'alertas'
  | 'engenharia';

export const ADMIN_SECTIONS: { key: AdminSection; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'carga', label: 'Carga' },
  { key: 'lancamento', label: 'Lançamento' },
  { key: 'pedreira', label: 'Pedreira' },
  { key: 'pipas', label: 'Pipas' },
  { key: 'cal', label: 'CAL' },
  { key: 'engenharia', label: 'Engenharia' },
  { key: 'frota', label: 'Frota Geral' },
  { key: 'alertas', label: 'Alertas' },
  { key: 'cadastros', label: 'Cadastros' },
];

export const ADMIN_USER_TYPES = [
  'Administrador',
  'Sala Técnica',
  'Gerencia',
  'Engenharia',
  'Almoxarifado',
  'Qualidade',
] as const;

export type AdminUserType = typeof ADMIN_USER_TYPES[number];

interface SectionPermission {
  can_view: boolean;
  can_edit: boolean;
}

export interface TypePermissions {
  [section: string]: SectionPermission;
}

// Hook for checking current user's admin permissions
export function useAdminPermissions() {
  const { user, profile, isAdmin } = useAuth();
  const [permissions, setPermissions] = useState<TypePermissions>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user || !profile) {
        setPermissions({});
        setLoading(false);
        return;
      }

      const userType = profile.tipo;

      // Administrador and main admin email always have full access
      const isMainAdmin = user.email === 'jeanallbuquerque@gmail.com';
      if (isMainAdmin || userType === 'Administrador') {
        const fullAccess: TypePermissions = {};
        ADMIN_SECTIONS.forEach(s => {
          fullAccess[s.key] = { can_view: true, can_edit: true };
        });
        setPermissions(fullAccess);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('admin_type_permissions')
          .select('section, can_view, can_edit')
          .eq('user_type', userType);

        if (error) throw error;

        const perms: TypePermissions = {};
        
        // Default all sections to false for non-admin types
        ADMIN_SECTIONS.forEach(s => {
          perms[s.key] = { can_view: false, can_edit: false };
        });

        // Override with database values
        data?.forEach((p) => {
          perms[p.section] = {
            can_view: p.can_view ?? false,
            can_edit: p.can_edit ?? false,
          };
        });

        setPermissions(perms);
      } catch (error) {
        console.error('Error loading admin permissions:', error);
        // Default to full access on error for admin users
        if (isAdmin) {
          const fullAccess: TypePermissions = {};
          ADMIN_SECTIONS.forEach(s => {
            fullAccess[s.key] = { can_view: true, can_edit: true };
          });
          setPermissions(fullAccess);
        }
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user, profile, isAdmin]);

  const canView = useCallback((section: AdminSection): boolean => {
    return permissions[section]?.can_view ?? false;
  }, [permissions]);

  const canEdit = useCallback((section: AdminSection): boolean => {
    return permissions[section]?.can_edit ?? false;
  }, [permissions]);

  return {
    permissions,
    loading,
    canView,
    canEdit,
  };
}

// Hook for managing type permissions (admin only)
export function useManageTypePermissions() {
  const [loading, setLoading] = useState(false);

  const getTypePermissions = useCallback(async (userType: string): Promise<TypePermissions> => {
    try {
      const { data, error } = await supabase
        .from('admin_type_permissions')
        .select('section, can_view, can_edit')
        .eq('user_type', userType);

      if (error) throw error;

      const perms: TypePermissions = {};
      
      // Default all sections
      ADMIN_SECTIONS.forEach(s => {
        perms[s.key] = { can_view: true, can_edit: true };
      });

      // Override with database values
      data?.forEach((p) => {
        perms[p.section] = {
          can_view: p.can_view ?? true,
          can_edit: p.can_edit ?? true,
        };
      });

      return perms;
    } catch (error) {
      console.error('Error fetching type permissions:', error);
      const defaultPerms: TypePermissions = {};
      ADMIN_SECTIONS.forEach(s => {
        defaultPerms[s.key] = { can_view: true, can_edit: true };
      });
      return defaultPerms;
    }
  }, []);

  const setTypePermissions = useCallback(async (
    userType: string, 
    permissions: TypePermissions
  ): Promise<boolean> => {
    setLoading(true);
    try {
      // Delete existing permissions for this type
      await supabase
        .from('admin_type_permissions')
        .delete()
        .eq('user_type', userType);

      // Insert new permissions
      const rows = Object.entries(permissions).map(([section, perm]) => ({
        user_type: userType,
        section,
        can_view: perm.can_view,
        can_edit: perm.can_edit,
      }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('admin_type_permissions')
          .insert(rows);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error setting type permissions:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    getTypePermissions,
    setTypePermissions,
  };
}
