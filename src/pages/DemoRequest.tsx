import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function DemoRequest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    adminUsers: 1,
    workers: 5,
    message: '',
    honeypot: '' // Hidden field for bot detection
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Save to database
      const { error: dbError } = await supabase
        .from('demo_requests')
        .insert({
          name: formData.name,
          email: formData.email,
          company: formData.company,
          phone: formData.phone,
          admin_users: formData.adminUsers,
          worker_count: formData.workers,
          message: formData.message,
          status: 'pending'
        });

      if (dbError) throw dbError;

      // Send email notification
      const { error: emailError } = await supabase.functions.invoke('send-demo-request', {
        body: {
          name: formData.name,
          email: formData.email,
          company: formData.company,
          phone: formData.phone,
          admin_users: formData.adminUsers,
          worker_count: formData.workers,
          message: formData.message,
          honeypot: formData.honeypot,
          monthly_cost: (formData.adminUsers * 25 + formData.workers * 1.5).toFixed(2)
        }
      });

      if (emailError) {
        console.warn('Email notification failed:', emailError);
      }

      toast.success('Demo request sent! We\'ll be in touch within 24 hours.');
      navigate('/');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Failed to send request. Please email us directly at hello@hillwayco.uk');
    } finally {
      setLoading(false);
    }
  };

  const monthlyTotal = (formData.adminUsers * 25) + (formData.workers * 1.5);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/pricing')}
          className="mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Pricing
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Request Your Demo</CardTitle>
            <p className="text-muted-foreground">We'll set up your account and get you started</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Your Name *</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Number of Admin Users</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.adminUsers}
                    onChange={(e) => setFormData({...formData, adminUsers: parseInt(e.target.value) || 1})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">£25 per admin/month</p>
                </div>
                <div>
                  <Label>Number of Workers</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.workers}
                    onChange={(e) => setFormData({...formData, workers: parseInt(e.target.value) || 0})}
                  />
                  <p className="text-xs text-muted-foreground mt-1">£1.50 per worker/month</p>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span>Estimated Monthly Cost:</span>
                  <span className="text-xl font-bold text-primary">£{monthlyTotal.toFixed(2)} + VAT</span>
                </div>
              </div>

              <div>
                <Label>Message (Optional)</Label>
                <Textarea
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  placeholder="Tell us about your requirements..."
                />
              </div>

              {/* Honeypot field - hidden from users but visible to bots */}
              <div style={{ position: 'absolute', left: '-9999px' }}>
                <Label htmlFor="website">Website (leave blank)</Label>
                <Input
                  id="website"
                  type="text"
                  value={formData.honeypot}
                  onChange={(e) => setFormData({...formData, honeypot: e.target.value})}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Demo Request'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}