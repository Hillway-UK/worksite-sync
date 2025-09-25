import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: 'super_admin' | 'manager' | 'worker' | null;
  organizationId: string | null;
  organization: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'super_admin' | 'manager' | 'worker' | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  

  // Optimized role detection 
  const getUserRole = async (email: string): Promise<'super_admin' | 'manager' | 'worker' | null> => {
    try {
      // Check super_admins first
      const { data: superAdmin, error: superError } = await supabase
        .from('super_admins')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      
      if (superError) return null;
      if (superAdmin) return 'super_admin';
      
      // Check managers
      const { data: manager, error: managerError } = await supabase
        .from('managers')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      
      if (managerError) return null;
      if (manager) return 'manager';
      
      // Check workers
      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      
      if (workerError) return null;
      if (worker) return 'worker';
      
      return null;
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user?.email) {
          const role = await getUserRole(session.user.email);
          setUserRole(role);
        } else {
          setUserRole(null);
        }
      } catch (error) {
        setUserRole(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user?.email) {
        // Use setTimeout to avoid blocking the auth state change
        setTimeout(async () => {
          if (isMounted) {
            const role = await getUserRole(session.user.email!);
            if (isMounted) {
              setUserRole(role);
            }
          }
        }, 0);
      } else {
        setUserRole(null);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Load organization and organizationId based on the user's role
  useEffect(() => {
    let mounted = true;

    const loadOrg = async () => {
      try {
        if (!user?.email || !userRole) {
          if (mounted) {
            setOrganizationId(null);
            setOrganization(null);
          }
          return;
        }

        let orgId: string | null = null;

        if (userRole === 'super_admin') {
          const { data } = await supabase
            .from('super_admins')
            .select('organization_id')
            .eq('email', user.email)
            .maybeSingle();
          orgId = (data as any)?.organization_id ?? null;
        } else if (userRole === 'manager') {
          const { data } = await supabase
            .from('managers')
            .select('organization_id')
            .eq('email', user.email)
            .maybeSingle();
          orgId = (data as any)?.organization_id ?? null;
        } else if (userRole === 'worker') {
          const { data } = await supabase
            .from('workers')
            .select('organization_id')
            .eq('email', user.email)
            .maybeSingle();
          orgId = (data as any)?.organization_id ?? null;
        }

        if (!mounted) return;
        setOrganizationId(orgId);

        if (orgId) {
          const { data: org } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .maybeSingle();
          if (!mounted) return;
          setOrganization(org || null);
        } else {
          setOrganization(null);
        }
      } catch (e) {
        if (!mounted) return;
        setOrganizationId(null);
        setOrganization(null);
      }
    };

    loadOrg();

    return () => {
      mounted = false;
    };
  }, [user?.email, userRole]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    setOrganizationId(null);
    setOrganization(null);
    setLoading(false);
  };

  const value = {
    user,
    session,
    userRole,
    organizationId,
    organization,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};