import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StepIndicator } from '@/components/StepIndicator';
import { TeamSetupStep } from '@/components/TeamSetupStep';
import { Building, CreditCard, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [orgData, setOrgData] = useState({
    name: '',
    company_number: '',
    vat_number: '',
    address: '',
    phone: '',
    email: '',
    admin_name: '',
    admin_email: '',
    admin_password: ''
  });

  const handleCreateOrganization = async () => {
    if (!orgData.name || !orgData.admin_name || !orgData.admin_email || !orgData.admin_password) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      // Create auth user for super admin
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

      if (authData.user) {
        // Use an edge function to create organization and super admin
        const { error: setupError } = await supabase.functions.invoke('setup-organization', {
          body: {
            orgData,
            userId: authData.user.id
          }
        });

        if (setupError) throw setupError;

        toast.success('Organization created! Starting trial...');
        setStep(2);
      }
    } catch (error: any) {
      console.error('Organization setup error:', error);
      toast.error(error.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleTrialSetup = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('create-subscription', {
        body: { plan: 'trial' }
      });

      if (error) throw error;

      toast.success('14-day trial activated!');
      setStep(3);
    } catch (error: any) {
      console.error('Trial setup error:', error);
      toast.error(error.message || 'Failed to activate trial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="max-w-4xl mx-auto p-8">
        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <StepIndicator number={1} label="Organization" active={step === 1} complete={step > 1} />
            <div className="w-16 h-1 bg-border" />
            <StepIndicator number={2} label="Trial Setup" active={step === 2} complete={step > 2} />
            <div className="w-16 h-1 bg-border" />
            <StepIndicator number={3} label="Team Setup" active={step === 3} complete={step > 3} />
          </div>
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-6 w-6 text-primary" />
                Set Up Your Organization
              </CardTitle>
              <CardDescription>
                Start your 14-day free trial of Pioneer Auto Timesheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    value={orgData.name}
                    onChange={(e) => setOrgData({...orgData, name: e.target.value})}
                    placeholder="Pioneer Construction Services"
                  />
                </div>
                <div>
                  <Label>Company Number</Label>
                  <Input
                    value={orgData.company_number}
                    onChange={(e) => setOrgData({...orgData, company_number: e.target.value})}
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <Label>VAT Number</Label>
                  <Input
                    value={orgData.vat_number}
                    onChange={(e) => setOrgData({...orgData, vat_number: e.target.value})}
                    placeholder="GB123456789"
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
              
              <div>
                <Label>Address</Label>
                <Input
                  value={orgData.address}
                  onChange={(e) => setOrgData({...orgData, address: e.target.value})}
                  placeholder="123 Construction Way, Sheffield, S1 2AB"
                />
              </div>

              <hr className="my-6" />
              
              <h3 className="font-semibold text-lg">Admin Account</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
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
                  <Label>Password *</Label>
                  <Input
                    type="password"
                    value={orgData.admin_password}
                    onChange={(e) => setOrgData({...orgData, admin_password: e.target.value})}
                    placeholder="Minimum 8 characters"
                  />
                </div>
              </div>

              <Button
                onClick={handleCreateOrganization}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Creating Organization...' : 'Create Organization & Start Free Trial'}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-primary" />
                Activate Your Free Trial
              </CardTitle>
              <CardDescription>
                14-day free trial with full access to all features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pricing Display */}
              <div className="bg-muted p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Simple, Transparent Pricing</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Per Manager/Admin</span>
                    <span className="font-bold">£25/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Per Worker</span>
                    <span className="font-bold">£1.50/month</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Only pay for active users each month. Add or remove users anytime.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">14 days completely free</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">No credit card required</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Cancel anytime</span>
                </div>
              </div>

              <Button
                onClick={handleTrialSetup}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Activating Trial...' : 'Activate 14-Day Free Trial'}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 3 && <TeamSetupStep />}
      </div>
    </div>
  );
}