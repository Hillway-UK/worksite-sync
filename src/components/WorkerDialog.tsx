import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit } from 'lucide-react';

const workerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  hourly_rate: z.number().min(0, 'Hourly rate must be positive'),
});

type WorkerFormData = z.infer<typeof workerSchema>;

interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  hourly_rate: number;
  is_active: boolean;
}

interface WorkerDialogProps {
  worker?: Worker;
  onSave: () => void;
  trigger?: React.ReactNode;
}

export function WorkerDialog({ worker, onSave, trigger }: WorkerDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

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
    } : {
      name: '',
      email: '',
      phone: '',
      hourly_rate: 25,
    },
  });

  const onSubmit = async (data: WorkerFormData) => {
    setLoading(true);
    try {
      if (worker) {
        // Update existing worker
        const { error } = await supabase
          .from('workers')
          .update({
            name: data.name,
            phone: data.phone || null,
            hourly_rate: data.hourly_rate,
          })
          .eq('id', worker.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Worker updated successfully",
        });
      } else {
        // Create new worker
        const { error: workerError } = await supabase
          .from('workers')
          .insert({
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            hourly_rate: data.hourly_rate,
          });

        if (workerError) throw workerError;

        // Create auth user with temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + '!1A';
        
        const { error: authError } = await supabase.auth.admin.createUser({
          email: data.email,
          password: tempPassword,
          email_confirm: true,
        });

        if (authError) {
          console.warn('Auth user creation failed:', authError);
          // Don't throw - worker was created successfully
        }

        toast({
          title: "Success",
          description: `Worker created successfully. Temporary password: ${tempPassword}`,
          duration: 10000,
        });
      }

      setOpen(false);
      reset();
      onSave();
    } catch (error) {
      console.error('Error saving worker:', error);
      toast({
        title: "Error",
        description: "Failed to save worker",
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {worker ? 'Edit Worker' : 'Add New Worker'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              placeholder="worker@company.com"
              disabled={!!worker}
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
            )}
            {worker && (
              <p className="text-xs text-muted-foreground mt-1">
                Email cannot be changed after creation
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
  );
}