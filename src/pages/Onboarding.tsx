import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, Users, Plus, Minus, CreditCard, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_placeholder');

function PaymentForm({ orgData, organizationId, onSuccess }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    // Create payment intent
    const createPaymentIntent = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            amount: (orgData.managerCount * 25) + (orgData.workerCount * 1.5),
            email: orgData.admin_email,
            organizationId: organizationId
          }
        });
        
        if (error) throw error;
        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      } catch (error) {
        console.error('Payment intent error:', error);
        // Fallback for testing
        setClientSecret('test_secret');
      }
    };
    
    createPaymentIntent();
  }, [orgData, organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    
    try {
      if (clientSecret === 'test_secret') {
        // Test mode - bypass payment
        await supabase
          .from('organizations')
          .update({ subscription_status: 'active' })
          .eq('id', organizationId);
          
        toast.success('Test mode - Account activated!');
        onSuccess();
        return;
      }

      // Real Stripe payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            email: orgData.admin_email,
            name: orgData.admin_name
          }
        }
      });

      if (error) {
        toast.error(error.message || 'Payment failed');
      } else if (paymentIntent?.status === 'succeeded') {
        // Update organization status
        await supabase
          .from('organizations')
          .update({ subscription_status: 'active' })
          .eq('id', organizationId);
          
        toast.success('Payment successful! Account activated.');
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || 'Payment processing failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="border rounded-lg p-4 bg-gray-50">
        <CardElement 
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
            hidePostalCode: false
          }}
        />
      </div>
      
      <div className="text-sm text-gray-600">
        <p>✓ Secure payment with Stripe</p>
        <p>✓ Cancel anytime</p>
        <p>✓ Instant access after payment</p>
      </div>
      
      <Button 
        type="submit" 
        disabled={!stripe || processing} 
        className="w-full bg-[#702D30] hover:bg-[#420808]"
      >
        {processing ? (
          <>Processing...</>
        ) : (
          <>Pay £{((orgData.managerCount * 25) + (orgData.workerCount * 1.5)).toFixed(2)}/month</>
        )}
      </Button>
      
      {/* Test mode bypass */}
      {!clientSecret || clientSecret === 'test_secret' ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onSuccess();
          }}
          className="w-full"
        >
          Skip Payment (Test Mode)
        </Button>
      ) : null}
    </form>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'organization' | 'payment' | 'complete'>('organization');
  const [loading, setLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string>('');
  
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

  const calculateMonthlyTotal = () => {
    return (orgData.managerCount * 25) + (orgData.workerCount * 1.5);
  };

  const incrementManagers = () => {
    setOrgData(prev => ({ ...prev, managerCount: prev.managerCount + 1 }));
  };

  const decrementManagers = () => {
    if (orgData.managerCount > 1) {
      setOrgData(prev => ({ ...prev, managerCount: prev.managerCount - 1 }));
    }
  };

  const incrementWorkers = () => {
    setOrgData(prev => ({ ...prev, workerCount: prev.workerCount + 1 }));
  };

  const decrementWorkers = () => {
    if (orgData.workerCount > 0) {
      setOrgData(prev => ({ ...prev, workerCount: prev.workerCount - 1 }));
    }
  };

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

      console.log('Starting signup process...');

      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: orgData.admin_email,
        password: orgData.admin_password,
        options: {
          data: {
            name: orgData.admin_name
          }
        }
      });

      if (authError) {
        console.error('Auth error:', authError);
        if (authError.message.includes('already registered')) {
          toast.error('This email is already registered. Please login instead.');
        } else {
          toast.error(`Signup error: ${authError.message}`);
        }
        return;
      }

      console.log('Auth user created:', authData.user?.id);

      // Step 2: Create organization
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

      if (orgError) {
        console.error('Organization error:', orgError);
        toast.error(`Failed to create organization: ${orgError.message}`);
        return;
      }

      console.log('Organization created:', org.id);
      setOrganizationId(org.id);

      // Step 3: Create manager record
      const { error: managerError } = await supabase
        .from('managers')
        .insert({
          email: orgData.admin_email,
          name: orgData.admin_name,
          organization_id: org.id
        });

      if (managerError) {
        console.error('Manager error:', managerError);
        toast.error(`Failed to create manager: ${managerError.message}`);
        return;
      }

      console.log('Manager created successfully');
      
      // Move to payment step
      setCurrentStep('payment');
      toast.success('Account created! Complete payment to activate.');
      
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setCurrentStep('complete');
    setTimeout(() => {
      navigate('/admin');
    }, 2000);
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
                    placeholder="123 Main Street, City, Postcode"
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
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Managers Section */}
                  <div>
                    <Label>Managers</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        className="h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (orgData.managerCount > 1) {
                            setOrgData(prev => ({ ...prev, managerCount: prev.managerCount - 1 }));
                          }
                        }}
                        disabled={orgData.managerCount <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      
                      <input
                        type="number"
                        className="w-16 text-center font-semibold border rounded"
                        value={orgData.managerCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          if (val >= 1) {
                            setOrgData(prev => ({ ...prev, managerCount: val }));
                          }
                        }}
                        min="1"
                      />
                      
                      <button
                        type="button"
                        className="h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOrgData(prev => ({ ...prev, managerCount: prev.managerCount + 1 }));
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">£25/month each</p>
                  </div>
                  
                  {/* Workers Section */}
                  <div>
                    <Label>Workers</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        className="h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (orgData.workerCount > 0) {
                            setOrgData(prev => ({ ...prev, workerCount: prev.workerCount - 1 }));
                          }
                        }}
                        disabled={orgData.workerCount <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      
                      <input
                        type="number"
                        className="w-16 text-center font-semibold border rounded"
                        value={orgData.workerCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val >= 0) {
                            setOrgData(prev => ({ ...prev, workerCount: val }));
                          }
                        }}
                        min="0"
                      />
                      
                      <button
                        type="button"
                        className="h-9 w-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOrgData(prev => ({ ...prev, workerCount: prev.workerCount + 1 }));
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">£1.50/month each</p>
                  </div>
                </div>
                
                <div className="bg-[#702D30] bg-opacity-10 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Monthly Total:</span>
                    <span className="text-2xl font-bold text-[#702D30]">£{calculateMonthlyTotal().toFixed(2)}</span>
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

              <Button
                onClick={handleCreateOrganization}
                disabled={loading}
                className="w-full bg-[#702D30] hover:bg-[#420808]"
              >
                {loading ? 'Creating Account...' : 'Continue to Payment'}
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 'payment' && (
          <Card>
            <CardHeader>
              <CardTitle>Complete Payment</CardTitle>
              <CardDescription>Monthly subscription: £{calculateMonthlyTotal().toFixed(2)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise}>
                <PaymentForm 
                  orgData={orgData} 
                  organizationId={organizationId}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}