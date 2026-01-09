import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Users, Clock, FileText, Shield } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-black">TimeTrack</h1>
          <div className="space-x-4">
            <Button variant="outline" onClick={() => navigate('/login')}>Login</Button>
            <Button className="bg-black hover:bg-gray-800" onClick={() => navigate('/pricing')}>View Pricing</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-5xl font-bold mb-6">TimeTrack - Geo Fenced Timesheet Management System </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Simple, powerful time tracking for construction companies. Track hours, manage workers, and export to Xero with ease.
        </p>
        <Button 
          size="lg" 
          className="bg-black hover:bg-gray-800"
          onClick={() => navigate('/pricing')}
        >
          View Pricing &amp; Request Demo
        </Button>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <Clock className="h-12 w-12 text-primary mb-4" />
              <CardTitle>Real-time Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Workers clock in/out with photo verification and GPS location tracking</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <Users className="h-12 w-12 text-primary mb-4" />
              <CardTitle>Team Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Manage multiple workers and admin users with role-based access control</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <FileText className="h-12 w-12 text-primary mb-4" />
              <CardTitle>Xero Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Export timesheets directly to Xero for seamless payroll processing</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-8">
            <h3 className="text-2xl font-bold mb-4">Ready to streamline your workforce management?</h3>
            <p className="text-muted-foreground mb-6">Get started with a personalized demo</p>
            <Button 
              size="lg" 
              className="bg-black hover:bg-gray-800"
              onClick={() => navigate('/demo-request')}
            >
              Request Your Demo
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}