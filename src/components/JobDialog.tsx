import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, MapPin } from 'lucide-react';
import { MapComponent } from './MapComponent';

const jobSchema = z.object({
  code: z.string().min(1, 'Job code is required'),
  name: z.string().min(1, 'Job name is required'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.number(),
  longitude: z.number(),
  geofence_radius: z.number().min(50).max(500),
});

type JobFormData = z.infer<typeof jobSchema>;

interface Job {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  is_active: boolean;
}

interface JobDialogProps {
  job?: Job;
  onSave: () => void;
  trigger?: React.ReactNode;
}

export function JobDialog({ job, onSave, trigger }: JobDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | undefined>(
    job ? [job.latitude, job.longitude] : undefined
  );
  const [radius, setRadius] = useState(job?.geofence_radius || 100);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: job ? {
      code: job.code,
      name: job.name,
      address: job.address,
      latitude: job.latitude,
      longitude: job.longitude,
      geofence_radius: job.geofence_radius,
    } : {
      code: '',
      name: '',
      address: '',
      latitude: 51.5074,
      longitude: -0.1278,
      geofence_radius: 100,
    },
  });

  const onSubmit = async (data: JobFormData) => {
    if (!selectedLocation) {
      toast({
        title: "Error",
        description: "Please select a location on the map",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const jobData = {
        code: data.code,
        name: data.name,
        address: data.address,
        latitude: selectedLocation[0],
        longitude: selectedLocation[1],
        geofence_radius: radius,
      };

      if (job) {
        // Update existing job
        const { error } = await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', job.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Job updated successfully",
        });
      } else {
        // Create new job
        const { error } = await supabase
          .from('jobs')
          .insert(jobData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Job created successfully",
        });
      }

      setOpen(false);
      reset();
      onSave();
    } catch (error) {
      console.error('Error saving job:', error);
      toast({
        title: "Error",
        description: "Failed to save job",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedLocation([lat, lng]);
    setValue('latitude', lat);
    setValue('longitude', lng);
  };

  const defaultTrigger = (
    <Button variant={job ? "outline" : "default"} size={job ? "sm" : "default"}>
      {job ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-2" />}
      {job ? '' : 'Add New Job'}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {job ? 'Edit Job' : 'Add New Job'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Job Code</Label>
              <Input
                id="code"
                {...register('code')}
                placeholder="e.g., SITE001"
              />
              {errors.code && (
                <p className="text-sm text-destructive mt-1">{errors.code.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="name">Job Name</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Construction Site Name"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              {...register('address')}
              placeholder="Full address of the job site"
            />
            {errors.address && (
              <p className="text-sm text-destructive mt-1">{errors.address.message}</p>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              Location (Click on map to set)
            </Label>
            <MapComponent
              center={selectedLocation || [51.5074, -0.1278]}
              onLocationSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
              radius={radius}
            />
          </div>

          <div>
            <Label>Geofence Radius: {radius} meters</Label>
            <div className="mt-2">
              <Slider
                value={[radius]}
                onValueChange={(value) => setRadius(value[0])}
                min={50}
                max={500}
                step={10}
                className="w-full"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>50m</span>
              <span>500m</span>
            </div>
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
              {loading ? 'Saving...' : (job ? 'Update' : 'Create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}