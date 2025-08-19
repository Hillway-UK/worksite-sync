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
  const [isCheckingRole, setIsCheckingRole] = useState(false);

  const checkUserRole = async (userEmail: string): Promise<'super_admin' | 'manager' | 'worker' | null> => {
    if (isCheckingRole) {
      console.log('Role check already in progress, skipping');
      return userRole;
    }

    setIsCheckingRole(true);
    
    try {
      console.log('=== CHECKING USER ROLE ===');
      console.log('Email to check:', userEmail);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Role check timeout')), 10000);
      });
      
      // Check super admin role first
      const superAdminCheck = supabase
        .from('super_admins')
        .select('*, organizations(*)')
        .eq('email', userEmail)
        .maybeSingle();
      
      const superAdminResult = await Promise.race([superAdminCheck, timeoutPromise]);
      
      if (superAdminResult && typeof superAdminResult === 'object' && 'data' in superAdminResult) {
        const { data: superAdminData, error: superAdminError } = superAdminResult;
        
        console.log('Super admin query result:', { 
          found: !!superAdminData, 
          error: superAdminError 
        });
        
        if (superAdminData && !superAdminError) {
          console.log('✓ User is a SUPER ADMIN');
          setUserRole('super_admin');
          setOrganizationId(superAdminData.organization_id);
          setOrganization(superAdminData.organizations);
          return 'super_admin';
        }
      }
      
      // Check manager role with timeout
      const managerCheck = supabase
        .from('managers')
        .select('*, organizations(*)')
        .eq('email', userEmail)
        .maybeSingle();
      
      const managerResult = await Promise.race([managerCheck, timeoutPromise]);
      
      if (managerResult && typeof managerResult === 'object' && 'data' in managerResult) {
        const { data: managerData, error: managerError } = managerResult;
        
        console.log('Manager query result:', { 
          found: !!managerData, 
          error: managerError 
        });
        
        if (managerData && !managerError) {
          console.log('✓ User is a MANAGER');
          setUserRole('manager');
          setOrganizationId(managerData.organization_id);
          setOrganization(managerData.organizations);
          return 'manager';
        }
      }
      
      // Check worker role with timeout
      const workerCheck = supabase
        .from('workers')
        .select('*, organizations(*)')
        .eq('email', userEmail)
        .maybeSingle();
      
      const workerResult = await Promise.race([workerCheck, timeoutPromise]);
      
      if (workerResult && typeof workerResult === 'object' && 'data' in workerResult) {
        const { data: workerData, error: workerError } = workerResult;
        
        console.log('Worker query result:', { 
          found: !!workerData, 
          error: workerError 
        });
        
        if (workerData && !workerError) {
          console.log('✓ User is a WORKER');
          setUserRole('worker');
          setOrganizationId(workerData.organization_id);
          setOrganization(workerData.organizations);
          return 'worker';
        }
      }
      
      console.log('✗ User not found in any table');
      setUserRole(null);
      setOrganizationId(null);
      setOrganization(null);
      return null;
      
    } catch (error) {
      console.error('Error in checkUserRole:', error);
      setUserRole(null);
      setOrganizationId(null);
      setOrganization(null);
      return null;
    } finally {
      setIsCheckingRole(false);
    }
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
          await checkUserRole(session.user.email);
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
        setTimeout(() => {
          if (isMounted) {
            checkUserRole(session.user.email!);
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
  }, [isCheckingRole]);

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