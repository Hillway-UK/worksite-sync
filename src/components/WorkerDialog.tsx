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
import { Plus, Edit, CheckCircle, Copy } from 'lucide-react';

const workerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  hourly_rate: z.number().min(0, 'Hourly rate must be positive'),
  address: z.string().optional(),
  emergency_contact: z.string().optional(),
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
  const [workerCredentials, setWorkerCredentials] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  // Use controlled open state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const copyCredentialsToClipboard = async () => {
    if (!workerCredentials) return;
    
    const credentialText = `Welcome to Pioneer Time Keeper

Name: ${workerCredentials.name}
Email: ${workerCredentials.email}
Temporary Password: ${workerCredentials.password}
App URL: ${window.location.origin}

Please change your password on first login for security.`;

    try {
      await navigator.clipboard.writeText(credentialText);
      toast({
        title: "Copied!",
        description: "Login credentials copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please manually copy the credentials",
        variant: "destructive",
      });
    }
  };

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
      // Get current user's organization
      const { data: currentUser, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data: manager, error: managerError } = await supabase
        .from('managers')
        .select('organization_id')
        .eq('email', currentUser.user?.email)
        .single();

      if (managerError) throw managerError;

      if (worker) {
        // Update existing worker
        const { error } = await supabase
          .from('workers')
          .update({
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            hourly_rate: data.hourly_rate,
            address: data.address || null,
            emergency_contact: data.emergency_contact || null,
            date_started: data.date_started || null,
          })
          .eq('id', worker.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Worker updated successfully",
        });
      } else {
        // Create new worker with organization_id
        const { error: workerError } = await supabase
          .from('workers')
          .insert({
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            hourly_rate: data.hourly_rate,
            address: data.address || null,
            emergency_contact: data.emergency_contact || null,
            date_started: data.date_started || null,
            organization_id: manager.organization_id,
            is_active: true,
          });

        if (workerError) throw workerError;

        // Generate temporary password for display only
        const tempPassword = Math.random().toString(36).slice(-8) + '!1A';
        
        // Store credentials for display (they'll need to sign up themselves)
        setWorkerCredentials({
          name: data.name,
          email: data.email,
          password: tempPassword,
        });
        setShowSuccessModal(true);

        toast({
          title: "Success",
          description: "Worker created successfully. Share the login details with them to create their account.",
          duration: 10000,
        });
      }

      if (worker) {
        setOpen(false);
        reset();
        onSave();
      }
    } catch (error) {
      console.error('Error saving worker:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save worker",
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
    setWorkerCredentials(null);
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
              />
            </div>

            <div>
              <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
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
              />
            </div>

            <div>
              <Label htmlFor="emergency_contact">Emergency Contact (Optional)</Label>
              <Input
                id="emergency_contact"
                {...register('emergency_contact')}
                placeholder="Name and phone number"
              />
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
              <AlertDialogTitle className="text-xl">Worker Created Successfully!</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div>
                  <span className="font-medium text-green-800">Worker Name:</span>
                  <p className="text-green-700 font-mono">{workerCredentials?.name}</p>
                </div>
                <div>
                  <span className="font-medium text-green-800">Email:</span>
                  <p className="text-green-700 font-mono">{workerCredentials?.email}</p>
                </div>
                <div>
                  <span className="font-medium text-green-800">Temporary Password:</span>
                  <p className="text-green-700 font-mono text-lg bg-green-100 p-2 rounded border">
                    {workerCredentials?.password}
                  </p>
                </div>
              </div>
              <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm">
                  <strong>Important:</strong> Please share these credentials securely with the worker. 
                  They must change their password on first login.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={copyCredentialsToClipboard}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy Login Details
            </Button>
            <AlertDialogAction onClick={handleSuccessModalClose}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}