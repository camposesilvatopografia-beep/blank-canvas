import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ImpersonatedUser {
  user_id: string;
  nome: string;
  email: string;
  tipo: string;
  usuario: string | null;
  avatar_url: string | null;
}

interface ImpersonationContextType {
  /** The impersonated user, or null if not impersonating */
  impersonatedUser: ImpersonatedUser | null;
  /** Start impersonating a specific user */
  setImpersonatedUser: (user: ImpersonatedUser | null) => void;
  /** Whether admin is currently impersonating someone */
  isImpersonating: boolean;
  /** The effective profile name to use in forms/reports */
  effectiveName: string;
  /** The effective profile to display */
  effectiveProfile: {
    nome: string;
    tipo: string;
    avatar_url: string | null;
    email: string;
  } | null;
  /** List of available apontadores to impersonate */
  apontadores: ImpersonatedUser[];
  /** Loading state for apontadores list */
  loadingApontadores: boolean;
  /** Whether the current user can impersonate */
  canImpersonate: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
};

const MAIN_ADMIN_EMAIL = 'jeanallbuquerque@gmail.com';

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isAdmin } = useAuth();
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [apontadores, setApontadores] = useState<ImpersonatedUser[]>([]);
  const [loadingApontadores, setLoadingApontadores] = useState(false);

  const canImpersonate = user?.email === MAIN_ADMIN_EMAIL;

  // Fetch apontadores list when admin accesses mobile
  useEffect(() => {
    if (!canImpersonate) {
      setApontadores([]);
      return;
    }

    const fetchApontadores = async () => {
      setLoadingApontadores(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, nome, email, tipo, usuario, avatar_url')
          .in('tipo', ['Apontador', 'Supervisor', 'Encarregado'])
          .eq('status', 'ativo')
          .order('nome');

        if (!error && data) {
          setApontadores(data);
        }
      } catch (err) {
        console.error('Error fetching apontadores:', err);
      } finally {
        setLoadingApontadores(false);
      }
    };

    fetchApontadores();
  }, [canImpersonate]);

  // Clear impersonation on logout
  useEffect(() => {
    if (!user) {
      setImpersonatedUser(null);
    }
  }, [user]);

  const isImpersonating = impersonatedUser !== null;

  const effectiveName = isImpersonating
    ? impersonatedUser!.nome
    : profile?.nome || '';

  const effectiveProfile = isImpersonating
    ? {
        nome: impersonatedUser!.nome,
        tipo: impersonatedUser!.tipo,
        avatar_url: impersonatedUser!.avatar_url,
        email: impersonatedUser!.email,
      }
    : profile
    ? {
        nome: profile.nome,
        tipo: profile.tipo,
        avatar_url: profile.avatar_url,
        email: profile.email,
      }
    : null;

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        setImpersonatedUser,
        isImpersonating,
        effectiveName,
        effectiveProfile,
        apontadores,
        loadingApontadores,
        canImpersonate,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};
