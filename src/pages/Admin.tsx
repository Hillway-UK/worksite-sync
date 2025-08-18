import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Users, Clock, FileText, AlertTriangle, TrendingUp, Users2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

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
  const [managerName, setManagerName] = useState('');
  const [clockedInWorkers, setClockedInWorkers] = useState<CllockedInWorker[]>([]);
  const [totalHoursToday, setTotalHoursToday] = useState(0);
  const [pendingAmendments, setPendingAmendments] = useState(0);
  const [activeWorkers, setActiveWorkers] = useState(0);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div className="text-center mb-8">
          <Briefcase className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome, {managerName || 'Manager'}
          </h1>
          <p className="text-muted-foreground">
            Manager dashboard for workforce management
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 bg-gradient-to-br from-blue-50 to-blue-100 hover:scale-105 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Currently Clocked In</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-blue-800">{clockedInWorkers.length}</div>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xs text-blue-600/80">
                workers on site
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 bg-gradient-to-br from-green-50 to-green-100 hover:scale-105 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours Today</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-green-800">{totalHoursToday.toFixed(1)}</div>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-xs text-green-600/80">
                hours logged today
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 bg-gradient-to-br from-orange-50 to-orange-100 hover:scale-105 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Amendments</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-orange-800">{pendingAmendments}</div>
                {pendingAmendments > 0 && <TrendingUp className="h-4 w-4 text-orange-600" />}
              </div>
              <p className="text-xs text-orange-600/80">
                awaiting review
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200 bg-gradient-to-br from-purple-50 to-purple-100 hover:scale-105 transition-transform">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-purple-800">{activeWorkers}</div>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xs text-purple-600/80">
                total workforce
              </p>
            </CardContent>
          </Card>
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
                  <p className="text-sm text-muted-foreground">
                    Workers will appear here when they clock in
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clockedInWorkers.map((worker, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{worker.worker_name}</p>
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

          {/* Recent Activity */}
          <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg font-medium mb-2">
                    No recent activity
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Recent clock entries will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{activity.worker_name}</p>
                        <p className="text-sm text-muted-foreground">{activity.job_name}</p>
                      </div>
                      <div className="text-right">
                        {activity.clock_out ? (
                          <>
                            <Badge variant="outline">
                              {activity.total_hours?.toFixed(1)}h
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              Completed
                            </p>
                          </>
                        ) : (
                          <>
                            <Badge variant="secondary">
                              Active
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(activity.clock_in), 'HH:mm')}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}