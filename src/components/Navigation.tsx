import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, Users, Briefcase, FileText, LogOut, Menu, Calendar, User, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { PioneerLogo } from '@/components/PioneerLogo';

export const Navigation: React.FC = () => {
  const { userRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  if (userRole === 'worker') {
    return (
      <nav className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <PioneerLogo className="h-8" />
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

  if (userRole === 'manager') {
    return (
      <nav className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <PioneerLogo className="h-10" variant="light" />
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  to="/admin"
                  className={`${
                    location.pathname === '/admin' 
                      ? 'bg-[#420808]/50 text-white' 
                      : 'text-white/90 hover:text-white hover:bg-[#420808]/30'
                  } px-3 py-2 rounded-md text-sm font-heading font-semibold transition-all duration-200`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/workers"
                  className={`${
                    location.pathname === '/admin/workers' 
                      ? 'bg-[#420808]/50 text-white' 
                      : 'text-white/90 hover:text-white hover:bg-[#420808]/30'
                  } px-3 py-2 rounded-md text-sm font-heading font-semibold transition-all duration-200`}
                >
                  Workers
                </Link>
                <Link
                  to="/admin/jobs"
                  className={`${
                    location.pathname === '/admin/jobs' 
                      ? 'bg-[#420808]/50 text-white' 
                      : 'text-white/90 hover:text-white hover:bg-[#420808]/30'
                  } px-3 py-2 rounded-md text-sm font-heading font-semibold transition-all duration-200`}
                >
                  Jobs
                </Link>
                <Link
                  to="/admin/amendments"
                  className={`${
                    location.pathname === '/admin/amendments' 
                      ? 'bg-[#420808]/50 text-white' 
                      : 'text-white/90 hover:text-white hover:bg-[#420808]/30'
                  } px-3 py-2 rounded-md text-sm font-heading font-semibold transition-all duration-200`}
                >
                  Amendments
                </Link>
                <Link
                  to="/admin/reports"
                  className={`${
                    location.pathname === '/admin/reports' 
                      ? 'bg-[#420808]/50 text-white' 
                      : 'text-white/90 hover:text-white hover:bg-[#420808]/30'
                  } px-3 py-2 rounded-md text-sm font-heading font-semibold transition-all duration-200`}
                >
                  Weekly Reports
                </Link>
                <Link
                  to="/admin/profile"
                  className={`${
                    location.pathname === '/admin/profile' 
                      ? 'bg-[#420808]/50 text-white' 
                      : 'text-white/90 hover:text-white hover:bg-[#420808]/30'
                  } px-3 py-2 rounded-md text-sm font-heading font-semibold transition-all duration-200`}
                >
                  Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-white/90 hover:text-white hover:bg-[#420808]/30 px-3 py-2 rounded-md text-sm font-heading font-semibold transition-all duration-200"
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
                className="min-h-[44px]"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 space-y-2 animate-slide-in-right">
              <Link
                to="/admin/reports"
                className="text-white/90 hover:text-white hover:bg-[#420808]/30 block px-3 py-2 rounded-md text-base font-heading font-semibold transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Weekly Reports
              </Link>
              <Link
                to="/admin/profile"
                className="text-white/90 hover:text-white hover:bg-[#420808]/30 block px-3 py-2 rounded-md text-base font-heading font-semibold transition-all duration-200"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Profile
              </Link>
              <button
                onClick={handleSignOut}
                className="text-white/90 hover:text-white hover:bg-[#420808]/30 block w-full text-left px-3 py-2 rounded-md text-base font-heading font-semibold transition-all duration-200"
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