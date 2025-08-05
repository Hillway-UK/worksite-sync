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

  const checkUserRole = async (userEmail: string) => {
    try {
      console.log('=== CHECKING USER ROLE ===');
      console.log('Email to check:', userEmail);
      
      // Check if user is a manager first
      console.log('Checking managers table...');
      const { data: managerData, error: managerError } = await supabase
        .from('managers')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();
      
      console.log('Manager query result:', { 
        found: !!managerData, 
        data: managerData, 
        error: managerError 
      });
      
      if (managerError) {
        console.error('Manager query error:', managerError);
        // Don't return here, continue to worker check
      }
      
      if (managerData) {
        console.log('✓ User is a MANAGER');
        setUserRole('manager');
        return 'manager';
      }
      
      // Check if user is a worker
      console.log('Checking workers table...');
      const { data: workerData, error: workerError } = await supabase
        .from('workers')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();
        
      console.log('Worker query result:', { 
        found: !!workerData, 
        data: workerData, 
        error: workerError 
      });
      
      if (workerError) {
        console.error('Worker query error:', workerError);
      }
      
      if (workerData) {
        console.log('✓ User is a WORKER');
        setUserRole('worker');
        return 'worker';
      }
      
      console.log('✗ User not found in either table');
      setUserRole(null);
      return null;
      
    } catch (error) {
      console.error('Error in checkUserRole:', error);
      setUserRole(null);
      return null;
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      console.log('Checking session...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session check result:', !!session);
        setSession(session);
        setUser(session?.user || null);
        
        if (session?.user) {
          console.log('Session found for:', session.user.email);
          await checkUserRole(session.user.email!);
        } else {
          console.log('No session found');
          setUserRole(null);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session);
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user) {
        console.log('New session for:', session.user.email);
        // Don't set loading here to avoid infinite loops
        await checkUserRole(session.user.email!);
      } else {
        console.log('Session ended, clearing role');
        setUserRole(null);
      }
    });

    return () => {
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