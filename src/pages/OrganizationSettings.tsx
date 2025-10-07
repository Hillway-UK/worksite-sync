import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building, Save, Plus, Minus, TrendingUp, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { UpgradeSubscriptionDialog } from '@/components/UpgradeSubscriptionDialog';
import { SubscriptionHistory } from '@/components/SubscriptionHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface Organization {
  id: string;
  name: string;
  company_number?: string;
  vat_number?: string;
  address?: string;
  phone?: string;
  email?: string;
  max_workers: number;
  max_managers: number;
  subscription_status?: string;
}

interface ActiveSubscription {
  plan_type: string;
  active_managers: number;
  active_workers: number;
  planned_number_of_managers: number;
  planned_number_of_workers: number;
  effective_start_date: string;
}

export default function OrganizationSettings() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .single();
      
      if (error) throw error;
      setOrganization(data);

      // Fetch active subscription
      const { data: subData, error: subError } = await supabase
        .from('subscription_usage')
        .select('*')
        .eq('organization_id', data.id)
        .eq('status', 'active')
        .single();

      if (subError) {
        console.error('Error fetching subscription:', subError);
      } else {
        setActiveSubscription(subData);
      }
    } catch (error: any) {
      console.error('Error fetching organization:', error);
      toast.error('Failed to load organization settings');
    }
  };

  const handleSave = async () => {
    if (!organization) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: organization.name,
          company_number: organization.company_number,
          vat_number: organization.vat_number,
          address: organization.address,
          phone: organization.phone,
          email: organization.email
        })
        .eq('id', organization.id);

      if (error) throw error;
      toast.success('Organization settings updated');
    } catch (error: any) {
      console.error('Error updating organization:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async (newManagerCount: number, newWorkerCount: number) => {
    if (!organization) return;
    
    setUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-subscription', {
        body: {
          organizationId: organization.id,
          managerCount: newManagerCount,
          workerCount: newWorkerCount
        }
      });

      if (error) throw error;

      setOrganization(prev => prev ? {
        ...prev,
        max_managers: newManagerCount,
        max_workers: newWorkerCount
      } : null);

      toast.success('Subscription updated successfully');
    } catch (error: any) {
      console.error('Error updating subscription:', error);
      toast.error(error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (!organization) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center">Loading organization settings...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <Building className="h-16 w-16 text-black mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Organisation Settings</h1>
          <p className="text-muted-foreground">
            Manage your organisation details and subscription
          </p>
        </div>

        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Company Details</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={organization.name || ''}
                  onChange={(e) => setOrganization({...organization, name: e.target.value})}
                />
              </div>
              <div>
                <Label>Company Number</Label>
                <Input
                  value={organization.company_number || ''}
                  onChange={(e) => setOrganization({...organization, company_number: e.target.value})}
                  placeholder="12345678"
                />
              </div>
              <div>
                <Label>VAT Number</Label>
                <Input
                  value={organization.vat_number || ''}
                  onChange={(e) => setOrganization({...organization, vat_number: e.target.value})}
                  placeholder="GB123456789"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={organization.phone || ''}
                  onChange={(e) => setOrganization({...organization, phone: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <Label>Address</Label>
              <Input
                value={organization.address || ''}
                onChange={(e) => setOrganization({...organization, address: e.target.value})}
              />
            </div>

            <div>
              <Label>Billing Email</Label>
              <Input
                type="email"
                value={organization.email || ''}
                onChange={(e) => setOrganization({...organization, email: e.target.value})}
              />
            </div>

            <Button 
              onClick={handleSave} 
              disabled={loading} 
              className="bg-black hover:bg-gray-800"
            >
              <Save className="mr-2 h-4 w-4" />
              {loading ? 'Saving...' : 'Save Company Details'}
            </Button>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="subscription">
            <div className="space-y-6">
              {activeSubscription && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Current Plan</span>
                      <Badge className="text-sm">
                        {activeSubscription.plan_type.toUpperCase()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Active Managers</div>
                        <div className="text-2xl font-bold">
                          {activeSubscription.active_managers} / {activeSubscription.planned_number_of_managers}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Active Workers</div>
                        <div className="text-2xl font-bold">
                          {activeSubscription.active_workers} / {activeSubscription.planned_number_of_workers}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Started: {new Date(activeSubscription.effective_start_date).toLocaleDateString()}</span>
                    </div>

                    <Button 
                      onClick={() => setUpgradeDialogOpen(true)}
                      className="w-full"
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Upgrade Plan
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label>Manager Licenses</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateSubscription(Math.max(1, organization.max_managers - 1), organization.max_workers)}
                    disabled={updating || organization.max_managers <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-16 text-center font-semibold">{organization.max_managers}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateSubscription(organization.max_managers + 1, organization.max_workers)}
                    disabled={updating}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mt-1">£25/month per manager</p>
              </div>

              <div>
                <Label>Worker Licenses</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateSubscription(organization.max_managers, Math.max(0, organization.max_workers - 1))}
                    disabled={updating || organization.max_workers <= 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-16 text-center font-semibold">{organization.max_workers}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateSubscription(organization.max_managers, organization.max_workers + 1)}
                    disabled={updating}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-600 mt-1">£1.50/month per worker</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Current Monthly Cost:</span>
                <span className="text-xl font-bold text-black">
                  £{((organization.max_managers * 25) + (organization.max_workers * 1.5)).toFixed(2)}
                </span>
              </div>
              </div>
            </CardContent>
          </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            {organization && <SubscriptionHistory organizationId={organization.id} />}
          </TabsContent>
        </Tabs>

        {organization && activeSubscription && (
          <UpgradeSubscriptionDialog
            open={upgradeDialogOpen}
            onOpenChange={setUpgradeDialogOpen}
            organizationId={organization.id}
            currentPlan={activeSubscription.plan_type}
            currentManagers={activeSubscription.active_managers}
            currentWorkers={activeSubscription.active_workers}
            onUpgradeComplete={fetchOrganization}
          />
        )}
      </div>
    </Layout>
  );
}