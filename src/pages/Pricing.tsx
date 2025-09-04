import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ArrowLeft } from 'lucide-react';

export default function Pricing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-muted-foreground">Pay only for the users you need</p>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-3xl">Monthly Subscription</CardTitle>
            <CardDescription className="text-lg mt-2">Billed monthly, cancel anytime</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 p-6 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Admin Users</h3>
                  <p className="text-muted-foreground">Full access to manage workers, jobs, and reports</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">£25</p>
                  <p className="text-sm text-muted-foreground">per admin/month</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 p-6 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold">Workers</h3>
                  <p className="text-muted-foreground">Clock in/out, view timesheets, submit expenses</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">£1.50</p>
                  <p className="text-sm text-muted-foreground">per worker/month</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <p className="text-center text-sm text-muted-foreground mb-6">All prices exclude VAT</p>
              
              <div className="space-y-3">
                <div className="flex items-start">
                  <Check className="h-5 w-5 text-primary mr-3 mt-0.5" />
                  <span>Unlimited jobs and projects</span>
                </div>
                <div className="flex items-start">
                  <Check className="h-5 w-5 text-primary mr-3 mt-0.5" />
                  <span>Real-time GPS tracking</span>
                </div>
                <div className="flex items-start">
                  <Check className="h-5 w-5 text-primary mr-3 mt-0.5" />
                  <span>Photo verification</span>
                </div>
                <div className="flex items-start">
                  <Check className="h-5 w-5 text-primary mr-3 mt-0.5" />
                  <span>Xero integration</span>
                </div>
                <div className="flex items-start">
                  <Check className="h-5 w-5 text-primary mr-3 mt-0.5" />
                  <span>Weekly &amp; monthly reports</span>
                </div>
                <div className="flex items-start">
                  <Check className="h-5 w-5 text-primary mr-3 mt-0.5" />
                  <span>Email support</span>
                </div>
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg"
              onClick={() => navigate('/demo-request')}
            >
              Request Demo
            </Button>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <p className="text-muted-foreground">Questions? Email us at hello@hillwayco.uk</p>
        </div>
      </div>
    </div>
  );
}