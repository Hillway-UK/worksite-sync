import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Shield } from 'lucide-react';
import { SecureFormWrapper } from '@/components/SecureFormWrapper';
import { z } from 'zod';

// Enhanced validation schema
const demoRequestSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Valid email is required')
    .max(255, 'Email must be less than 255 characters'),
  company: z.string()
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(200, 'Company name must be less than 200 characters'),
  phone: z.string()
    .trim()
    .optional()
    .refine(val => !val || /^[\d\s\-\+\(\)]{7,20}$/.test(val), 'Invalid phone number format'),
  message: z.string()
    .trim()
    .max(1000, 'Message must be less than 1000 characters')
    .optional(),
  honeypot: z.string().max(0, 'Bot detection triggered').optional(),
});

interface DemoRequestModalProps {
  children: React.ReactNode;
}

export const DemoRequestModal: React.FC<DemoRequestModalProps> = ({ children }) => {
  const [open, setOpen] = useState(false);

  const handleSecureSubmit = async (data: z.infer<typeof demoRequestSchema>) => {
    try {
      // Check honeypot for bot detection
      if (data.honeypot && data.honeypot.length > 0) {
        toast.error('Bot detection triggered');
        return;
      }

      const { error } = await supabase.functions.invoke('send-demo-request', {
        body: {
          name: data.name,
          email: data.email,
          company: data.company,
          phone: data.phone || '',
          message: data.message || '',
          honeypot: '', // Always send empty honeypot
        }
      });

      if (error) throw error;

      toast.success('Demo request submitted successfully! We\'ll be in touch soon.');
      setOpen(false);
    } catch (error: any) {
      // Secure logging - no sensitive data exposed
      toast.error(error.message || 'Failed to submit demo request');
      throw error; // Re-throw to let SecureFormWrapper handle it
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Request a Demo
            <Shield className="h-4 w-4 text-green-600 ml-auto" />
          </DialogTitle>
        </DialogHeader>
        
        <SecureFormWrapper
          schema={demoRequestSchema}
          onSubmit={handleSecureSubmit}
          defaultValues={{
            name: '',
            email: '',
            company: '',
            phone: '',
            message: '',
            honeypot: '',
          }}
          requireCSRF={true}
          rateLimit={{
            key: 'demo-request',
            maxRequests: 2,
            windowMs: 300000, // 5 minutes
          }}
          title="Secure Demo Request"
          description="Your information is protected with enterprise-grade security"
        >
          {({ register, formState: { errors, isSubmitting } }) => (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="John Smith"
                    maxLength={100}
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="john@company.com"
                    maxLength={255}
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company">Company *</Label>
                  <Input
                    id="company"
                    {...register('company')}
                    placeholder="ABC Construction"
                    maxLength={200}
                    disabled={isSubmitting}
                  />
                  {errors.company && (
                    <p className="text-sm text-destructive mt-1">{errors.company.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    {...register('phone')}
                    placeholder="0114 123 4567"
                    maxLength={20}
                    disabled={isSubmitting}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  {...register('message')}
                  placeholder="Tell us about your needs..."
                  rows={3}
                  maxLength={1000}
                  disabled={isSubmitting}
                />
                {errors.message && (
                  <p className="text-sm text-destructive mt-1">{errors.message.message}</p>
                )}
              </div>

              {/* Honeypot field - hidden from users but visible to bots */}
              <div style={{ position: 'absolute', left: '-9999px' }}>
                <Label htmlFor="website">Website (leave blank)</Label>
                <Input
                  id="website"
                  type="text"
                  {...register('honeypot')}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Sending...' : 'Request Demo'}
                </Button>
              </div>
            </>
          )}
        </SecureFormWrapper>
      </DialogContent>
    </Dialog>
  );
};