import { useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { useFieldPermissions, FieldPermissionsMap, MODULE_FIELDS } from '@/hooks/useFieldPermissions';

interface FieldWrapperProps {
  module: string;
  fieldName: string;
  children: (props: { visible: boolean; disabled: boolean }) => ReactNode;
}

/**
 * Wrapper component that checks field permissions and controls visibility/editability
 */
export function FieldWrapper({ module, fieldName, children }: FieldWrapperProps) {
  const { profile, isAdmin } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const [permissions, setPermissions] = useState({ visible: true, editable: true });
  const [loading, setLoading] = useState(true);
  const { getMyFieldPermissions } = useFieldPermissions();

  const effectiveType = isImpersonating ? impersonatedUser?.tipo : profile?.tipo;
  const effectiveIsAdmin = isImpersonating ? false : isAdmin;
  const hasFullAccess = effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'));

  useEffect(() => {
    if (hasFullAccess) {
      setPermissions({ visible: true, editable: true });
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      const perms = await getMyFieldPermissions(module);
      const fieldPerm = perms[fieldName] || { visible: true, editable: true };
      setPermissions(fieldPerm);
      setLoading(false);
    };

    loadPermissions();
  }, [module, fieldName, hasFullAccess, getMyFieldPermissions]);

  // While loading, show the field as visible but disabled
  if (loading) {
    return <>{children({ visible: true, disabled: true })}</>;
  }

  // If not visible, don't render anything
  if (!permissions.visible) {
    return null;
  }

  // Render with disabled state based on editability
  return <>{children({ visible: true, disabled: !permissions.editable })}</>;
}

/**
 * Hook to get all field permissions for a module at once
 * Returns loading state and a map of field permissions
 */
export function useFormFieldPermissions(module: string) {
  const { profile, isAdmin } = useAuth();
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const [permissions, setPermissions] = useState<FieldPermissionsMap>({});
  const [loading, setLoading] = useState(true);
  const { getMyFieldPermissions } = useFieldPermissions();

  const effectiveType = isImpersonating ? impersonatedUser?.tipo : profile?.tipo;
  const effectiveIsAdmin = isImpersonating ? false : isAdmin;
  const hasFullAccess = effectiveIsAdmin || (!isImpersonating && (effectiveType === 'Sala Técnica' || effectiveType === 'Administrador'));

  useEffect(() => {
    const loadPermissions = async () => {
      if (hasFullAccess) {
        // Set all fields to visible and editable
        const fullAccess: FieldPermissionsMap = {};
        const fields = MODULE_FIELDS[module] || [];
        fields.forEach(f => {
          fullAccess[f.name] = { visible: true, editable: true };
        });
        setPermissions(fullAccess);
        setLoading(false);
        return;
      }

      const perms = await getMyFieldPermissions(module);
      setPermissions(perms);
      setLoading(false);
    };

    loadPermissions();
  }, [module, hasFullAccess, getMyFieldPermissions]);

  const isFieldVisible = (fieldName: string): boolean => {
    const perm = permissions[fieldName];
    return perm ? perm.visible : true;
  };

  const isFieldDisabled = (fieldName: string): boolean => {
    const perm = permissions[fieldName];
    return perm ? !perm.editable : false;
  };

  return {
    loading,
    permissions,
    isFieldVisible,
    isFieldDisabled,
    hasFullAccess,
  };
}
