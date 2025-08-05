import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: 'manager' | 'worker' | null;
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
  const [userRole, setUserRole] = useState<'manager' | 'worker' | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCheckingRole, setIsCheckingRole] = useState(false);

  const checkUserRole = async (userEmail: string): Promise<'manager' | 'worker' | null> => {
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
      
      // Check manager role with timeout
      const managerCheck = supabase
        .from('managers')
        .select('*')
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
          return 'manager';
        }
      }
      
      // Check worker role with timeout
      const workerCheck = supabase
        .from('workers')
        .select('*')
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
          return 'worker';
        }
      }
      
      console.log('✗ User not found in either table');
      setUserRole(null);
      return null;
      
    } catch (error) {
      console.error('Error in checkUserRole:', error);
      setUserRole(null);
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
    setLoading(false);
  };

  const value = {
    user,
    session,
    userRole,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};