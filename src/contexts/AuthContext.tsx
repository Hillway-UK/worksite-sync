import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { FirstLoginPasswordDialog } from '@/components/FirstLoginPasswordDialog';
import { ForcedPasswordUpdateModal } from '@/components/ForcedPasswordUpdateModal';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'super_admin' | 'manager' | 'worker' | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
  const [showForcedUpdateModal, setShowForcedUpdateModal] = useState(false);
  const [managerId, setManagerId] = useState<string | null>(null);
  

  // Optimized role detection using the new database function
  const getUserRole = async (email: string): Promise<'super_admin' | 'manager' | 'worker' | null> => {
    try {
      const { data, error } = await supabase.rpc('get_user_role_and_org', { user_email: email });
      
      if (error) {
        // Fallback to original approach if function fails
        const { data: superAdmin } = await supabase
          .from('super_admins')
          .select('email')
          .eq('email', email)
          .maybeSingle();
        
        if (superAdmin) return 'super_admin';
        
        const { data: manager } = await supabase
          .from('managers')
          .select('email')
          .eq('email', email)
          .maybeSingle();
        
        if (manager) return 'manager';
        
        const { data: worker } = await supabase
          .from('workers')
          .select('email')
          .eq('email', email)
          .maybeSingle();
        
        if (worker) return 'worker';
        
        return null;
      }
      
      return (data?.[0]?.role as 'super_admin' | 'manager' | 'worker') || null;
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

  // Check for password change requirement after user and role are loaded
  useEffect(() => {
    const checkPasswordChangeRequired = async () => {
      if (!user?.email || !userRole || userRole !== 'manager') {
        return;
      }

      try {
        // Get manager details to check password flags
        const { data: manager, error } = await supabase
          .from('managers')
          .select('id, must_change_password, first_login_completed')
          .eq('email', user.email)
          .single();

        if (error || !manager) return;

        setManagerId(manager.id);

        // Check if this is first login
        if (!manager.first_login_completed) {
          setShowFirstLoginModal(true);
        } else if (manager.must_change_password) {
          // Check if forced password change is required
          setShowForcedUpdateModal(true);
        }
      } catch (error) {
        console.error('Error checking password requirements:', error);
      }
    };

    checkPasswordChangeRequired();
  }, [user?.email, userRole]);

  const handlePasswordChangeSuccess = () => {
    setShowFirstLoginModal(false);
    setShowForcedUpdateModal(false);
    // Sign out and redirect to login
    signOut();
    navigate('/login');
  };

  const handleForcedUpdateSuccess = () => {
    setShowForcedUpdateModal(false);
    // Refresh the page to continue with the normal flow
    window.location.reload();
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
    requestPasswordReset,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showFirstLoginModal && managerId && (
        <FirstLoginPasswordDialog
          open={showFirstLoginModal}
          managerId={managerId}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}
      {showForcedUpdateModal && managerId && (
        <ForcedPasswordUpdateModal
          open={showForcedUpdateModal}
          managerId={managerId}
          onSuccess={handleForcedUpdateSuccess}
        />
      )}
    </AuthContext.Provider>
  );
};