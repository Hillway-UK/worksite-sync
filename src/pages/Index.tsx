import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AutoTimeLogo } from '@/components/AutoTimeLogo';
import { DemoRequestModal } from '@/components/DemoRequestModal';
import { Clock, MapPin, Users, BarChart3, Shield, Smartphone, Mail } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Clock className="h-6 w-6" />,
      title: 'GPS Time Tracking',
      description: 'Accurate clock-in/out with location verification and photo capture'
    },
    {
      icon: <MapPin className="h-6 w-6" />,
      title: 'Job Site Management',
      description: 'Geofenced job sites ensure workers can only clock in at approved locations'
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Team Management',
      description: 'Manage workers, set hourly rates, and track team performance'
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: 'Detailed Reports',
      description: 'Generate timesheets, expense reports, and analytics for payroll'
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: 'Secure & Compliant',
      description: 'Bank-level security with GDPR compliance and data encryption'
    },
    {
      icon: <Smartphone className="h-6 w-6" />,
      title: 'Mobile First',
      description: 'Works perfectly on any device - phone, tablet, or desktop'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <AutoTimeLogo className="h-10 w-10" />
              <div>
                <h1 className="text-xl font-bold text-primary">TimeTrack</h1>
                <p className="text-sm text-muted-foreground">Workforce Management</p>
              </div>
            </div>
            <div className="flex space-x-4">
              <DemoRequestModal>
                <Button variant="ghost">
                  <Mail className="h-4 w-4 mr-2" />
                  Request Demo
                </Button>
              </DemoRequestModal>
              <Button variant="ghost" onClick={() => navigate('/login')}>
                Sign In
              </Button>
              <Button onClick={() => navigate('/onboarding')}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Effortless Time Tracking for
            <span className="text-primary block">Construction Teams</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            GPS-verified clock-in/out, automatic timesheets, and powerful reporting. 
            Built specifically for construction companies who need accurate time tracking.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/onboarding')} className="px-8">
              Get Started Today
            </Button>
            <DemoRequestModal>
              <Button size="lg" variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Request Demo
              </Button>
            </DemoRequestModal>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Professional time tracking starts here | Pay monthly | Cancel anytime
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need for Time Tracking
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From GPS verification to detailed reports, TimeTrack has all the tools 
              to streamline your workforce management.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            Pay only for active users. Scale up or down as your team changes.
          </p>
          
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Pay Per User</CardTitle>
              <CardDescription>Monthly billing based on active users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-left space-y-2">
                <div className="flex justify-between">
                  <span>Managers & Admins</span>
                  <span className="font-bold">£25/month</span>
                </div>
                <div className="flex justify-between">
                  <span>Workers</span>
                  <span className="font-bold">£1.50/month</span>
                </div>
              </div>
              <hr />
              <div className="text-sm text-muted-foreground">
                <p>No setup fees</p>
                <p>Cancel anytime</p>
                <p>Only pay for active users</p>
                <p>Professional support included</p>
              </div>
              <Button className="w-full" onClick={() => navigate('/onboarding')}>
                Get Started Today
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <AutoTimeLogo className="h-8 w-8" />
            <span className="text-lg font-semibold">TimeTrack</span>
          </div>
          <p className="text-muted-foreground">
            Professional time tracking for construction teams
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;




