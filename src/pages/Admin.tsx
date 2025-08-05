import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase, Users, Clock, FileText, AlertTriangle } from 'lucide-react';
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
          <div className="text-center">Loading dashboard...</div>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Currently Clocked In</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clockedInWorkers.length}</div>
              <p className="text-xs text-muted-foreground">
                workers on site
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHoursToday.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">
                hours logged today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Amendments</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingAmendments}</div>
              <p className="text-xs text-muted-foreground">
                awaiting review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeWorkers}</div>
              <p className="text-xs text-muted-foreground">
                total workforce
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Currently Clocked In Workers */}
          <Card>
            <CardHeader>
              <CardTitle>Workers On Site</CardTitle>
            </CardHeader>
            <CardContent>
              {clockedInWorkers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No workers currently clocked in
                </p>
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
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No recent activity
                </p>
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