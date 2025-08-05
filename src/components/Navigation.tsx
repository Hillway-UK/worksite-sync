import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Clock, Users, Briefcase, FileText, LogOut, Menu, Calendar, User, BarChart3 } from 'lucide-react';
import { useState } from 'react';

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
      <nav className="bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Clock className="h-6 w-6 text-primary mr-2" />
              <span className="font-bold text-lg">Time Keeper</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center ${
                  isActive('/dashboard')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/profile"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center ${
                  isActive('/profile')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </Link>
              <Link
                to="/amendments"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center ${
                  isActive('/amendments')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                Amendments
              </Link>
              <Link
                to="/reports"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center ${
                  isActive('/reports')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <FileText className="h-4 w-4 mr-2" />
                Reports
              </Link>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
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
      <nav className="bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Briefcase className="h-6 w-6 text-primary mr-2" />
              <span className="font-bold text-lg">Time Keeper Admin</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <Link
                to="/admin"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center ${
                  isActive('/admin')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/admin/workers"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center ${
                  isActive('/admin/workers')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Users className="h-4 w-4 mr-2" />
                Workers
              </Link>
              <Link
                to="/admin/jobs"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center ${
                  isActive('/admin/jobs')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Jobs
              </Link>
              <Link
                to="/admin/amendments"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center ${
                  isActive('/admin/amendments')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                Amendments
              </Link>
              <Link
                to="/admin/reports"
                className={`px-4 py-2 rounded-md text-sm font-medium min-h-[44px] flex items-center ${
                  isActive('/admin/reports')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <FileText className="h-4 w-4 mr-2" />
                Weekly Reports
              </Link>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="min-h-[44px]"
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
            <div className="md:hidden py-4 space-y-2">
              <Link
                to="/admin"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] ${
                  isActive('/admin')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
              <Link
                to="/admin/workers"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] ${
                  isActive('/admin/workers')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Users className="h-4 w-4 mr-2" />
                Workers
              </Link>
              <Link
                to="/admin/jobs"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] ${
                  isActive('/admin/jobs')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Jobs
              </Link>
              <Link
                to="/admin/amendments"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] ${
                  isActive('/admin/amendments')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Clock className="h-4 w-4 mr-2" />
                Amendments
              </Link>
              <Link
                to="/admin/reports"
                className={`flex items-center px-4 py-3 rounded-md text-sm font-medium min-h-[44px] ${
                  isActive('/admin/reports')
                    ? 'bg-primary text-primary-foreground'
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
                className="w-full justify-start min-h-[44px]"
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