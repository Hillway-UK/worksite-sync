import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, CreditCard, Users, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'organization' | 'payment' | 'complete'>('organization');
  const [loading, setLoading] = useState(false);
  
  // Organization data with worker/manager counts
  const [orgData, setOrgData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
    managerCount: 1,
    workerCount: 5
  });

  // Calculate monthly total
  const calculateMonthlyTotal = () => {
    return (orgData.managerCount * 25) + (orgData.workerCount * 1.5);
  };

  // Handle organization creation
  const handleCreateOrganization = async () => {
    try {
      setLoading(true);
      
      // Validate
      if (!orgData.name || !orgData.admin_email || !orgData.admin_password) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (orgData.admin_password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }

      // Create auth user with proper emailRedirectTo
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: orgData.admin_email,
        password: orgData.admin_password,
        options: {
          data: {
            name: orgData.admin_name,
            role: 'manager'
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgData.name,
          address: orgData.address || '',
          phone: orgData.phone || '',
          email: orgData.admin_email,
          max_workers: orgData.workerCount,
          max_managers: orgData.managerCount,
          subscription_status: 'pending_payment'
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create manager record (without is_owner field)
      const { error: managerError } = await supabase
        .from('managers')
        .insert({
          email: orgData.admin_email,
          name: orgData.admin_name,
          organization_id: org.id,
          is_admin: true
        });

      if (managerError) throw managerError;

      // Store data for payment step
      sessionStorage.setItem('orgData', JSON.stringify(orgData));
      sessionStorage.setItem('organizationId', org.id);

      toast.success('Organization created successfully!');
      setCurrentStep('payment');
      
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSetup = async () => {
    setLoading(true);
    try {
      const organizationId = sessionStorage.getItem('organizationId');
      
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { 
          managerCount: orgData.managerCount,
          workerCount: orgData.workerCount,
          organizationId
        }
      });

      if (error) throw error;

      // Redirect to Stripe checkout
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Payment setup error:', error);
      toast.error(error.message || 'Failed to set up payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        
        {currentStep === 'organization' && (
          <Card>
            <CardHeader>
              <CardTitle>Set Up Your Organization</CardTitle>
              <CardDescription>Enter your company details and choose your subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Company Details */}
              <div className="space-y-4">
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    value={orgData.name}
                    onChange={(e) => setOrgData({...orgData, name: e.target.value})}
                    placeholder="Your Company Name"
                  />
                </div>
                
                <div>
                  <Label>Address</Label>
                  <Input
                    value={orgData.address}
                    onChange={(e) => setOrgData({...orgData, address: e.target.value})}
                    placeholder="123 Main Street"
                  />
                </div>
                
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={orgData.phone}
                    onChange={(e) => setOrgData({...orgData, phone: e.target.value})}
                    placeholder="0114 123 4567"
                  />
                </div>
              </div>

              <Separator />

              {/* Subscription Selection */}
              <div className="space-y-4">
                <h3 className="font-semibold">Choose Your Subscription</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Managers</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (orgData.managerCount > 1) {
                            setOrgData(prev => ({...prev, managerCount: prev.managerCount - 1}));
                          }
                        }}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-12 text-center">{orgData.managerCount}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOrgData(prev => ({...prev, managerCount: prev.managerCount + 1}));
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">£25/month each</p>
                  </div>
                  
                  <div>
                    <Label>Workers</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (orgData.workerCount > 0) {
                            setOrgData(prev => ({...prev, workerCount: prev.workerCount - 1}));
                          }
                        }}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-12 text-center">{orgData.workerCount}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOrgData(prev => ({...prev, workerCount: prev.workerCount + 1}));
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">£1.50/month each</p>
                  </div>
                </div>
                
                <div className="bg-gray-100 p-3 rounded">
                  <div className="flex justify-between font-semibold">
                    <span>Monthly Total:</span>
                    <span>£{calculateMonthlyTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Admin Account */}
              <div className="space-y-4">
                <h3 className="font-semibold">Admin Account</h3>
                
                <div>
                  <Label>Your Name *</Label>
                  <Input
                    value={orgData.admin_name}
                    onChange={(e) => setOrgData({...orgData, admin_name: e.target.value})}
                    placeholder="John Smith"
                  />
                </div>
                
                <div>
                  <Label>Your Email *</Label>
                  <Input
                    type="email"
                    value={orgData.admin_email}
                    onChange={(e) => setOrgData({...orgData, admin_email: e.target.value})}
                    placeholder="admin@company.com"
                  />
                </div>
                
                <div>
                  <Label>Password * (min 8 characters)</Label>
                  <Input
                    type="password"
                    value={orgData.admin_password}
                    onChange={(e) => setOrgData({...orgData, admin_password: e.target.value})}
                    placeholder="********"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateOrganization}
                disabled={loading}
                className="w-full bg-[#702D30] hover:bg-[#420808]"
              >
                {loading ? 'Creating...' : 'Create Organization'}
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 'payment' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-[#702D30]" />
                Complete Payment
              </CardTitle>
              <CardDescription>
                Set up your subscription to activate your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Subscription Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Organization:</span>
                    <span className="font-semibold">{orgData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{orgData.managerCount} Manager{orgData.managerCount !== 1 ? 's' : ''} × £25</span>
                    <span>£{(orgData.managerCount * 25).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{orgData.workerCount} Worker{orgData.workerCount !== 1 ? 's' : ''} × £1.50</span>
                    <span>£{(orgData.workerCount * 1.5).toFixed(2)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Monthly Total:</span>
                    <span className="text-[#702D30]">£{calculateMonthlyTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handlePaymentSetup}
                disabled={loading}
                className="w-full bg-[#702D30] hover:bg-[#420808]"
              >
                {loading ? 'Processing...' : `Pay £${calculateMonthlyTotal().toFixed(2)}/month`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}