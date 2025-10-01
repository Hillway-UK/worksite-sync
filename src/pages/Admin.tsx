import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, Users, Clock, FileText, AlertTriangle, TrendingUp, Users2, ArrowRight, KeyRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';

interface CllockedInWorker {
  worker_id: string;
  worker_name: string;
  job_name: string;
  clock_in: string;
}

interface RecentActivity {
  id: string;
  worker_name: string;
  job_name: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: number | null;
}

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [managerName, setManagerName] = useState('');
  const [clockedInWorkers, setClockedInWorkers] = useState<CllockedInWorker[]>([]);
  const [totalHoursToday, setTotalHoursToday] = useState(0);
  const [pendingAmendments, setPendingAmendments] = useState(0);
  const [activeWorkers, setActiveWorkers] = useState(0);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const [organizationName, setOrganizationName] = useState<string>('');

  useEffect(() => {
    const fetchOrganization = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: manager } = await supabase
          .from('managers')
          .select('organization_id')
          .eq('email', user.email)
          .single();
        
        if (manager?.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', manager.organization_id)
            .single();
          
          if (org?.name) {
            setOrganizationName(org.name);
          }
        }
      }
    };
    fetchOrganization();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [user?.email]);

  const fetchDashboardData = async () => {
    if (!user?.email) return;

    try {
      // Fetch manager name
      const { data: manager } = await supabase
        .from('managers')
        .select('name')
        .eq('email', user.email)
        .single();

      if (manager) {
        setManagerName(manager.name);
      }

      // Fetch clocked in workers
      const { data: clockedIn, error: clockedInError } = await supabase
        .rpc('get_clocked_in_workers');

      if (clockedInError) throw clockedInError;
      setClockedInWorkers(clockedIn || []);

      // Fetch total hours today
      const { data: hoursToday, error: hoursTodayError } = await supabase
        .rpc('get_total_hours_today');

      if (hoursTodayError) throw hoursTodayError;
      setTotalHoursToday(hoursToday || 0);

      // Fetch pending amendments count
      const { count: amendmentsCount, error: amendmentsError } = await supabase
        .from('time_amendments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (amendmentsError) throw amendmentsError;
      setPendingAmendments(amendmentsCount || 0);

      // Fetch active workers count
      const { count: workersCount, error: workersError } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (workersError) throw workersError;
      setActiveWorkers(workersCount || 0);

      // Fetch recent activity
      const { data: activity, error: activityError } = await supabase
        .rpc('get_recent_activity');

      if (activityError) throw activityError;
      setRecentActivity(activity || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-64 mx-auto mb-2" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Card key={i} className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="flex justify-between items-center">
                        <div>
                          <Skeleton className="h-4 w-24 mb-1" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between mb-8">
          <div className="flex flex-col items-center flex-1">
            <Briefcase className="h-16 w-16 text-primary mb-4" />
            <h1 className="text-3xl font-heading font-extrabold text-foreground mb-2">
              Welcome, {managerName || 'Manager'}
            </h1>
            <p className="text-muted-foreground font-body">
              AutoTime - Manager Console
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChangePasswordOpen(true)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Change Password
          </Button>
        </div>

        {organizationName && (
          <div className="mb-6">
            <h2 className="text-lg text-gray-600">Organization: <span className="font-semibold text-black">{organizationName}</span></h2>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <div 
            onClick={() => { setIsNavigating(true); navigate('/admin/workers'); }}
            className="cursor-pointer group active:scale-95"
            title="Click to view all workers"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
          >
            <Card className="transition-all duration-200 hover:scale-105 hover:shadow-xl group-hover:border-primary/20 bg-gradient-to-br from-primary to-primary/90 group-hover:from-primary/90 group-hover:to-primary relative">
              <ArrowRight className="absolute top-4 right-4 w-4 h-4 text-primary-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-heading font-bold text-primary-foreground">Currently Clocked In</CardTitle>
                <div className="group-hover:scale-110 transition-transform duration-200">
                  <Clock className="h-4 w-4 text-primary-foreground" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="text-4xl font-heading font-extrabold text-primary-foreground">{clockedInWorkers.length}</div>
                  <TrendingUp className="h-4 w-4 text-primary-foreground" />
                </div>
                <p className="text-xs text-primary-foreground/90">
                  workers on site
                </p>
              </CardContent>
            </Card>
          </div>

          <div 
            onClick={() => { setIsNavigating(true); navigate('/admin/reports'); }}
            className="cursor-pointer group active:scale-95"
            title="Click to view today's reports"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
          >
            <Card className="transition-all duration-200 hover:scale-105 hover:shadow-lg group-hover:border-primary/20 bg-gradient-to-br from-green-50 to-green-100 group-hover:from-green-100 group-hover:to-green-200 relative">
              <ArrowRight className="absolute top-4 right-4 w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">Total Hours Today</CardTitle>
                <div className="group-hover:scale-110 transition-transform duration-200">
                  <Clock className="h-4 w-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-green-800 group-hover:text-primary/80">{totalHoursToday.toFixed(1)}</div>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-xs text-green-600/80">
                  hours logged today
                </p>
              </CardContent>
            </Card>
          </div>

          <div 
            onClick={() => { setIsNavigating(true); navigate('/admin/amendments'); }}
            className="cursor-pointer group active:scale-95"
            title="Click to review amendments"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
          >
            <Card className="transition-all duration-200 hover:scale-105 hover:shadow-lg group-hover:border-primary/20 bg-gradient-to-br from-orange-50 to-orange-100 group-hover:from-orange-100 group-hover:to-orange-200 relative">
              <ArrowRight className="absolute top-4 right-4 w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">Pending Amendments</CardTitle>
                <div className="group-hover:scale-110 transition-transform duration-200">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-orange-800 group-hover:text-primary/80">{pendingAmendments}</div>
                  {pendingAmendments > 0 && <TrendingUp className="h-4 w-4 text-orange-600" />}
                </div>
                <p className="text-xs text-orange-600/80">
                  awaiting review
                </p>
              </CardContent>
            </Card>
          </div>

          <div 
            onClick={() => { setIsNavigating(true); navigate('/admin/workers'); }}
            className="cursor-pointer group active:scale-95"
            title="Click to manage workers"
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
          >
            <Card className="transition-all duration-200 hover:scale-105 hover:shadow-lg group-hover:border-primary/20 bg-gradient-to-br from-purple-50 to-purple-100 group-hover:from-purple-100 group-hover:to-purple-200 relative">
              <ArrowRight className="absolute top-4 right-4 w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium group-hover:text-primary transition-colors">Active Workers</CardTitle>
                <div className="group-hover:scale-110 transition-transform duration-200">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-purple-800 group-hover:text-primary/80">{activeWorkers}</div>
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-xs text-purple-600/80">
                  total workforce
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Currently Clocked In Workers */}
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle>Workers On Site</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {clockedInWorkers.length === 0 ? (
                <div className="text-center py-8">
                  <Users2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg font-medium mb-2">
                    No workers currently clocked in
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Workers will appear here when they clock in
                  </p>
                  <Button 
                    onClick={() => navigate('/admin/workers')}
                    variant="outline"
                    size="sm"
                  >
                    View All Workers
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {clockedInWorkers.map((worker, index) => (
                    <div 
                      key={index} 
                      onClick={() => navigate('/admin/workers')}
                      className="flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors p-2 rounded-lg -m-2"
                    >
                      <div>
                        <p className="font-medium hover:text-primary transition-colors">{worker.worker_name}</p>
                        <p className="text-sm text-muted-foreground">{worker.job_name}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">
                          {format(new Date(worker.clock_in), 'HH:mm')}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Started
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity - Temporarily Hidden */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Activity tracking coming soon</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ChangePasswordModal 
        open={changePasswordOpen} 
        onOpenChange={setChangePasswordOpen} 
      />
    </Layout>
  );
}