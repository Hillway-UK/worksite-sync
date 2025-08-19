import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Building, CreditCard, Plus, Minus, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'organization' | 'payment'>('organization');
  const [loading, setLoading] = useState(false);
  const [orgData, setOrgData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
    managerCount: 1,
    workerCount: 5,
  });

  const calculateMonthlyTotal = () => {
    const managerCost = (orgData.managerCount || 1) * 25;
    const workerCost = (orgData.workerCount || 0) * 1.5;
    return managerCost + workerCost;
  };

  const handleCreateOrganization = async () => {
    try {
      setLoading(true);
      
      // Create the organization and admin user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: orgData.admin_email,
        password: orgData.admin_password,
        options: {
          data: {
            name: orgData.admin_name,
            role: 'super_admin'
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (authError) throw authError;

      // Create organization with user limits
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgData.name,
          address: orgData.address,
          phone: orgData.phone,
          email: orgData.email || orgData.admin_email,
          max_workers: orgData.workerCount,
          max_managers: orgData.managerCount,
          subscription_status: 'pending_payment'
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create super admin
      const { error: adminError } = await supabase
        .from('super_admins')
        .insert({
          email: orgData.admin_email,
          name: orgData.admin_name,
          organization_id: org.id,
          is_owner: true
        });

      if (adminError) throw adminError;

      // Store organization ID for payment step
      sessionStorage.setItem('organizationId', org.id);
      sessionStorage.setItem('orgData', JSON.stringify({
        ...orgData,
        monthlyTotal: calculateMonthlyTotal()
      }));

      setCurrentStep('payment');
      toast.success('Organization created! Please complete payment to continue.');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message);
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
        window.open(data.url, '_blank');
        toast.success('Redirecting to payment setup...');
      }
    } catch (error: any) {
      console.error('Payment setup error:', error);
      toast.error(error.message || 'Failed to set up payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="max-w-4xl mx-auto p-8">
        {currentStep === 'organization' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-6 w-6 text-[#702D30]" />
                Set Up Your Organization
              </CardTitle>
              <CardDescription>
                Enter your company details and choose your subscription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Details */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="company-name">Company Name *</Label>
                  <Input
                    id="company-name"
                    value={orgData.name}
                    onChange={(e) => setOrgData({...orgData, name: e.target.value})}
                    placeholder="Your Company Name"
                    required
                  />
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={orgData.phone}
                      onChange={(e) => setOrgData({...orgData, phone: e.target.value})}
                      placeholder="0114 123 4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company-email">Company Email</Label>
                    <Input
                      id="company-email"
                      type="email"
                      value={orgData.email}
                      onChange={(e) => setOrgData({...orgData, email: e.target.value})}
                      placeholder="info@company.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={orgData.address}
                    onChange={(e) => setOrgData({...orgData, address: e.target.value})}
                    placeholder="123 Main Street, Sheffield, S1 2AB"
                  />
                </div>
              </div>

              <Separator />

              {/* User Quantity Selection */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Choose Your Subscription</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="managers">Number of Managers/Admins</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOrgData(prev => ({
                          ...prev,
                          managerCount: Math.max(1, prev.managerCount - 1)
                        }))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        id="managers"
                        type="number"
                        min="1"
                        value={orgData.managerCount}
                        onChange={(e) => setOrgData({...orgData, managerCount: parseInt(e.target.value) || 1})}
                        className="text-center w-20"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOrgData(prev => ({
                          ...prev,
                          managerCount: prev.managerCount + 1
                        }))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600">£25/month per manager</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workers">Number of Workers</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOrgData(prev => ({
                          ...prev,
                          workerCount: Math.max(0, prev.workerCount - 1)
                        }))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        id="workers"
                        type="number"
                        min="0"
                        value={orgData.workerCount}
                        onChange={(e) => setOrgData({...orgData, workerCount: parseInt(e.target.value) || 0})}
                        className="text-center w-20"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOrgData(prev => ({
                          ...prev,
                          workerCount: prev.workerCount + 1
                        }))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600">£1.50/month per worker</p>
                  </div>
                </div>

                {/* Monthly Cost Calculation */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Monthly Subscription Cost:</span>
                    <span className="text-2xl font-bold text-[#702D30]">
                      £{calculateMonthlyTotal().toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>{orgData.managerCount} Manager{orgData.managerCount !== 1 ? 's' : ''}</span>
                      <span>£{(orgData.managerCount * 25).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{orgData.workerCount} Worker{orgData.workerCount !== 1 ? 's' : ''}</span>
                      <span>£{(orgData.workerCount * 1.5).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Admin Account */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Admin Account Details</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="admin-name">Your Name *</Label>
                    <Input
                      id="admin-name"
                      value={orgData.admin_name}
                      onChange={(e) => setOrgData({...orgData, admin_name: e.target.value})}
                      placeholder="John Smith"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="admin-email">Your Email *</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={orgData.admin_email}
                      onChange={(e) => setOrgData({...orgData, admin_email: e.target.value})}
                      placeholder="admin@company.com"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="admin-password">Password *</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={orgData.admin_password}
                      onChange={(e) => setOrgData({...orgData, admin_password: e.target.value})}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      required
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCreateOrganization}
                className="w-full bg-[#702D30] hover:bg-[#420808]"
                disabled={!orgData.name || !orgData.admin_name || !orgData.admin_email || !orgData.admin_password || orgData.admin_password.length < 8}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Organization...
                  </>
                ) : (
                  'Continue to Payment'
                )}
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
                Enter your payment details to activate your subscription
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Subscription Summary */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Subscription Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Organization:</span>
                    <span className="font-semibold">{orgData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Billing Email:</span>
                    <span className="font-semibold">{orgData.admin_email}</span>
                  </div>
                  <Separator className="my-2" />
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
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Pay £{calculateMonthlyTotal().toFixed(2)}/month
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-gray-500">
                Secure payment processed by Stripe. Your subscription will be charged monthly.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}