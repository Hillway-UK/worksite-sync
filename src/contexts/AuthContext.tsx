import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query-client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: 'super_admin' | 'manager' | 'worker' | null;
  organizationId: string | null;
  organization: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
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
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Cached user role and organization query
  const { data: userRoleData, isLoading: roleLoading } = useQuery({
    queryKey: queryKeys.auth.userRole(user?.email || ''),
    queryFn: async () => {
      if (!user?.email) {
        console.log('AuthContext: No user email available for role query');
        return null;
      }
      
      console.log('AuthContext: Fetching role for user:', user.email);
      
      try {
        const { data, error } = await supabase.rpc('get_user_role_and_org', { user_email: user.email });
        
        if (error) {
          console.log('AuthContext: RPC function failed, using fallback approach:', error.message);
          // Fallback to original approach if function fails
          const { data: superAdmin } = await supabase
            .from('super_admins')
            .select('email, organization_id')
            .eq('email', user.email)
            .maybeSingle();
          
          if (superAdmin) {
            console.log('AuthContext: Found super_admin role');
            return { role: 'super_admin', organization_id: superAdmin.organization_id };
          }
          
          const { data: manager } = await supabase
            .from('managers')
            .select('email, organization_id')
            .eq('email', user.email)
            .maybeSingle();
          
          if (manager) {
            console.log('AuthContext: Found manager role');
            return { role: 'manager', organization_id: manager.organization_id };
          }
          
          const { data: worker } = await supabase
            .from('workers')
            .select('email, organization_id')
            .eq('email', user.email)
            .maybeSingle();
          
          if (worker) {
            console.log('AuthContext: Found worker role');
            return { role: 'worker', organization_id: worker.organization_id };
          }
          
          console.log('AuthContext: No role found for user');
          return null;
        }
        
        const roleData = data?.[0];
        if (roleData) {
          console.log('AuthContext: RPC returned role:', roleData.role);
          return {
            role: roleData.role as 'super_admin' | 'manager' | 'worker',
            organization_id: roleData.organization_id
          };
        } else {
          console.log('AuthContext: RPC returned no role data');
          return null;
        }
      } catch (error) {
        console.error('AuthContext: Role query failed:', error);
        return null;
      }
    },
    enabled: !!user?.email,
    staleTime: 15 * 60 * 1000, // 15 minutes - user roles rarely change
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  // Cached organization data query
  const { data: organization } = useQuery({
    queryKey: queryKeys.organizations.detail(userRoleData?.organization_id || ''),
    queryFn: async () => {
      if (!userRoleData?.organization_id) return null;
      
      const { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userRoleData.organization_id)
        .maybeSingle();
      
      if (error) throw error;
      return org;
    },
    enabled: !!userRoleData?.organization_id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Derived values from cached data
  const userRole = (userRoleData?.role as 'super_admin' | 'manager' | 'worker') || null;
  const organizationId = userRoleData?.organization_id || null;

  useEffect(() => {
    let isMounted = true;
    
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user || null);
      } catch (error) {
        console.error('Error checking session:', error);
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
      
      // Clear cached user data when signing out
      if (event === 'SIGNED_OUT') {
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.userRole('') });
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all() });
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [queryClient]);

  // Overall loading state includes role loading
  const isLoadingAuth = loading || roleLoading;

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('AuthContext: Starting signIn for:', email);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('AuthContext: signIn error:', error.message);
        return { error: error.message };
      }

      console.log('AuthContext: signIn successful');
      return {};
    } catch (error) {
      console.error('AuthContext: signIn unexpected error:', error);
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
    // Clear all cached queries on sign out
    queryClient.clear();
    setLoading(false);
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value = {
    user,
    session,
    userRole,
    organizationId,
    organization,
    loading: isLoadingAuth,
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};