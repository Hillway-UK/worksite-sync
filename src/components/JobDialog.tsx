import React, { useState, useEffect } from "react"; // Fixed useEffect import
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { LeafletMap } from "./LeafletMap";
import { validatePostcode, geocodePostcode, formatLegacyAddress, formatPostcode } from "@/lib/postcode-utils";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingTour } from "./onboarding/OnboardingTour";
import { addJobSteps } from "@/config/onboarding";
import { hasSeenAddJobTutorial, markAddJobTutorialSeen } from "@/lib/supabase/manager-tutorial";

const jobSchema = z.object({
  code: z.string().min(1, "Job code is required"),
  name: z.string().min(1, "Job name is required"),
  address_line_1: z.string().min(1, "Address Line 1 is required"),
  address_line_2: z.string().optional(),
  city: z.string().min(1, "City/Town is required"),
  county: z.string().optional(),
  postcode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  geofence_radius: z.number().min(50).max(500).optional(),
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
  show_rams_and_site_info?: boolean;
  terms_and_conditions_url?: string | null;
  waiver_url?: string | null;
  geofence_enabled?: boolean;
}

interface JobDialogProps {
  job?: Job;
  onSave: () => void;
  trigger?: React.ReactNode;
  triggerClassName?: string;
}

export function JobDialog({ job, onSave, trigger, triggerClassName }: JobDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | undefined>(
    job ? [job.latitude, job.longitude] : undefined,
  );
  const [radius, setRadius] = useState(job?.geofence_radius || 100);
  const [showTutorial, setShowTutorial] = useState(false);
  const [termsFile, setTermsFile] = useState<File | null>(null);
  const [waiverFile, setWaiverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [geofenceEnabled, setGeofenceEnabled] = useState(job?.geofence_enabled ?? true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: job
      ? {
          code: job.code,
          name: job.name,
          address_line_1: job.address_line_1 || "",
          address_line_2: job.address_line_2 || "",
          city: job.city || "",
          county: job.county || "",
          postcode: job.postcode || "",
          latitude: job.latitude,
          longitude: job.longitude,
          geofence_radius: job.geofence_radius,
        }
      : {
          code: "",
          name: "",
          address_line_1: "",
          address_line_2: "",
          city: "",
          county: "",
          postcode: "",
          latitude: 51.5074,
          longitude: -0.1278,
          geofence_radius: 100,
        },
  });

  const { organizationId, user } = useAuth();

  // Watch postcode field
  const watchedPostcode = watch("postcode");

  // Check if tutorial should be shown when dialog opens (only for new jobs)
  useEffect(() => {
    const checkTutorial = async () => {
      if (open && !job) {
        const hasSeenTutorial = await hasSeenAddJobTutorial();
        if (!hasSeenTutorial) {
          setTimeout(() => setShowTutorial(true), 500);
        }
      }
    };
    checkTutorial();
  }, [open, job]);

  const handleTutorialEnd = async () => {
    setShowTutorial(false);
    await markAddJobTutorialSeen();
  };

  const handleManualGeocode = async () => {
    if (!watchedPostcode || geocoding) return;

    setGeocoding(true);
    try {
      const result = await geocodePostcode(watchedPostcode);
      if (result && result.latitude !== 0 && result.longitude !== 0) {
        setSelectedLocation([result.latitude, result.longitude]);
        setValue("latitude", result.latitude);
        setValue("longitude", result.longitude);
        setValue("postcode", result.formatted_postcode);

        toast({
          title: "Location Found",
          description: `Coordinates: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`,
        });
      } else {
        toast({
          title: "Geocoding Services Unavailable",
          description:
            "All geocoding services are currently unavailable. Please click on the map below to manually set the job location.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      toast({
        title: "Geocoding Failed",
        description: "Unable to find location. Please click on the map to manually set the job location.",
        variant: "destructive",
      });
    } finally {
      setGeocoding(false);
    }
  };

  const handleDocumentUpload = async (file: File, type: "terms" | "waiver"): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage.from("job-documents").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      return filePath;
    } catch (error) {
      console.error(`Error uploading ${type} document:`, error);
      toast({
        title: "Upload Failed",
        description: `Failed to upload ${type === "terms" ? "RAMS" : "Site Instructions"} document`,
        variant: "destructive",
      });
      return null;
    }
  };

  const onSubmit = async (data: JobFormData) => {
    // Validate that we have a valid location only if geofencing is enabled
    if (geofenceEnabled && (!selectedLocation || (selectedLocation[0] === 0 && selectedLocation[1] === 0))) {
      toast({
        title: "Location Required",
        description:
          "Please click on the map to set the job location, or try the 'Find Location' button with a valid UK postcode.",
        variant: "destructive",
      });
      return;
    }

    // Ensure we have an organization ID (fallback lookup if context not ready)
    let orgId = organizationId;
    if (!orgId) {
      try {
        const email = user?.email ?? null;
        if (email) {
          const { data: m } = await supabase
            .from("managers")
            .select("organization_id")
            .eq("email", email)
            .maybeSingle();
          orgId = (m as any)?.organization_id ?? null;

          if (!orgId) {
            const { data: sa } = await supabase
              .from("super_admins")
              .select("organization_id")
              .eq("email", email)
              .maybeSingle();
            orgId = (sa as any)?.organization_id ?? null;
          }

          if (!orgId) {
            const { data: w } = await supabase
              .from("workers")
              .select("organization_id")
              .eq("email", email)
              .maybeSingle();
            orgId = (w as any)?.organization_id ?? null;
          }
        }
      } catch (e) {
        // Silently handle error
      }
    }

    if (!orgId) {
      toast({
        title: "Error",
        description: "No organization found for your account.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setUploading(true);
    try {
      // Upload documents if new files are selected
      let termsUrl = job?.terms_and_conditions_url || null;
      let waiverUrl = job?.waiver_url || null;

      if (termsFile) {
        const uploadedUrl = await handleDocumentUpload(termsFile, "terms");
        if (uploadedUrl) termsUrl = uploadedUrl;
      }

      if (waiverFile) {
        const uploadedUrl = await handleDocumentUpload(waiverFile, "waiver");
        if (uploadedUrl) waiverUrl = uploadedUrl;
      }

      // Create legacy address field from structured data
      const legacyAddress = formatLegacyAddress(
        data.address_line_1,
        data.address_line_2,
        data.city,
        data.county,
        data.postcode || "",
      );

      // Use selected location if geofencing is enabled, otherwise use UK center coordinates
      const finalLatitude = geofenceEnabled && selectedLocation ? selectedLocation[0] : 51.5074;
      const finalLongitude = geofenceEnabled && selectedLocation ? selectedLocation[1] : -0.1278;
      const finalRadius = geofenceEnabled ? radius : 100;
      const finalPostcode = geofenceEnabled && data.postcode ? formatPostcode(data.postcode) : null;

      // For new jobs, inherit the current show_rams_and_site_info value from existing jobs
      let showRamsValue = true; // Default value
      if (!job) {
        const { data: existingJobs } = await supabase
          .from('jobs')
          .select('show_rams_and_site_info')
          .eq('organization_id', orgId) as any;
        
        if (existingJobs && existingJobs.length > 0) {
          // Since global toggle sets all jobs to the same value, use the first one
          showRamsValue = existingJobs[0].show_rams_and_site_info !== false;
        }
      }

      const jobData = {
        code: data.code,
        name: data.name,
        address: legacyAddress, // Legacy field for backward compatibility
        address_line_1: data.address_line_1,
        address_line_2: data.address_line_2 || null,
        city: data.city,
        county: data.county || null,
        postcode: finalPostcode,
        latitude: finalLatitude,
        longitude: finalLongitude,
        geofence_radius: finalRadius,
        geofence_enabled: geofenceEnabled,
        terms_and_conditions_url: termsUrl,
        waiver_url: waiverUrl,
        ...(job ? {} : { show_rams_and_site_info: showRamsValue }),
      };

      if (job) {
        // Update existing job
        const { error } = await supabase.from("jobs").update(jobData).eq("id", job.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Job updated successfully",
        });
      } else {
        // Create new job
        const { error } = await supabase.from("jobs").insert({ ...jobData, organization_id: orgId });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Job created successfully",
        });
      }

      setOpen(false);
      reset();
      setTermsFile(null);
      setWaiverFile(null);
      onSave();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save job",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedLocation([lat, lng]);
    setValue("latitude", lat);
    setValue("longitude", lng);
  };

  const defaultTrigger = (
    <Button variant={job ? "outline" : "default"} size={job ? "sm" : "default"} className={triggerClassName}>
      {job ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-2" />}
      {job ? "" : "Add New Job"}
    </Button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
        <DialogContent
          className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => showTutorial && e.preventDefault()}
          onEscapeKeyDown={(e) => showTutorial && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{job ? "Edit Job" : "Add New Job"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="job-details-section space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Job Code</Label>
                  <Input id="code" {...register("code")} placeholder="e.g., SITE001" />
                  {errors.code && <p className="text-sm text-destructive mt-1">{errors.code.message}</p>}
                </div>

                <div>
                  <Label htmlFor="name">Job Name</Label>
                  <Input id="name" {...register("name")} placeholder="Construction Site Name" />
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>
              </div>

              {/* Document Upload Section */}
              <div className="border-t pt-4 space-y-4">
                <div>
                  <Label htmlFor="terms-upload" className="flex items-center gap-2">
                    RAMS
                    <span className="text-xs text-muted-foreground">(PDF, DOC, DOCX, TXT)</span>
                  </Label>
                  <Input
                    id="terms-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => setTermsFile(e.target.files?.[0] || null)}
                    disabled={loading || uploading}
                  />
                  {job?.terms_and_conditions_url && !termsFile && (
                    <p className="text-xs text-green-600 mt-1">✓ Document uploaded</p>
                  )}
                  {termsFile && <p className="text-xs text-blue-600 mt-1">New file selected: {termsFile.name}</p>}
                </div>

                <div>
                  <Label htmlFor="waiver-upload" className="flex items-center gap-2">
                    Site Instructions
                    <span className="text-xs text-muted-foreground">(PDF, DOC, DOCX, TXT)</span>
                  </Label>
                  <Input
                    id="waiver-upload"
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => setWaiverFile(e.target.files?.[0] || null)}
                    disabled={loading || uploading}
                  />
                  {job?.waiver_url && !waiverFile && <p className="text-xs text-green-600 mt-1">✓ Document uploaded</p>}
                  {waiverFile && <p className="text-xs text-blue-600 mt-1">New file selected: {waiverFile.name}</p>}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="address_line_1">Address Line 1 *</Label>
                  <Input
                    id="address_line_1"
                    {...register("address_line_1")}
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
                    {...register("address_line_2")}
                    placeholder="Apartment, suite, etc. (optional)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City/Town *</Label>
                    <Input id="city" {...register("city")} placeholder="City or town" />
                    {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
                  </div>

                  <div>
                    <Label htmlFor="county">County</Label>
                    <Input id="county" {...register("county")} placeholder="County (optional)" />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable-geofencing-toggle" className="text-base">
                      Enable Geofencing
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Require workers to be at the job site to clock in
                    </p>
                  </div>
                  <Switch
                    id="enable-geofencing-toggle"
                    checked={geofenceEnabled}
                    onCheckedChange={setGeofenceEnabled}
                  />
                </div>

                {geofenceEnabled && (
                  <>
                    <div>
                      <Label htmlFor="postcode">Postcode *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="postcode"
                          {...register("postcode")}
                          placeholder="e.g., SW1A 1AA"
                          className="uppercase flex-1"
                          onChange={(e) => {
                            e.target.value = e.target.value.toUpperCase();
                            setValue("postcode", e.target.value);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="default"
                          onClick={handleManualGeocode}
                          disabled={!watchedPostcode || !validatePostcode(watchedPostcode) || geocoding}
                          className="shrink-0"
                        >
                          {geocoding ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                          {geocoding ? "Finding..." : "Find Location"}
                        </Button>
                      </div>
                      {errors.postcode && <p className="text-sm text-destructive mt-1">{errors.postcode.message}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Click "Find Location" to geocode the postcode and update the map
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {geofenceEnabled && (
              <div className="job-location-section space-y-4">
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

              <div className="job-geofence-slider">
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
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || uploading} className="job-submit-button">
                {uploading ? "Uploading..." : loading ? "Saving..." : job ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <OnboardingTour
        steps={addJobSteps}
        run={showTutorial}
        onComplete={handleTutorialEnd}
        onSkip={handleTutorialEnd}
      />
    </>
  );
}
