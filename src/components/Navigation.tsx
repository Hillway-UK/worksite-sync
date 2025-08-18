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
            <div className="hidden md:flex items-center space-x-4">
              <Link
                to="/admin"
                className={`px-4 py-2 rounded-md text-sm font-heading font-semibold min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/admin')
                    ? 'bg-primary/20 text-primary-foreground shadow-sm'
                    : 'text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary/20 hover:scale-105'
                }`}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/admin/profile"
                className={`px-4 py-2 rounded-md text-sm font-heading font-semibold min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/admin/profile')
                    ? 'bg-primary/20 text-primary-foreground shadow-sm'
                    : 'text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary/20 hover:scale-105'
                }`}
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </Link>
              <Link
                to="/admin/workers"
                className={`px-4 py-2 rounded-md text-sm font-heading font-semibold min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/admin/workers')
                    ? 'bg-primary/20 text-primary-foreground shadow-sm'
                    : 'text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary/20 hover:scale-105'
                }`}
              >
                <Users className="h-4 w-4 mr-2" />
                Workers
              </Link>
              <Link
                to="/admin/jobs"
                className={`px-4 py-2 rounded-md text-sm font-heading font-semibold min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/admin/jobs')
                    ? 'bg-primary/20 text-primary-foreground shadow-sm'
                    : 'text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary/20 hover:scale-105'
                }`}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Jobs
              </Link>
              <Link
                to="/admin/amendments"
                className={`px-4 py-2 rounded-md text-sm font-heading font-semibold min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/admin/amendments')
                    ? 'bg-primary/20 text-primary-foreground shadow-sm'
                    : 'text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary/20 hover:scale-105'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                Amendments
              </Link>
              <Link
                to="/admin/reports"
                className={`px-4 py-2 rounded-md text-sm font-heading font-semibold min-h-[44px] flex items-center transition-all duration-200 ease-in-out ${
                  isActive('/admin/reports')
                    ? 'bg-primary/20 text-primary-foreground shadow-sm'
                    : 'text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary/20 hover:scale-105'
                }`}
              >
                <FileText className="h-4 w-4 mr-2" />
                Weekly Reports
              </Link>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary/20 min-h-[44px] hover:scale-105 transition-all duration-200"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
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
                to="/admin"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] transition-all duration-200 ease-in-out ${
                  isActive('/admin')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/admin/profile"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] transition-all duration-200 ease-in-out ${
                  isActive('/admin/profile')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </Link>
              <Link
                to="/admin/workers"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] transition-all duration-200 ease-in-out ${
                  isActive('/admin/workers')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Users className="h-4 w-4 mr-2" />
                Workers
              </Link>
              <Link
                to="/admin/jobs"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] transition-all duration-200 ease-in-out ${
                  isActive('/admin/jobs')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Jobs
              </Link>
              <Link
                to="/admin/amendments"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] transition-all duration-200 ease-in-out ${
                  isActive('/admin/amendments')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Clock className="h-4 w-4 mr-2" />
                Amendments
              </Link>
              <Link
                to="/admin/reports"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] transition-all duration-200 ease-in-out ${
                  isActive('/admin/reports')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Weekly Reports
              </Link>
              <Button
                onClick={() => {
                  handleSignOut();
                  setIsMobileMenuOpen(false);
                }}
                variant="ghost"
                size="sm"
                className="w-full justify-start min-h-[44px] hover:bg-secondary/80"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </nav>
    );
  }

  return null;
};