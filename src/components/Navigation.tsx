import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut, LayoutDashboard, Users, Briefcase, Clock, FileText, User, Settings, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkerNotifications } from '@/components/WorkerNotifications';

export const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, organization } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [workerId, setWorkerId] = useState<string | null>(null);

  // Fetch workerId only for workers (needed for notifications)
  useEffect(() => {
    const fetchWorkerId = async () => {
      if (!user?.email || userRole !== 'worker') return;
      
      try {
        const { data: worker } = await supabase
          .from('workers')
          .select('id')
          .eq('email', user.email)
          .single();
        
        if (worker) {
          setWorkerId(worker.id);
        }
      } catch (error) {
        console.error('Error fetching worker ID:', error);
      }
    };

    fetchWorkerId();
  }, [user?.email, userRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleLogoClick = () => {
    if (!user) {
      navigate('/');
    } else if (userRole === 'super_admin') {
      navigate('/super-admin');
    } else if (userRole === 'manager') {
      navigate('/admin');
    } else if (userRole === 'worker') {
      navigate('/clock');
    }
  };

  // Don't show navigation on landing/marketing pages
  if (!user) return null;

  return (
    <nav className="bg-black shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Organization */}
          <div 
            className="flex items-center cursor-pointer" 
            onClick={handleLogoClick}
          >
            {organization?.logo_url ? (
              <img 
                src={organization.logo_url} 
                alt={organization.name || 'Organization logo'}
                className="h-10 w-auto max-w-[120px] object-contain mr-3"
              />
            ) : organization?.name ? (
              <span className="text-sm text-gray-300 font-medium mr-3">
                {organization.name}
              </span>
            ) : null}
            
            <span className="font-bold text-xl text-white hover:text-gray-200">
              AutoTime
            </span>
          </div>

          {/* Desktop Navigation */}
          {userRole === 'super_admin' && (
            <div className="hidden md:flex items-center space-x-2">
              <Button
                variant={location.pathname === '/super-admin' ? 'secondary' : 'ghost'}
                onClick={() => navigate('/super-admin')}
                className={location.pathname === '/super-admin' ? 'text-black hover:text-white hover:bg-gray-700' : 'text-white hover:text-white hover:bg-gray-800'}
              >
                <Building className="mr-2 h-4 w-4" />
                Organizations
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-white hover:bg-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          )}

          {userRole === 'manager' && (
            <div className="hidden md:flex items-center space-x-2">
              <Button
                variant={location.pathname === '/admin' ? 'secondary' : 'ghost'}
                onClick={() => navigate('/admin')}
                className={location.pathname === '/admin' ? 'text-black hover:text-white hover:bg-gray-700' : 'text-white hover:text-white hover:bg-gray-800'}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
              <Button
                variant={location.pathname === '/admin/workers' ? 'secondary' : 'ghost'}
                onClick={() => navigate('/admin/workers')}
                className={location.pathname === '/admin/workers' ? 'text-black hover:text-white hover:bg-gray-700' : 'text-white hover:text-white hover:bg-gray-800'}
              >
                <Users className="mr-2 h-4 w-4" />
                Workers
              </Button>
              <Button
                variant={location.pathname === '/admin/jobs' ? 'secondary' : 'ghost'}
                onClick={() => navigate('/admin/jobs')}
                className={location.pathname === '/admin/jobs' ? 'text-black hover:text-white hover:bg-gray-700' : 'text-white hover:text-white hover:bg-gray-800'}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Jobs
              </Button>
              <Button
                variant={location.pathname === '/admin/amendments' ? 'secondary' : 'ghost'}
                onClick={() => navigate('/admin/amendments')}
                className={location.pathname === '/admin/amendments' ? 'text-black hover:text-white hover:bg-gray-700' : 'text-white hover:text-white hover:bg-gray-800'}
              >
                <Clock className="mr-2 h-4 w-4" />
                Amendments
              </Button>
              <Button
                variant={location.pathname === '/admin/reports' ? 'secondary' : 'ghost'}
                onClick={() => navigate('/admin/reports')}
                className={location.pathname === '/admin/reports' ? 'text-black hover:text-white hover:bg-gray-700' : 'text-white hover:text-white hover:bg-gray-800'}
              >
                <FileText className="mr-2 h-4 w-4" />
                Reports
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-white hover:bg-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          )}

          {userRole === 'worker' && (
            <div className="hidden md:flex items-center space-x-2">
              {workerId && <WorkerNotifications workerId={workerId} />}
              <Button
                variant={location.pathname === '/clock' ? 'secondary' : 'ghost'}
                onClick={() => navigate('/clock')}
                className={location.pathname === '/clock' ? 'text-black hover:text-white hover:bg-gray-700' : 'text-white hover:text-white hover:bg-gray-800'}
              >
                <Clock className="mr-2 h-4 w-4" />
                Clock In/Out
              </Button>
              <Button
                variant={location.pathname === '/timesheets' ? 'secondary' : 'ghost'}
                onClick={() => navigate('/timesheets')}
                className={location.pathname === '/timesheets' ? 'text-black hover:text-white hover:bg-gray-700' : 'text-white hover:text-white hover:bg-gray-800'}
              >
                <FileText className="mr-2 h-4 w-4" />
                Timesheets
              </Button>
              <Button
                variant={location.pathname === '/profile' ? 'secondary' : 'ghost'}
                onClick={() => navigate('/profile')}
                className={location.pathname === '/profile' ? 'text-black hover:text-white hover:bg-gray-700' : 'text-white hover:text-white hover:bg-gray-800'}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="text-white hover:bg-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-white">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[250px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col space-y-2 mt-4">
                {userRole === 'super_admin' && (
                  <>
                    <Button 
                      variant="ghost" 
                      onClick={() => { navigate('/super-admin'); setIsOpen(false); }}
                      className="justify-start"
                    >
                      <Building className="mr-2 h-4 w-4" />
                      Organizations
                    </Button>
                  </>
                )}

                {userRole === 'manager' && (
                  <>
                    <Button 
                      variant="ghost" 
                      onClick={() => { navigate('/admin'); setIsOpen(false); }}
                      className="justify-start"
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => { navigate('/admin/workers'); setIsOpen(false); }}
                      className="justify-start"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Workers
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => { navigate('/admin/jobs'); setIsOpen(false); }}
                      className="justify-start"
                    >
                      <Briefcase className="mr-2 h-4 w-4" />
                      Jobs
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => { navigate('/admin/amendments'); setIsOpen(false); }}
                      className="justify-start"
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Amendments
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => { navigate('/admin/reports'); setIsOpen(false); }}
                      className="justify-start"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Reports
                    </Button>
                  </>
                )}

                {userRole === 'worker' && (
                  <>
                    <Button 
                      variant="ghost" 
                      onClick={() => { navigate('/clock'); setIsOpen(false); }}
                      className="justify-start"
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Clock In/Out
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => { navigate('/timesheets'); setIsOpen(false); }}
                      className="justify-start"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Timesheets
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => { navigate('/profile'); setIsOpen(false); }}
                      className="justify-start"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Button>
                  </>
                )}

                <Button 
                  variant="ghost" 
                  onClick={() => { handleLogout(); setIsOpen(false); }}
                  className="justify-start text-red-500 hover:bg-red-50"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};