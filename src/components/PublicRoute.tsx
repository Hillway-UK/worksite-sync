import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If user is authenticated, redirect to their dashboard based on role
  if (user && userRole) {
    // Get the intended destination from location state, if any
    const from = location.state?.from?.pathname;
    
    // Don't redirect if coming from a password reset flow
    if (location.pathname.includes('/reset-password') || location.pathname.includes('/update-password')) {
      return <>{children}</>;
    }

    // Redirect based on user role
    let redirectPath = '/dashboard';
    if (userRole === 'super_admin') {
      redirectPath = '/super-admin';
    } else if (userRole === 'manager') {
      redirectPath = '/admin';
    } else if (userRole === 'worker') {
      redirectPath = '/dashboard';
    }

    // If there's a specific destination they were trying to reach, use that instead
    if (from && from !== location.pathname) {
      redirectPath = from;
    }

    return <Navigate to={redirectPath} replace />;
  }

  // If user is not authenticated, show the public content
  return <>{children}</>;
};