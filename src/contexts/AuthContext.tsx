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
  

  const getUserRole = async (email: string): Promise<'super_admin' | 'manager' | 'worker' | null> => {
    console.log('Getting role for:', email);
    
    // Check super_admins first
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    
    if (superAdmin) {
      console.log('Found super_admin');
      return 'super_admin';
    }
    
    // Check managers
    const { data: manager } = await supabase
      .from('managers')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    
    if (manager) {
      console.log('Found manager');
      return 'manager';
    }
    
    // Check workers
    const { data: worker } = await supabase
      .from('workers')
      .select('email')
      .eq('email', email)
      .maybeSingle();
    
    if (worker) {
      console.log('Found worker');
      return 'worker';
    }
    
    console.log('No role found for:', email);
    return null;
  };

  useEffect(() => {
    let isMounted = true;
    
    const checkSession = async () => {
      console.log('Checking session...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session check result:', !!session);
        
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user?.email) {
          console.log('Session found for:', session.user.email);
          const role = await getUserRole(session.user.email);
          setUserRole(role);
        } else {
          console.log('No session found');
          setUserRole(null);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setUserRole(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, !!session);
      
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user?.email) {
        console.log('New session for:', session.user.email);
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
        console.log('Session ended, clearing role');
        setUserRole(null);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

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