import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: 'super_admin' | 'manager' | 'worker' | 'super';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireRole 
}) => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Not Authorized</h1>
          <p className="text-muted-foreground">Your account is not authorized to access this application.</p>
        </div>
      </div>
    );
  }

  if (requireRole && userRole !== requireRole) {
    // Handle super_admin requirement
    if (requireRole === 'super_admin') {
      if (userRole !== 'super_admin') {
        return <Navigate to="/login" replace />;
      }
    } else if (requireRole === 'super') {
      // Check if user is a manager with super privileges
      const checkSuperUser = async () => {
        if (userRole === 'manager') {
          try {
            const { data: manager } = await supabase
              .from('managers')
              .select('is_super')
              .eq('email', user?.email)
              .single();
            
            if (!manager?.is_super) {
              return <Navigate to="/admin" replace />;
            }
          } catch (error) {
            console.error('Error checking super user status:', error);
            return <Navigate to="/admin" replace />;
          }
        } else {
          return <Navigate to="/admin" replace />;
        }
      };
      
      // For now, just redirect non-managers away from super routes
      if (userRole !== 'manager') {
        return <Navigate to="/admin" replace />;
      }
    } else if (userRole !== requireRole) {
      // Super admins can access manager and worker routes
      if (userRole === 'super_admin' && (requireRole === 'manager' || requireRole === 'worker')) {
        return <>{children}</>;
      }
      
      // Redirect based on user role
      let redirectPath = '/dashboard';
      if (userRole === 'super_admin') redirectPath = '/super-admin';
      else if (userRole === 'manager') redirectPath = '/admin';
      else if (userRole === 'worker') redirectPath = '/dashboard';
      
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
};