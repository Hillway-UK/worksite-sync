import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, Users, Briefcase, FileText, LogOut, Menu, Calendar, User, BarChart3, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { AutoTimeLogo } from '@/components/AutoTimeLogo';
import { supabase } from '@/integrations/supabase/client';

export const Navigation: React.FC = () => {
  const { userRole, signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [organizationName, setOrganizationName] = useState<string>('');

  useEffect(() => {
    const checkSuper = async () => {
      if (userRole === 'manager' && user?.email) {
        // Get manager data and organization separately to avoid join issues
        const { data: managerData } = await supabase
          .from('managers')
          .select('is_super, organization_id')
          .eq('email', user.email)
          .single();
        
        setIsSuper(managerData?.is_super || false);
        
        if (managerData?.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', managerData.organization_id)
            .single();
          
          if (orgData?.name) {
            setOrganizationName(orgData.name);
          }
        }
      }
    };
    checkSuper();
  }, [user, userRole]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  // Super Admin navigation
  if (userRole === 'super_admin') {
    return (
      <nav className="bg-black text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <AutoTimeLogo variant="light" />
              <div className="ml-8 flex space-x-8">
                <Link
                  to="/super-admin"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                    isActive('/super-admin') 
                      ? 'border-b-2 border-white text-white' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  System Admin
                </Link>
                <Link
                  to="/profile"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                    isActive('/profile') 
                      ? 'border-b-2 border-white text-white' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleSignOut}
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                <LogOut className="h-4 w-4 mr-2 inline" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Worker navigation
  if (userRole === 'worker') {
    return (
      <nav className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div 
              className="flex items-center cursor-pointer" 
              onClick={() => {
                if (user) {
                  navigate('/dashboard');
                } else {
                  navigate('/');
                }
              }}
            >
              <span className="font-bold text-xl text-black hover:text-gray-600 transition-colors">
                AutoTime
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/dashboard')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent hover:scale-105'
                }`}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/profile"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/profile')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent hover:scale-105'
                }`}
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </Link>
              <Link
                to="/amendments"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/amendments')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent hover:scale-105'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                Amendments
              </Link>
              <Link
                to="/reports"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/reports')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent hover:scale-105'
                }`}
              >
                <FileText className="h-4 w-4 mr-2" />
                Reports
              </Link>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="min-h-[44px] hover:bg-secondary/80 hover:scale-105 transition-transform duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Manager navigation
  if (userRole === 'manager') {
    return (
      <nav className="bg-black text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div 
              className="flex items-center cursor-pointer" 
              onClick={() => {
                if (user) {
                  if (userRole === 'manager') {
                    navigate('/admin');
                  } else if (userRole === 'worker') {
                    navigate('/dashboard');
                  } else {
                    navigate('/');
                  }
                } else {
                  navigate('/');
                }
              }}
            >
              <span className="font-bold text-xl text-white hover:text-gray-200 transition-colors">
                AutoTime
              </span>
              {organizationName && (
                <span className="ml-3 text-sm text-gray-300 border-l border-gray-500 pl-3">
                  {organizationName}
                </span>
              )}
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  to="/admin"
                  className={`${
                    location.pathname === '/admin' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  } px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/workers"
                  className={`${
                    location.pathname === '/admin/workers' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  } px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200`}
                >
                  Workers
                </Link>
                <Link
                  to="/admin/jobs"
                  className={`${
                    location.pathname === '/admin/jobs' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  } px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200`}
                >
                  Jobs
                </Link>
                <Link
                  to="/admin/amendments"
                  className={`${
                    location.pathname === '/admin/amendments' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  } px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200`}
                >
                  Amendments
                </Link>
                <Link
                  to="/admin/reports"
                  className={`${
                    location.pathname === '/admin/reports' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  } px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200`}
                >
                  Weekly Reports
                </Link>
                <Link
                  to="/admin/profile"
                  className={`${
                    location.pathname === '/admin/profile' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  } px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200`}
                >
                  Profile
                </Link>
                {isSuper && (
                  <Link
                    to="/organisation"
                    className={`${
                      location.pathname === '/organisation' 
                        ? 'bg-gray-700 text-white' 
                        : 'text-gray-300 hover:text-white hover:bg-gray-600'
                    } px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200`}
                  >
                    Organisation
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="text-gray-300 hover:text-white hover:bg-gray-600 px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <Button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                variant="ghost"
                size="sm"
                className="min-h-[44px] text-white hover:bg-gray-600"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 space-y-2">
              <Link
                to="/admin"
                className="text-gray-300 hover:text-white hover:bg-gray-600 block px-3 py-2 rounded-md text-base font-semibold transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/admin/workers"
                className="text-gray-300 hover:text-white hover:bg-gray-600 block px-3 py-2 rounded-md text-base font-semibold transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Workers
              </Link>
              <Link
                to="/admin/jobs"
                className="text-gray-300 hover:text-white hover:bg-gray-600 block px-3 py-2 rounded-md text-base font-semibold transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Jobs
              </Link>
              <Link
                to="/admin/amendments"
                className="text-gray-300 hover:text-white hover:bg-gray-600 block px-3 py-2 rounded-md text-base font-semibold transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Amendments
              </Link>
              <Link
                to="/admin/reports"
                className="text-gray-300 hover:text-white hover:bg-gray-600 block px-3 py-2 rounded-md text-base font-semibold transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Weekly Reports
              </Link>
              <Link
                to="/admin/profile"
                className="text-gray-300 hover:text-white hover:bg-gray-600 block px-3 py-2 rounded-md text-base font-semibold transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Profile
              </Link>
              {isSuper && (
                <Link
                  to="/organisation"
                  className="text-gray-300 hover:text-white hover:bg-gray-600 block px-3 py-2 rounded-md text-base font-semibold transition-all duration-200"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Organisation
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="text-gray-300 hover:text-white hover:bg-gray-600 block w-full text-left px-3 py-2 rounded-md text-base font-semibold transition-all duration-200"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
    );
  }

  return null;
};