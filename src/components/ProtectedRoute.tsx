import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: 'super_admin' | 'manager' | 'worker';
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
    // Super admins can access manager and worker routes
    if (userRole === 'super_admin' && (requireRole === 'manager' || requireRole === 'worker')) {
      return <>{children}</>;
    }
    
    // Redirect based on user role
    let redirectPath = '/dashboard';
    if (userRole === 'super_admin') redirectPath = '/organization';
    else if (userRole === 'manager') redirectPath = '/admin';
    else if (userRole === 'worker') redirectPath = '/clock';
    
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};