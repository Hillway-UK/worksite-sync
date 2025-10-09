import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, CheckCircle, Copy } from "lucide-react";
import { generateSecurePassword } from "@/lib/validation";

// Enhanced validation schema with better security
const workerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Valid email is required")
    .max(255, "Email must be less than 255 characters"),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[\d\s\-\+\(\)]{7,20}$/.test(val), "Invalid phone number format"),
  hourly_rate: z.number().min(0, "Hourly rate must be positive").max(1000, "Hourly rate must be reasonable"),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional(),
  emergency_contact: z.string().trim().max(200, "Emergency contact must be less than 200 characters").optional(),
  date_started: z.string().optional(),
  shift_start: z.string().optional(),
  shift_end: z.string().optional(),
  shift_days: z.array(z.number()).optional(),
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
  shift_start?: string | null;
  shift_end?: string | null;
  shift_days?: number[] | null;
}

interface WorkerDialogProps {
  worker?: Worker;
  onSave: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCapacityLimit?: (data: {
    currentCount: number;
    plannedCount: number;
    maxAllowed: number | null;
    planName: string;
  }) => void;
}

export function WorkerDialog({
  worker,
  onSave,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onCapacityLimit,
}: WorkerDialogProps) {
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

    const credentialText = `Welcome to AutoTime

Name: ${workerCredentials.name}
Email: ${workerCredentials.email}
Temporary Password: ${workerCredentials.password}
App URL: "https://autotimeworkers.hillwayco.uk/login"

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
    watch,
    setValue,
  } = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: worker
      ? {
          name: worker.name,
          email: worker.email,
          phone: worker.phone || "",
          hourly_rate: worker.hourly_rate,
          address: worker.address || "",
          emergency_contact: worker.emergency_contact || "",
          date_started: worker.date_started || "",
          shift_start: worker.shift_start || "07:00",
          shift_end: worker.shift_end || "15:00",
          shift_days: worker.shift_days || [1, 2, 3, 4, 5],
        }
      : {
          name: "",
          email: "",
          phone: "",
          hourly_rate: 25,
          address: "",
          emergency_contact: "",
          date_started: new Date().toISOString().split("T")[0],
          shift_start: "07:00",
          shift_end: "15:00",
          shift_days: [1, 2, 3, 4, 5],
        },
  });

  const selectedShiftDays = watch("shift_days") || [];

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
        .from("managers")
        .select("organization_id")
        .eq("email", user.user.email)
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
          .from("workers")
          .select("id")
          .eq("email", data.email)
          .eq("organization_id", managerData.organization_id)
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
        shift_start: data.shift_start || null,
        shift_end: data.shift_end || null,
        shift_days: data.shift_days || null,
      };

      if (worker) {
        // Update existing worker - no auth user creation needed
        const { error } = await supabase.from("workers").update(workerData).eq("id", worker.id);

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
        // Create new worker - including auth user creation
        // Generate secure temporary password with better entropy
        const tempPassword = generateSecurePassword(12);

        // Create auth user for worker
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: tempPassword,
          options: {
            emailRedirectTo: "https://autotimeworkers.hillwayco.uk/login",
            data: {
              name: data.name,
              role: "worker",
            },
          },
        });

        // Handle auth user creation
        if (authError && !authError.message.includes("already registered")) {
          toast({
            title: "Account Creation Failed",
            description: `Failed to create login account: ${authError.message}`,
            variant: "destructive",
          });
          return;
        }

        // Create worker database record
        const { error: workerError } = await supabase.from("workers").insert(workerData);

        if (workerError) {
          // Check if this is a capacity limit error from the database trigger
          if (workerError.message.includes("Worker limit reached")) {
            // Parse the error message: "Worker limit reached for organization X (active Y / planned Z)"
            const match = workerError.message.match(/active (\d+) \/ planned (\d+)/);
            if (match) {
              const currentCount = parseInt(match[1]);
              const plannedCount = parseInt(match[2]);

              // Use capacity limit from error message
              const planName = 'Current Plan';
              const maxAllowed = plannedCount; // Use plannedCount as the limit

              // Use callback if provided, otherwise show toast
              if (onCapacityLimit) {
                onCapacityLimit({
                  currentCount,
                  plannedCount,
                  maxAllowed,
                  planName,
                });
                setOpen(false);
              } else {
                toast({
                  title: "Worker Limit Reached",
                  description: `Your ${planName} plan allows ${plannedCount} workers. You currently have ${currentCount} active workers. Please upgrade your plan to add more workers.`,
                  variant: "destructive",
                });
              }
              return;
            }
          }

          toast({
            title: "Creation Failed",
            description: `Failed to add worker: ${workerError.message}`,
            variant: "destructive",
          });
          return;
        }

        // Store credentials for display
        setWorkerCredentials({
          name: data.name,
          email: data.email,
          password: tempPassword,
        });
        setShowSuccessModal(true);

        toast({
          title: "Success",
          description: "Worker created with mobile app login enabled!",
          duration: 5000,
        });
      }
    } catch (error: any) {
      toast({
        title: "Unexpected Error",
        description: `An unexpected error occurred: ${error?.message || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button variant={worker ? "outline" : "default"} size={worker ? "sm" : "default"}>
      {worker ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4 mr-2" />}
      {worker ? "" : "Add New Worker"}
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
        <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto pr-12 pl-12">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
            <DialogTitle>{worker ? "Edit Worker" : "Add New Worker"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" {...register("name")} placeholder="Enter worker's full name" maxLength={100} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="font-body font-semibold text-[#111111]">
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="worker@example.com"
                className="font-body border-[#939393] focus:border-[#702D30] focus:ring-[#702D30]"
                maxLength={255}
                required
              />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
              {worker && (
                <p className="text-xs text-[#939393] font-body">
                  Changing email will require the worker to login with the new email address
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input id="phone" {...register("phone")} placeholder="Enter phone number" maxLength={20} />
              {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
            </div>

            <div>
              <Label htmlFor="hourly_rate">Hourly Rate (£)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                min="0"
                max="1000"
                {...register("hourly_rate", { valueAsNumber: true })}
                placeholder="25.00"
              />
              {errors.hourly_rate && <p className="text-sm text-destructive mt-1">{errors.hourly_rate.message}</p>}
            </div>

            <div>
              <Label htmlFor="address">Address (Optional)</Label>
              <Input id="address" {...register("address")} placeholder="Home address" maxLength={500} />
              {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
            </div>

            <div>
              <Label htmlFor="emergency_contact">Emergency Contact (Optional)</Label>
              <Input
                id="emergency_contact"
                {...register("emergency_contact")}
                placeholder="Name and phone number"
                maxLength={200}
              />
              {errors.emergency_contact && (
                <p className="text-sm text-destructive mt-1">{errors.emergency_contact.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="date_started">Start Date</Label>
              <Input id="date_started" type="date" {...register("date_started")} />
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-semibold">Worker Schedule</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shift_start">Shift Start Time</Label>
                  <Input id="shift_start" type="time" {...register("shift_start")} />
                  {errors.shift_start && <p className="text-sm text-destructive mt-1">{errors.shift_start.message}</p>}
                </div>

                <div>
                  <Label htmlFor="shift_end">Shift End Time</Label>
                  <Input id="shift_end" type="time" {...register("shift_end")} />
                  {errors.shift_end && <p className="text-sm text-destructive mt-1">{errors.shift_end.message}</p>}
                </div>
              </div>

              <div>
                <Label>Working Days</Label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { value: 1, label: "Mon" },
                    { value: 2, label: "Tue" },
                    { value: 3, label: "Wed" },
                    { value: 4, label: "Thu" },
                    { value: 5, label: "Fri" },
                    { value: 6, label: "Sat" },
                    { value: 7, label: "Sun" },
                  ].map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={selectedShiftDays.includes(day.value)}
                        onCheckedChange={(checked) => {
                          const currentDays = selectedShiftDays;
                          if (checked) {
                            setValue("shift_days", [...currentDays, day.value].sort());
                          } else {
                            setValue("shift_days", currentDays.filter((d) => d !== day.value));
                          }
                        }}
                      />
                      <label
                        htmlFor={`day-${day.value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {day.label}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Select the days this worker typically works. Used for notifications and auto-clockout.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : worker ? "Update" : "Create"}
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
                  <strong>Important:</strong> Please share these credentials securely with the worker. They must change
                  their password on first login.
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
            <AlertDialogAction onClick={handleSuccessModalClose}>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
