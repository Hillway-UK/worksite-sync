import React, { useState, useEffect } from 'react'; // Fixed useEffect import
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
import { LeafletMap } from './LeafletMap';
import { validatePostcode, geocodePostcode, formatLegacyAddress, formatPostcode } from '@/lib/postcode-utils';

const jobSchema = z.object({
  code: z.string().min(1, 'Job code is required'),
  name: z.string().min(1, 'Job name is required'),
  address_line_1: z.string().min(1, 'Address Line 1 is required'),
  address_line_2: z.string().optional(),
  city: z.string().min(1, 'City/Town is required'),
  county: z.string().optional(),
  postcode: z.string().min(1, 'Postcode is required').refine(
    (val) => validatePostcode(val),
    { message: 'Invalid UK postcode format' }
  ),
  latitude: z.number(),
  longitude: z.number(),
  geofence_radius: z.number().min(50).max(500),
});

type JobFormData = z.infer<typeof jobSchema>;

interface Job {
  id: string;
  code: string;
  name: string;
  address: string; // Legacy field
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  county?: string;
  postcode?: string;
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
  const [geocoding, setGeocoding] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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
      address_line_1: job.address_line_1 || '',
      address_line_2: job.address_line_2 || '',
      city: job.city || '',
      county: job.county || '',
      postcode: job.postcode || '',
      latitude: job.latitude,
      longitude: job.longitude,
      geofence_radius: job.geofence_radius,
    } : {
      code: '',
      name: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      county: '',
      postcode: '',
      latitude: 51.5074,
      longitude: -0.1278,
      geofence_radius: 100,
    },
  });

  // Watch postcode field for auto-geocoding
  const watchedPostcode = watch('postcode');

  // Auto-geocode when postcode changes (only after initial load)
  useEffect(() => {
    const handleGeocoding = async () => {
      if (!watchedPostcode || !validatePostcode(watchedPostcode) || geocoding || isInitialLoad) return;
      
      setGeocoding(true);
      try {
        const result = await geocodePostcode(watchedPostcode);
        if (result) {
          setSelectedLocation([result.latitude, result.longitude]);
          setValue('latitude', result.latitude);
          setValue('longitude', result.longitude);
          setValue('postcode', result.formatted_postcode);
          
          toast({
            title: "Success",
            description: "Location found and updated on map",
          });
        } else {
          toast({
            title: "Warning",
            description: "Could not find location for this postcode",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      } finally {
        setGeocoding(false);
      }
    };

    const timeoutId = setTimeout(handleGeocoding, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [watchedPostcode, isInitialLoad, geocoding, setValue]);

  // Reset initial load flag after component mounts and form is initialized
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 100); // Small delay to ensure form is fully initialized
      return () => clearTimeout(timer);
    } else {
      setIsInitialLoad(true); // Reset when dialog closes
    }
  }, [open]);

  const onSubmit = async (data: JobFormData) => {
    console.log('Form submission started', data);
    console.log('Selected location:', selectedLocation);
    
    if (!selectedLocation) {
      toast({
        title: "Error",
        description: "Please select a location on the map or enter a valid postcode",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create legacy address field from structured data
      const legacyAddress = formatLegacyAddress(
        data.address_line_1,
        data.address_line_2,
        data.city,
        data.county,
        data.postcode
      );

      const jobData = {
        code: data.code,
        name: data.name,
        address: legacyAddress, // Legacy field for backward compatibility
        address_line_1: data.address_line_1,
        address_line_2: data.address_line_2 || null,
        city: data.city,
        county: data.county || null,
        postcode: formatPostcode(data.postcode),
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

          <div className="space-y-4">
            <div>
              <Label htmlFor="address_line_1">Address Line 1 *</Label>
              <Input
                id="address_line_1"
                {...register('address_line_1')}
                placeholder="House number and street name"
              />
              {errors.address_line_1 && (
                <p className="text-sm text-destructive mt-1">{errors.address_line_1.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="address_line_2">Address Line 2</Label>
              <Input
                id="address_line_2"
                {...register('address_line_2')}
                placeholder="Apartment, suite, etc. (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City/Town *</Label>
                <Input
                  id="city"
                  {...register('city')}
                  placeholder="City or town"
                />
                {errors.city && (
                  <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="county">County</Label>
                <Input
                  id="county"
                  {...register('county')}
                  placeholder="County (optional)"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="postcode" className="flex items-center gap-2">
                Postcode *
                {geocoding && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
              </Label>
              <Input
                id="postcode"
                {...register('postcode')}
                placeholder="e.g., SW1A 1AA"
                className="uppercase"
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  setValue('postcode', e.target.value);
                }}
              />
              {errors.postcode && (
                <p className="text-sm text-destructive mt-1">{errors.postcode.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Location will be automatically found when you enter a valid postcode
              </p>
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              Location (Click on map to set)
            </Label>
            <LeafletMap
              center={selectedLocation || [51.5074, -0.1278]}
              zoom={13}
              onLocationSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
              radius={radius}
              className="h-64 w-full"
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