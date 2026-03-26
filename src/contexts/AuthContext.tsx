import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  tipo: string;
  status: string;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: 'admin' | 'apontador' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string, tipo: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isReadOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<'admin' | 'apontador' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string, userEmail?: string) => {
    try {
      const [profileResult, roleResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      const adminTypes = ['Administrador', 'Sala Técnica', 'Gerencia', 'Engenharia', 'Almoxarifado', 'Qualidade', 'Visualização'];

      // If profile doesn't exist (Google OAuth first login), auto-create from allowed_emails
      if (!profileResult.data && userEmail) {
        const { data: allowed } = await supabase
          .from('allowed_emails')
          .select('nome, tipo, email')
          .eq('email', userEmail.toLowerCase())
          .eq('status', 'ativo')
          .maybeSingle();

        if (allowed) {
          const assignedRole = adminTypes.includes(allowed.tipo) ? 'admin' : 'apontador';

          const [newProfile] = await Promise.all([
            supabase.from('profiles').insert({
              user_id: userId,
              nome: allowed.nome || userEmail.split('@')[0],
              email: allowed.email,
              tipo: allowed.tipo,
            }).select('*').maybeSingle(),
            !roleResult.data
              ? supabase.from('user_roles').insert({ user_id: userId, role: assignedRole })
              : Promise.resolve(null),
          ]);

          if (newProfile.data) setProfile(newProfile.data);
          setRole(assignedRole as 'admin' | 'apontador');
          return;
        }
      }

      // If profile exists, check if tipo matches allowed_emails and fix if needed
      if (profileResult.data && userEmail) {
        const { data: allowed } = await supabase
          .from('allowed_emails')
          .select('tipo')
          .eq('email', userEmail.toLowerCase())
          .eq('status', 'ativo')
          .maybeSingle();

        if (allowed && allowed.tipo !== profileResult.data.tipo) {
          // Fix mismatched tipo
          await supabase.from('profiles').update({ tipo: allowed.tipo }).eq('user_id', userId);
          profileResult.data.tipo = allowed.tipo;

          // Also fix role if needed
          const correctRole = adminTypes.includes(allowed.tipo) ? 'admin' : 'apontador';
          if (roleResult.data?.role !== correctRole) {
            await supabase.from('user_roles').update({ role: correctRole }).eq('user_id', userId);
            setProfile(profileResult.data);
            setRole(correctRole as 'admin' | 'apontador');
            return;
          }
        }
      }

      if (profileResult.data) setProfile(profileResult.data);
      if (roleResult.data) setRole(roleResult.data.role as 'admin' | 'apontador');
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    // INITIAL load: awaits all data before setting loading=false
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserData(session.user.id, session.user.email);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // ONGOING changes: uses setTimeout to avoid Supabase deadlock
    // Does NOT control loading state (only initializeAuth does)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => { if (mounted) fetchUserData(session.user.id, session.user.email); }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, nome: string, tipo: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) return { error };

    // Create profile and role after signup
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          nome,
          email,
          tipo,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }

      // Admin types get 'admin' role, field workers get 'apontador' role
      const adminTypes = ['Administrador', 'Sala Técnica', 'Gerencia', 'Engenharia', 'Almoxarifado', 'Qualidade', 'Visualização'];
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: adminTypes.includes(tipo) ? 'admin' : 'apontador',
        });

      if (roleError) {
        console.error('Error creating role:', roleError);
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  // Primary admin override (UX + access): ensure main admin is never treated as apontador
  const isMainAdmin = user?.email === 'jeanallbuquerque@gmail.com';
  const isAdmin = role === 'admin' || isMainAdmin;
  const isReadOnly = profile?.tipo === 'Visualização' && !isMainAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
        isReadOnly,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
