import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_51Jv4K2LXpjQqS8kXFKkN0YV9X4mKRhGwY5Y8KZGxHvR4VvQZJ6NnPX9RY5FqK4x5RqN8M0xKqY5Z8Y5Z8Y5Z00Y5Z8Y5Z8');

function PaymentStep({ orgData, organizationId }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    
    // For testing - just complete the payment
    try {
      await supabase
        .from('organizations')
        .update({ subscription_status: 'active' })
        .eq('id', organizationId);
      
      toast.success('Account activated successfully!');
      navigate('/admin');
    } catch (error) {
      toast.error('Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  const monthlyTotal = (orgData.managerCount * 25) + (orgData.workerCount * 1.5);

  return (
    <form onSubmit={handlePayment}>
      <div style={{ marginBottom: '20px' }}>
        <PaymentElement />
      </div>
      
      <button
        type="submit"
        disabled={!stripe || processing}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#702D30',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          cursor: processing ? 'not-allowed' : 'pointer',
          opacity: processing ? 0.7 : 1
        }}
      >
        {processing ? 'Processing...' : `Pay £${monthlyTotal.toFixed(2)}/month`}
      </button>
      
      <button
        type="button"
        onClick={() => {
          navigate('/admin');
        }}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: 'transparent',
          color: '#702D30',
          border: '1px solid #702D30',
          borderRadius: '6px',
          fontSize: '14px',
          marginTop: '10px',
          cursor: 'pointer'
        }}
      >
        Skip Payment (Test Mode)
      </button>
    </form>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'organization' | 'payment' | 'complete'>('organization');
  const [loading, setLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  
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

  const handleCreateOrganization = async () => {
    try {
      setLoading(true);
      
      if (!orgData.name || !orgData.admin_email || !orgData.admin_password) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (orgData.admin_password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: orgData.admin_email,
        password: orgData.admin_password,
        options: {
          emailRedirectTo: "https://autotime.hillwayco.uk/login",
          data: {
            role: 'super_admin'
          }
        }
      });

      if (authError) throw authError;

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgData.name,
          address: orgData.address || null,
          phone: orgData.phone || null,
          email: orgData.admin_email,
          max_workers: orgData.workerCount,
          max_managers: orgData.managerCount,
          subscription_status: 'pending_payment'
        })
        .select()
        .single();

      if (orgError) throw orgError;

      setOrganizationId(org.id);

      // Create manager
      const { error: managerError } = await supabase
        .from('managers')
        .insert({
          email: orgData.admin_email,
          name: orgData.admin_name,
          organization_id: org.id
        });

      if (managerError) throw managerError;

      // For testing - use a dummy client secret
      setClientSecret('pi_test_secret_key');
      setCurrentStep('payment');
      toast.success('Account created! Complete payment to activate.');
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
              <p className="text-gray-600">Redirecting to your dashboard...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === 'payment' && clientSecret) {
    const options = {
      clientSecret,
      appearance: {
        theme: 'stripe' as const,
        variables: {
          colorPrimary: '#702D30',
        },
      },
    };

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Complete Payment</CardTitle>
              <CardDescription>
                Monthly subscription: £{((orgData.managerCount * 25) + (orgData.workerCount * 1.5)).toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={options}>
                <PaymentStep orgData={orgData} organizationId={organizationId} />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Set Up Your Organization</CardTitle>
            <CardDescription>Enter your company details and choose your subscription</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
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
                  placeholder="01234 567890"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold">Choose Your Subscription</h3>
              
              {/* WORKING MANAGER BUTTONS */}
              <div>
                <Label>Managers</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <div
                    onClick={() => {
                      if (orgData.managerCount > 1) {
                        setOrgData({...orgData, managerCount: orgData.managerCount - 1});
                      }
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: orgData.managerCount > 1 ? 'pointer' : 'not-allowed',
                      backgroundColor: orgData.managerCount > 1 ? 'white' : '#f5f5f5',
                      userSelect: 'none'
                    }}
                  >
                    -
                  </div>
                  
                  <input
                    type="number"
                    value={orgData.managerCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      if (val >= 1) setOrgData({...orgData, managerCount: val});
                    }}
                    style={{
                      width: '60px',
                      textAlign: 'center',
                      padding: '4px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    min="1"
                  />
                  
                  <div
                    onClick={() => {
                      setOrgData({...orgData, managerCount: orgData.managerCount + 1});
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backgroundColor: 'white',
                      userSelect: 'none'
                    }}
                  >
                    +
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-1">£25/month each</p>
              </div>
              
              {/* WORKING WORKER BUTTONS */}
              <div>
                <Label>Workers</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <div
                    onClick={() => {
                      if (orgData.workerCount > 0) {
                        setOrgData({...orgData, workerCount: orgData.workerCount - 1});
                      }
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: orgData.workerCount > 0 ? 'pointer' : 'not-allowed',
                      backgroundColor: orgData.workerCount > 0 ? 'white' : '#f5f5f5',
                      userSelect: 'none'
                    }}
                  >
                    -
                  </div>
                  
                  <input
                    type="number"
                    value={orgData.workerCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      if (val >= 0) setOrgData({...orgData, workerCount: val});
                    }}
                    style={{
                      width: '60px',
                      textAlign: 'center',
                      padding: '4px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                    min="0"
                  />
                  
                  <div
                    onClick={() => {
                      setOrgData({...orgData, workerCount: orgData.workerCount + 1});
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backgroundColor: 'white',
                      userSelect: 'none'
                    }}
                  >
                    +
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-1">£1.50/month each</p>
              </div>
              
              <div className="bg-gray-100 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Monthly Total:</span>
                  <span className="text-2xl font-bold text-black">
                    £{((orgData.managerCount * 25) + (orgData.workerCount * 1.5)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

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
                  minLength={8}
                />
              </div>
            </div>

            <button
              onClick={handleCreateOrganization}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading ? '#ccc' : '#702D30',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating Account...' : 'Continue to Payment'}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}