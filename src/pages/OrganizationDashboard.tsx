import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, Settings, CreditCard, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface OrganizationStats {
  totalWorkers: number;
  totalManagers: number;
  activeJobs: number;
  subscriptionStatus: string;
  trialEndsAt: string | null;
}

export default function OrganizationDashboard() {
  const { user, organization, organizationId, userRole } = useAuth();
  const [stats, setStats] = useState<OrganizationStats>({
    totalWorkers: 0,
    totalManagers: 0,
    activeJobs: 0,
    subscriptionStatus: 'trial',
    trialEndsAt: null
  });
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [orgEmail, setOrgEmail] = useState(organization?.email || '');
  const [orgPhone, setOrgPhone] = useState(organization?.phone || '');

  useEffect(() => {
    fetchOrganizationStats();
  }, [organizationId]);

  const fetchOrganizationStats = async () => {
    if (!organizationId) return;

    try {
      // Get worker count
      const { count: workerCount } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      // Get manager count  
      const { count: managerCount } = await supabase
        .from('managers')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Get active jobs count
      const { count: jobCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      setStats({
        totalWorkers: workerCount || 0,
        totalManagers: managerCount || 0,
        activeJobs: jobCount || 0,
        subscriptionStatus: organization?.subscription_status || 'trial',
        trialEndsAt: organization?.trial_ends_at
      });
    } catch (error) {
      console.error('Error fetching organization stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrganization = async () => {
    if (!organizationId) return;

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgName,
          email: orgEmail,
          phone: orgPhone,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization details updated successfully"
      });
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({
        title: "Error",
        description: "Failed to update organization details",
        variant: "destructive"
      });
    }
  };

  if (userRole !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need super admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Loading organization...</div>
      </div>
    );
  }

  const isTrialExpired = stats.trialEndsAt && new Date(stats.trialEndsAt) < new Date();
  const daysUntilTrialEnd = stats.trialEndsAt 
    ? Math.ceil((new Date(stats.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Organization Dashboard</h1>
          <p className="text-muted-foreground">Manage your organization settings and view statistics</p>
        </div>

        {/* Subscription Status Alert */}
        {stats.subscriptionStatus === 'trial' && (
          <Card className="mb-6 border-warning">
            <CardContent className="flex items-center gap-4 pt-6">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div className="flex-1">
                <h3 className="font-semibold">Trial Account</h3>
                <p className="text-sm text-muted-foreground">
                  {isTrialExpired 
                    ? 'Your trial has expired. Please upgrade to continue using the service.'
                    : `Your trial ends in ${daysUntilTrialEnd} days.`
                  }
                </p>
              </div>
              <Button variant="outline">
                Upgrade Now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWorkers}</div>
              <p className="text-xs text-muted-foreground">
                Limit: {organization?.max_workers || 10}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Managers</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalManagers}</div>
              <p className="text-xs text-muted-foreground">
                Limit: {organization?.max_managers || 2}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeJobs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscription</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={stats.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                {stats.subscriptionStatus}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList>
            <TabsTrigger value="details">Organization Details</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="users">User Management</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Organization Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="orgName">Organization Name</Label>
                    <Input
                      id="orgName"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="orgEmail">Email</Label>
                    <Input
                      id="orgEmail"
                      type="email"
                      value={orgEmail}
                      onChange={(e) => setOrgEmail(e.target.value)}
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="orgPhone">Phone</Label>
                    <Input
                      id="orgPhone"
                      value={orgPhone}
                      onChange={(e) => setOrgPhone(e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                <Button onClick={updateOrganization}>
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">Current Plan</h3>
                      <p className="text-sm text-muted-foreground">
                        {stats.subscriptionStatus === 'trial' ? 'Trial Plan' : 'Active Subscription'}
                      </p>
                    </div>
                    <Badge variant={stats.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                      {stats.subscriptionStatus}
                    </Badge>
                  </div>
                  
                  {stats.subscriptionStatus === 'trial' && (
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Upgrade to Premium</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Unlock unlimited workers, advanced features, and priority support.
                      </p>
                      <Button>Choose Plan</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Workers</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {stats.totalWorkers} / {organization?.max_workers || 10} active
                      </p>
                      <Button size="sm" variant="outline" disabled>
                        Manage Workers
                      </Button>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Managers</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {stats.totalManagers} / {organization?.max_managers || 2} active
                      </p>
                      <Button size="sm" variant="outline" disabled>
                        Manage Managers
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    User management features will be available in the next update.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}