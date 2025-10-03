import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, CheckCircle } from 'lucide-react';

// Enhanced validation schema with better security
const workerSchema = z.object({
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
  phone: z.string()
    .trim()
    .optional()
    .refine(val => !val || /^[\d\s\-\+\(\)]{7,20}$/.test(val), 'Invalid phone number format'),
  hourly_rate: z.number()
    .min(0, 'Hourly rate must be positive')
    .max(1000, 'Hourly rate must be reasonable'),
  address: z.string().trim().max(500, 'Address must be less than 500 characters').optional(),
  emergency_contact: z.string().trim().max(200, 'Emergency contact must be less than 200 characters').optional(),
  date_started: z.string().optional(),
});

type WorkerFormData = z.infer<typeof workerSchema>;

interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  hourly_rate: number;
  is_active: boolean;
  address?: string | null;
  emergency_contact?: string | null;
  date_started?: string | null;
}

interface WorkerDialogProps {
  worker?: Worker;
  onSave: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function WorkerDialog({ worker, onSave, trigger, open: controlledOpen, onOpenChange }: WorkerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [invitationType, setInvitationType] = useState<'invite' | 'reset' | null>(null);

  // Use controlled open state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;


  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: worker ? {
      name: worker.name,
      email: worker.email,
      phone: worker.phone || '',
      hourly_rate: worker.hourly_rate,
      address: worker.address || '',
      emergency_contact: worker.emergency_contact || '',
      date_started: worker.date_started || '',
    } : {
      name: '',
      email: '',
      phone: '',
      hourly_rate: 25,
      address: '',
      emergency_contact: '',
      date_started: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = async (data: WorkerFormData) => {
    setLoading(true);
    
    try {
      const { data: user, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user?.user?.email) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to manage workers",
          variant: "destructive",
        });
        return;
      }

      // Get the manager's organization ID with better error handling
      const { data: managerData, error: managerError } = await supabase
        .from('managers')
        .select('organization_id')
        .eq('email', user.user.email)
        .maybeSingle();

      if (managerError) {
        toast({
          title: "Database Error",
          description: `Failed to fetch manager data: ${managerError.message}`,
          variant: "destructive",
        });
        return;
      }

      if (!managerData?.organization_id) {
        toast({
          title: "Organization Error",
          description: "Could not find your organization. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      // Check for duplicate email (only for new workers)
      if (!worker) {
        const { data: existingWorker, error: duplicateError } = await supabase
          .from('workers')
          .select('id')
          .eq('email', data.email)
          .eq('organization_id', managerData.organization_id)
          .maybeSingle();

        if (duplicateError) {
          toast({
            title: "Database Error",
            description: `Failed to check for existing worker: ${duplicateError.message}`,
            variant: "destructive",
          });
          return;
        }

        if (existingWorker) {
          toast({
            title: "Duplicate Worker",
            description: "A worker with this email already exists in your organization",
            variant: "destructive",
          });
          return;
        }
      }

      // Prepare worker data with proper sanitization
      const workerData = {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        address: data.address || null,
        emergency_contact: data.emergency_contact || null,
        date_started: data.date_started || null,
        organization_id: managerData.organization_id,
        hourly_rate: data.hourly_rate,
        is_active: true,
      };

      if (worker) {
        // Update existing worker - no auth user creation needed
        const { error } = await supabase
          .from('workers')
          .update(workerData)
          .eq('id', worker.id);

        if (error) {
          toast({
            title: "Update Failed",
            description: `Failed to update worker: ${error.message}`,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Success",
          description: "Worker updated successfully",
        });

        setOpen(false);
        reset();
        onSave();
      } else {
        // Create new worker - send invitation email via edge function
        
        // First create the worker database record
        const { error: workerError } = await supabase
          .from('workers')
          .insert(workerData);

        if (workerError) {
          toast({
            title: "Creation Failed", 
            description: `Failed to add worker: ${workerError.message}`,
            variant: "destructive",
          });
          return;
        }

        // Then send invitation email via edge function
        const { data: inviteResult, error: inviteError } = await supabase.functions.invoke('invite-worker', {
          body: {
            email: data.email,
            name: data.name,
            organizationId: managerData.organization_id,
          },
        });

        if (inviteError) {
          toast({
            title: "Invitation Failed",
            description: `Worker created but failed to send invitation: ${inviteError.message}`,
            variant: "destructive",
          });
          // Still call onSave to refresh the list
          onSave();
          setOpen(false);
          reset();
          return;
        }

        if (!inviteResult?.success) {
          toast({
            title: "Invitation Failed",
            description: `Worker created but: ${inviteResult?.error || 'Unknown error'}`,
            variant: "destructive",
          });
          onSave();
          setOpen(false);
          reset();
          return;
        }

        // Show success modal with invitation type
        setInvitationType(inviteResult.type);
        setShowSuccessModal(true);

        toast({
          title: "Success",
          description: inviteResult.type === 'invite' 
            ? "Worker created and invitation email sent!"
            : "Worker created and password reset email sent!",
          duration: 5000,
        });
      }
      
    } catch (error: any) {
      toast({
        title: "Unexpected Error",
        description: `An unexpected error occurred: ${error?.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button variant={worker ? "outline" : "default"} size={worker ? "sm" : "default"}>
      {worker ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-2" />}
      {worker ? '' : 'Add New Worker'}
    </Button>
  );

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    setInvitationType(null);
    setOpen(false);
    reset();
    onSave();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
            <DialogTitle>
              {worker ? 'Edit Worker' : 'Add New Worker'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Enter worker's full name"
                maxLength={100}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-body font-semibold text-[#111111]">
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="worker@example.com"
                className="font-body border-[#939393] focus:border-[#702D30] focus:ring-[#702D30]"
                maxLength={255}
                required
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
              )}
              {worker && (
                <p className="text-xs text-[#939393] font-body">
                  Changing email will require the worker to login with the new email address
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="Enter phone number"
                maxLength={20}
              />
              {errors.phone && (
                <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                min="0"
                max="1000"
                {...register('hourly_rate', { valueAsNumber: true })}
                placeholder="25.00"
              />
              {errors.hourly_rate && (
                <p className="text-sm text-destructive mt-1">{errors.hourly_rate.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                {...register('address')}
                placeholder="Home address"
                maxLength={500}
              />
              {errors.address && (
                <p className="text-sm text-destructive mt-1">{errors.address.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="emergency_contact">Emergency Contact (Optional)</Label>
              <Input
                id="emergency_contact"
                {...register('emergency_contact')}
                placeholder="Name and phone number"
                maxLength={200}
              />
              {errors.emergency_contact && (
                <p className="text-sm text-destructive mt-1">{errors.emergency_contact.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="date_started">Start Date</Label>
              <Input
                id="date_started"
                type="date"
                {...register('date_started')}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : (worker ? 'Update' : 'Create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <AlertDialogTitle className="text-xl">
                {invitationType === 'invite' ? 'Invitation Sent!' : 'Reset Email Sent!'}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                {invitationType === 'invite' ? (
                  <>
                    <p className="text-green-800">
                      ✅ An invitation email has been sent to the worker with instructions to set their password.
                    </p>
                    <p className="text-green-700 text-sm">
                      The worker will receive an email with a secure link to create their password and access the system.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-green-800">
                      ✅ A password reset email has been sent to the worker (user already existed).
                    </p>
                    <p className="text-green-700 text-sm">
                      The worker will receive an email with a secure link to reset their password and access the system.
                    </p>
                  </>
                )}
              </div>
              <div className="text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm">
                  <strong>Note:</strong> No plaintext passwords are sent via email. 
                  The worker will set their own secure password using the link.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleSuccessModalClose}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}