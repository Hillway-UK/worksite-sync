import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building, Users, Trash, AlertCircle, LogOut, Key, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { TempPasswordModal } from "@/components/TempPasswordModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { generateSecurePassword } from "@/lib/validation";
import { useCapacityCheck } from "@/hooks/useCapacityCheck";
import { CapacityLimitDialog } from "@/components/CapacityLimitDialog";
import { OrganizationLogoUpload, OrganizationLogoUploadRef } from "@/components/OrganizationLogoUpload";

const SUBSCRIPTION_PLANS = {
  trial: {
    label: "Trial",
    maxManagers: 1,
    maxWorkers: 3,
    plannedManagers: 1,
    plannedWorkers: 3,
    durationMonths: 1,
    costPerManager: 0,
    costPerWorker: 0,
    isCustomizable: false,
  },
  starter: {
    label: "Starter",
    maxManagers: 2,
    maxWorkers: 10,
    plannedManagers: 2,
    plannedWorkers: 10,
    durationMonths: 1,
    costPerManager: 25,
    costPerWorker: 1.5,
    isCustomizable: false,
  },
  pro: {
    label: "Pro",
    maxManagers: 5,
    maxWorkers: 100,
    plannedManagers: 5,
    plannedWorkers: 100,
    durationMonths: 1,
    costPerManager: 25,
    costPerWorker: 1.5,
    isCustomizable: false,
  },
  enterprise: {
    label: "Enterprise",
    maxManagers: null,
    maxWorkers: null,
    plannedManagers: 1,
    plannedWorkers: 0,
    durationMonths: 1,
    costPerManager: 25,
    costPerWorker: 1.5,
    isCustomizable: true,
  },
} as const;

const PLAN_DISPLAY_NAMES: Record<SubscriptionPlan, string> = {
  trial: "Trial (1 Manager, 3 Workers - Free)",
  starter: "Starter (2 Managers, 10 Workers)",
  pro: "Pro (5 Managers, 100 Workers)",
  enterprise: "Enterprise (Custom capacity)",
} as const;

type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

export default function SuperAdmin() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showUpdateOrgDialog, setShowUpdateOrgDialog] = useState(false);
  const [showManagerDialog, setShowManagerDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authVerified, setAuthVerified] = useState(false);
  const [creatingManager, setCreatingManager] = useState(false);
  const [selectedManager, setSelectedManager] = useState<{ id: string; name: string; email: string } | null>(null);
  const [tempPasswordModalOpen, setTempPasswordModalOpen] = useState(false);
  const [showManagerSuccessModal, setShowManagerSuccessModal] = useState(false);
  const [managerCredentials, setManagerCredentials] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);
  const [capacityLimitDialog, setCapacityLimitDialog] = useState({
    open: false,
    type: "manager" as "manager" | "worker",
    planName: "",
    currentCount: 0,
    maxAllowed: null as number | null,
    plannedCount: 0,
  });

  const { checkCapacity } = useCapacityCheck();

  const [orgForm, setOrgForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    company_number: "",
    vat_number: "",
    subscriptionPlan: "starter" as SubscriptionPlan,
    plannedManagers: 2,
    plannedWorkers: 10,
  });

  const [stagedLogoFile, setStagedLogoFile] = useState<File | null>(null);
  const logoUploadRef = useRef<OrganizationLogoUploadRef>(null);

  const [updateOrgForm, setUpdateOrgForm] = useState({
    organizationId: "",
    organizationName: "",
    email: "",
    phone: "",
    address: "",
    company_number: "",
    vat_number: "",
    logo_url: null as string | null,
    subscriptionPlan: "starter" as SubscriptionPlan,
    plannedManagers: 1,
    plannedWorkers: 0,
    currentActive: { managers: 0, workers: 0 },
  });

  const [originalSubscription, setOriginalSubscription] = useState({
    plan: "starter" as SubscriptionPlan,
    plannedManagers: 1,
    plannedWorkers: 0,
  });

  const [managerForm, setManagerForm] = useState({
    email: "",
    name: "",
    organization_id: "",
  });

  useEffect(() => {
    verifyAuthentication();
  }, [user, userRole]);

  const verifyAuthentication = async () => {
    if (!user) {
      toast.error("Please log in to access this page");
      setLoading(false);
      return;
    }

    // Check if user is in super_admins table
    try {
      const { data: superAdmin, error } = await supabase
        .from("super_admins")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      if (error) {
        toast.error("Failed to verify admin status");
        setLoading(false);
        return;
      }

      if (!superAdmin) {
        toast.error("Access denied: Super admin privileges required");
        setLoading(false);
        return;
      }

      setAuthVerified(true);
      await initializeData();
    } catch (err: any) {
      toast.error("Authentication verification failed");
      setLoading(false);
    }
  };

  const initializeData = async () => {
    try {
      await Promise.all([fetchOrganizations(), fetchManagers()]);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  // Helper functions for subscription plans
  const calculateSubscriptionDates = (plan: SubscriptionPlan) => {
    const startDate = new Date();
    const planConfig = SUBSCRIPTION_PLANS[plan];
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + planConfig.durationMonths);

    return {
      subscription_start_date: startDate.toISOString().split("T")[0],
      subscription_end_date: endDate.toISOString().split("T")[0],
      trial_ends_at: plan === "trial" ? endDate.toISOString().split("T")[0] : null,
    };
  };

  const calculateTotalCost = (plan: SubscriptionPlan, managers: number, workers: number) => {
    const planConfig = SUBSCRIPTION_PLANS[plan];
    return managers * planConfig.costPerManager + workers * planConfig.costPerWorker;
  };

  const handlePlanChange = (plan: SubscriptionPlan) => {
    const planConfig = SUBSCRIPTION_PLANS[plan];
    setOrgForm({
      ...orgForm,
      subscriptionPlan: plan,
      plannedManagers: planConfig.plannedManagers,
      plannedWorkers: planConfig.plannedWorkers,
    });
  };

  const handleUpdatePlanChange = (plan: SubscriptionPlan) => {
    const planConfig = SUBSCRIPTION_PLANS[plan];

    // If switching TO a non-customizable plan, use its defaults
    if (!planConfig.isCustomizable) {
      setUpdateOrgForm({
        ...updateOrgForm,
        subscriptionPlan: plan,
        plannedManagers: Math.max(planConfig.plannedManagers, updateOrgForm.currentActive.managers),
        plannedWorkers: Math.max(planConfig.plannedWorkers, updateOrgForm.currentActive.workers),
      });
    } else {
      // For Enterprise (customizable), preserve current values unless they're below active counts
      setUpdateOrgForm({
        ...updateOrgForm,
        subscriptionPlan: plan,
        plannedManagers: Math.max(updateOrgForm.plannedManagers, updateOrgForm.currentActive.managers),
        plannedWorkers: Math.max(updateOrgForm.plannedWorkers, updateOrgForm.currentActive.workers),
      });
    }
  };

  const fetchOrganizations = async () => {
    try {
      // First try simple query without joins
      const { data, error } = await supabase.from("organizations").select("*").order("name");

      if (error) {
        toast.error(`Failed to load organizations: ${error.message}`);
        return;
      }

      // Get manager count separately for each organization
      const orgsWithManagerCount = await Promise.all(
        (data || []).map(async (org) => {
          try {
            const { count, error: countError } = await supabase
              .from("managers")
              .select("*", { count: "exact", head: true })
              .eq("organization_id", org.id);

            return {
              ...org,
              managers: { count: count || 0 },
            };
          } catch (err) {
            return {
              ...org,
              managers: { count: 0 },
            };
          }
        }),
      );

      setOrganizations(orgsWithManagerCount);
    } catch (err: any) {
      toast.error("Failed to load organizations");
    }
  };

  const fetchManagers = async () => {
    try {
      // First get managers
      const { data: managersData, error } = await supabase.from("managers").select("*").order("name");

      if (error) {
        toast.error(`Failed to load managers: ${error.message}`);
        return;
      }

      // Get organization names separately
      const managersWithOrgs = await Promise.all(
        (managersData || []).map(async (manager) => {
          if (!manager.organization_id) {
            return {
              ...manager,
              organizations: null,
            };
          }

          try {
            const { data: orgData, error: orgError } = await supabase
              .from("organizations")
              .select("name")
              .eq("id", manager.organization_id)
              .maybeSingle();

            return {
              ...manager,
              organizations: orgData,
            };
          } catch (err) {
            return {
              ...manager,
              organizations: null,
            };
          }
        }),
      );

      setManagers(managersWithOrgs);
    } catch (err: any) {
      toast.error("Failed to load managers");
    }
  };

  const createOrganization = async () => {
    try {
      if (!orgForm.name || !orgForm.email) {
        toast.error("Organization name and email are required");
        return;
      }

      const planConfig = SUBSCRIPTION_PLANS[orgForm.subscriptionPlan];

      // Validation for non-enterprise plans
      if (!planConfig.isCustomizable) {
        if (
          orgForm.plannedManagers !== planConfig.plannedManagers ||
          orgForm.plannedWorkers !== planConfig.plannedWorkers
        ) {
          toast.error(
            `${planConfig.label} plan requires exactly ${planConfig.plannedManagers} managers and ${planConfig.plannedWorkers} workers`,
          );
          return;
        }
      } else {
        // Enterprise validation
        if (orgForm.plannedManagers < 1) {
          toast.error("Planned managers must be at least 1");
          return;
        }
        if (orgForm.plannedWorkers < 0) {
          toast.error("Planned workers cannot be negative");
          return;
        }
      }

      // Calculate dates
      const dates = calculateSubscriptionDates(orgForm.subscriptionPlan);
      const totalCost = calculateTotalCost(orgForm.subscriptionPlan, orgForm.plannedManagers, orgForm.plannedWorkers);

      // Insert into organizations table (without max_managers/max_workers)
      const { data, error } = await supabase
        .from("organizations")
        .insert({
          name: orgForm.name,
          email: orgForm.email,
          phone: orgForm.phone || null,
          address: orgForm.address || null,
          company_number: orgForm.company_number || null,
          vat_number: orgForm.vat_number || null,
          subscription_status: orgForm.subscriptionPlan === "trial" ? "trial" : "active",
          subscription_start_date: dates.subscription_start_date,
          subscription_end_date: dates.subscription_end_date,
          trial_ends_at: dates.trial_ends_at,
        })
        .select()
        .single();

      if (error) {
        toast.error(`Failed to create organization: ${error.message}`);
        return;
      }

      // Upload staged logo if present
      let logoUrl: string | null = null;
      if (stagedLogoFile && logoUploadRef.current) {
        logoUrl = await logoUploadRef.current.uploadStagedFile(data.id);

        if (logoUrl) {
          await supabase.from("organizations").update({ logo_url: logoUrl }).eq("id", data.id);
        }
      }

      // Create subscription_usage record with new schema
      const { error: usageError } = await supabase.from("subscription_usage").insert({
        organization_id: data.id,
        month: dates.subscription_start_date,
        planned_number_of_managers: orgForm.plannedManagers,
        planned_number_of_workers: orgForm.plannedWorkers,
        total_cost: totalCost,
        active_managers: 0,
        active_workers: 0,
        billed: false,
        status: "active",
        effective_start_date: dates.subscription_start_date,
        plan_type:
          orgForm.subscriptionPlan === "trial"
            ? "trial"
            : orgForm.plannedManagers === 2 && orgForm.plannedWorkers === 10
              ? "starter"
              : orgForm.plannedManagers === 5 && orgForm.plannedWorkers === 100
                ? "pro"
                : "custom",
      });

      if (usageError) {
        console.error("Failed to create subscription usage:", usageError);
        toast.error("Organization created but subscription tracking failed");
      } else {
        const costDisplay = totalCost > 0 ? `£${totalCost.toFixed(2)}/month` : "Free Trial";
        const logoMessage = logoUrl ? " with logo" : "";
        toast.success(`Organization created${logoMessage} with ${planConfig.label} plan (${costDisplay})`);
      }

      setShowOrgDialog(false);
      setOrgForm({
        name: "",
        email: "",
        phone: "",
        address: "",
        company_number: "",
        vat_number: "",
        subscriptionPlan: "starter",
        plannedManagers: 2,
        plannedWorkers: 10,
      });
      setStagedLogoFile(null);
      await fetchOrganizations();
    } catch (err: any) {
      toast.error("An unexpected error occurred");
    }
  };

  const createManager = async () => {
    try {
      if (!managerForm.email || !managerForm.name || !managerForm.organization_id) {
        toast.error("Please fill in all fields");
        return;
      }

      // Check capacity BEFORE creating manager
      const capacityCheck = await checkCapacity(managerForm.organization_id, "manager");

      if (!capacityCheck.allowed) {
        if (capacityCheck.capacity) {
          setCapacityLimitDialog({
            open: true,
            type: "manager",
            planName: capacityCheck.capacity.planName,
            currentCount: capacityCheck.capacity.currentManagerCount,
            maxAllowed: capacityCheck.capacity.maxManagers,
            plannedCount: capacityCheck.capacity.plannedManagers,
          });
        } else {
          toast.error(capacityCheck.error || "Cannot add manager at this time");
        }
        return;
      }

      setCreatingManager(true);

      // Auto-generate secure password
      const autoPassword = generateSecurePassword(12);

      // Create auth user using regular signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: managerForm.email,
        password: autoPassword,
        options: {
          emailRedirectTo: "https://autotime.hillwayco.uk/login",
          data: {
            name: managerForm.name,
            role: "manager",
            organization_id: managerForm.organization_id,
          },
        },
      });

      if (authError) {
        // Check if user already exists
        if (authError.message.includes("already registered")) {
          // User exists, use upsert to handle potential duplicates gracefully
          const { error: managerError } = await supabase.from("managers").upsert(
            {
              email: managerForm.email,
              name: managerForm.name,
              organization_id: managerForm.organization_id,
            },
            {
              onConflict: "email",
            },
          );

          if (managerError) {
            // Check if this is a capacity limit error from the database trigger
            if (managerError.message.includes("Manager limit reached")) {
              const match = managerError.message.match(/active (\d+) \/ planned (\d+)/);
              if (match) {
                const currentCount = parseInt(match[1]);
                const plannedCount = parseInt(match[2]);

                const capacityCheck = await checkCapacity(managerForm.organization_id, "manager");

                setCapacityLimitDialog({
                  open: true,
                  type: "manager",
                  planName: capacityCheck.capacity?.planName || "Current Plan",
                  currentCount: currentCount,
                  maxAllowed: capacityCheck.capacity?.maxManagers || plannedCount,
                  plannedCount: plannedCount,
                });
                setCreatingManager(false);
                return;
              }
            }
            toast.error(`Manager record error: ${managerError.message}`);
          } else {
            toast.success("Manager linked to existing user successfully!");
            setShowManagerDialog(false);
            setManagerForm({ email: "", name: "", organization_id: "" });
            await Promise.all([fetchManagers(), fetchOrganizations()]);
          }
          setCreatingManager(false);
          return;
        }

        toast.error(`Auth error: ${authError.message}`);
        setCreatingManager(false);
        return;
      }

      // Create manager record for new user - use upsert to handle edge cases
      const { error: managerError } = await supabase.from("managers").upsert(
        {
          email: managerForm.email,
          name: managerForm.name,
          organization_id: managerForm.organization_id,
        },
        {
          onConflict: "email",
        },
      );

      if (managerError) {
        // Check if this is a capacity limit error from the database trigger
        if (managerError.message.includes("Manager limit reached")) {
          // Parse the error message: "Manager limit reached for organization X (active Y / planned Z)"
          const match = managerError.message.match(/active (\d+) \/ planned (\d+)/);
          if (match) {
            const currentCount = parseInt(match[1]);
            const plannedCount = parseInt(match[2]);

            // Get plan info for display
            const capacityCheck = await checkCapacity(managerForm.organization_id, "manager");

            setCapacityLimitDialog({
              open: true,
              type: "manager",
              planName: capacityCheck.capacity?.planName || "Current Plan",
              currentCount: currentCount,
              maxAllowed: capacityCheck.capacity?.maxManagers || plannedCount,
              plannedCount: plannedCount,
            });
            setCreatingManager(false);
            return;
          }
        }

        toast.error(`Failed to create manager record: ${managerError.message}`);
        setCreatingManager(false);
        return;
      }

      // Fetch organization name for email
      let organizationName = "Your Organization";
      try {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", managerForm.organization_id)
          .maybeSingle();
        if (orgData?.name) {
          organizationName = orgData.name;
        }
      } catch (orgErr) {
        console.error("Failed to fetch organization name:", orgErr);
      }

      // Send invitation email via MailChannels
      try {
        const { error: emailError } = await supabase.functions.invoke("send-invitation-email", {
          body: {
            type: "manager",
            recipientEmail: managerForm.email,
            recipientName: managerForm.name,
            password: autoPassword,
            organizationName: organizationName,
            loginUrl: "https://autotime.hillwayco.uk/login",
          },
        });
        if (emailError) {
          console.error("Failed to send invitation email:", emailError);
        }
      } catch (emailErr) {
        console.error("Email sending error:", emailErr);
      }

      // Store credentials and show success modal
      setManagerCredentials({
        name: managerForm.name,
        email: managerForm.email,
        password: autoPassword,
      });

      setShowManagerDialog(false);
      setManagerForm({ email: "", name: "", organization_id: "" });
      setShowManagerSuccessModal(true);
      await Promise.all([fetchManagers(), fetchOrganizations()]);
    } catch (error: any) {
      toast.error(error.message || "Failed to create manager");
    } finally {
      setCreatingManager(false);
    }
  };

  const copyManagerCredentialsToClipboard = () => {
    if (!managerCredentials) return;

    const text = `Welcome to TimeTrack Manager Portal

Name: ${managerCredentials.name}
Email: ${managerCredentials.email}
Temporary Password: ${managerCredentials.password}

Manager Portal URL: https://autotime.hillwayco.uk/login

Please change your password on first login for security.`;

    navigator.clipboard.writeText(text);
    toast.success("Login details copied to clipboard!");
  };

  const handleManagerSuccessModalClose = () => {
    setShowManagerSuccessModal(false);
    setManagerCredentials(null);
  };

  const openUpdateOrgDialog = async (org: any) => {
    try {
      // Fetch current subscription usage
      const { data: usageData, error: usageError } = await supabase
        .from("subscription_usage")
        .select("*")
        .eq("organization_id", org.id)
        .eq("status", "active")
        .order("effective_start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usageError && usageError.code !== "PGRST116") {
        toast.error("Failed to fetch subscription data");
        return;
      }

      // Determine current plan from subscription_usage data
      let currentPlan: SubscriptionPlan = "starter"; // default fallback

      if (usageData?.plan_type) {
        // Use the actual plan_type from subscription_usage
        // Map 'custom' to 'enterprise' for the dropdown
        const planType = usageData.plan_type.toLowerCase().trim();
        currentPlan = planType === "custom" ? "enterprise" : (planType as SubscriptionPlan);
      } else if (org.subscription_status === "trial") {
        // Fallback: if no usage data but status is trial
        currentPlan = "trial";
      }

      const plannedManagers = usageData?.planned_number_of_managers || 1;
      const plannedWorkers = usageData?.planned_number_of_workers || 0;

      setUpdateOrgForm({
        organizationId: org.id,
        organizationName: org.name,
        email: org.email || "",
        phone: org.phone || "",
        address: org.address || "",
        company_number: org.company_number || "",
        vat_number: org.vat_number || "",
        logo_url: org.logo_url || null,
        subscriptionPlan: currentPlan,
        plannedManagers: plannedManagers,
        plannedWorkers: plannedWorkers,
        currentActive: {
          managers: usageData?.active_managers || 0,
          workers: usageData?.active_workers || 0,
        },
      });

      // Store original subscription for change detection
      setOriginalSubscription({
        plan: currentPlan,
        plannedManagers: plannedManagers,
        plannedWorkers: plannedWorkers,
      });

      setShowUpdateOrgDialog(true);
    } catch (err: any) {
      toast.error("Failed to load organization data");
    }
  };

  const updateOrganization = async () => {
    try {
      if (!updateOrgForm.organizationName) {
        toast.error("Organization name is required");
        return;
      }

      const planConfig = SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan];

      // Validation
      if (!planConfig.isCustomizable) {
        if (
          updateOrgForm.plannedManagers < planConfig.plannedManagers ||
          updateOrgForm.plannedWorkers < planConfig.plannedWorkers
        ) {
          toast.error(
            `${planConfig.label} plan requires at least ${planConfig.plannedManagers} managers and ${planConfig.plannedWorkers} workers`,
          );
          return;
        }
      }

      if (updateOrgForm.plannedManagers < updateOrgForm.currentActive.managers) {
        toast.error(`Cannot reduce managers below current active count (${updateOrgForm.currentActive.managers})`);
        return;
      }

      if (updateOrgForm.plannedWorkers < updateOrgForm.currentActive.workers) {
        toast.error(`Cannot reduce workers below current active count (${updateOrgForm.currentActive.workers})`);
        return;
      }

      // Find the organization in the current list
      const currentOrg = organizations.find((o) => o.id === updateOrgForm.organizationId);

      // Detect what changed
      const companyDetailsChanged =
        updateOrgForm.organizationName !== currentOrg?.name ||
        updateOrgForm.email !== (currentOrg?.email || "") ||
        updateOrgForm.phone !== (currentOrg?.phone || "") ||
        updateOrgForm.address !== (currentOrg?.address || "") ||
        updateOrgForm.company_number !== (currentOrg?.company_number || "") ||
        updateOrgForm.vat_number !== (currentOrg?.vat_number || "");

      const subscriptionChanged =
        updateOrgForm.subscriptionPlan !== originalSubscription.plan ||
        updateOrgForm.plannedManagers !== originalSubscription.plannedManagers ||
        updateOrgForm.plannedWorkers !== originalSubscription.plannedWorkers;

      // Update company details if changed
      if (companyDetailsChanged) {
        const { error: orgError } = await supabase
          .from("organizations")
          .update({
            name: updateOrgForm.organizationName,
            email: updateOrgForm.email,
            phone: updateOrgForm.phone,
            address: updateOrgForm.address,
            company_number: updateOrgForm.company_number,
            vat_number: updateOrgForm.vat_number,
          })
          .eq("id", updateOrgForm.organizationId);

        if (orgError) {
          toast.error(`Failed to update organization: ${orgError.message}`);
          return;
        }
      }

      // Only update subscription if it actually changed
      if (subscriptionChanged) {
        const { data: upgradeData, error: upgradeError } = await supabase.functions.invoke(
          "upgrade-subscription-plan",
          {
            body: {
              organizationId: updateOrgForm.organizationId,
              newMaxManagers: updateOrgForm.plannedManagers,
              newMaxWorkers: updateOrgForm.plannedWorkers,
              planType: updateOrgForm.subscriptionPlan,
            },
          },
        );

        if (upgradeError) {
          toast.error(`Failed to update subscription: ${upgradeError.message}`);
          return;
        }
      }

      // Success message based on what was updated
      const totalCost = calculateTotalCost(
        updateOrgForm.subscriptionPlan,
        updateOrgForm.plannedManagers,
        updateOrgForm.plannedWorkers,
      );
      if (companyDetailsChanged && subscriptionChanged) {
        const costDisplay = totalCost > 0 ? `£${totalCost.toFixed(2)}/month` : "Free";
        toast.success(`Organization and subscription updated successfully (${costDisplay})`);
      } else if (companyDetailsChanged) {
        toast.success("Organization details updated successfully");
      } else if (subscriptionChanged) {
        const costDisplay = totalCost > 0 ? `£${totalCost.toFixed(2)}/month` : "Free";
        toast.success(`Subscription updated successfully (${costDisplay})`);
      } else {
        toast.info("No changes detected");
      }

      setShowUpdateOrgDialog(false);
      setUpdateOrgForm({
        organizationId: "",
        organizationName: "",
        email: "",
        phone: "",
        address: "",
        company_number: "",
        vat_number: "",
        logo_url: null,
        subscriptionPlan: "starter",
        plannedManagers: 1,
        plannedWorkers: 0,
        currentActive: { managers: 0, workers: 0 },
      });
      await fetchOrganizations();
    } catch (err: any) {
      toast.error("Failed to update organization");
    }
  };

  const deleteOrganization = async (id: string) => {
    // Guard + validation
    if (id == null || id === "") {
      console.error("deleteOrganization(): missing id", id);
      toast.error("Missing organization id");
      return;
    }

    if (!confirm("Delete this organization and all its data? This action cannot be undone.")) {
      return;
    }

    // Optimistic UI: snapshot current state for rollback
    const prevOrganizations = organizations;
    setOrganizations((prev) => prev.filter((o) => o.id !== id));

    // Debug log
    console.debug("deleteOrganization(): sending body", { organization_id: String(id) });

    try {
      // ✅ Explicit method + proper body
      const { data, error } = await supabase.functions.invoke("delete-organization", {
        method: "POST",
        body: { organization_id: String(id) },
      });

      if (error) {
        // Extract server body if present
        const resp = (error as any)?.context?.response;
        let msg = error.message || "Edge Function returned an error";

        if (resp && typeof resp.text === "function") {
          const text = await resp.text();
          try {
            msg = JSON.parse(text).error || text;
          } catch {
            msg = text || msg;
          }
        }

        // Rollback optimistic change
        setOrganizations(prevOrganizations);
        console.error("Edge function error:", msg);
        toast.error(msg);
        return;
      }

      if (!data?.success) {
        setOrganizations(prevOrganizations);
        toast.error(data?.error || "Failed to delete organization");
        return;
      }

      toast.success(
        `Organization deleted successfully. Removed ${data.details?.worker_count ?? 0} workers and ${data.details?.manager_count ?? 0} managers.`,
      );
      // Refresh both organizations and managers tables
      await fetchOrganizations();
      await fetchManagers();
    } catch (e: any) {
      setOrganizations(prevOrganizations); // rollback
      console.error("Delete org unexpected error:", e);
      toast.error(e?.message || "Unexpected error while deleting organization");
    }
  };

  const deleteManager = async (email: string) => {
    if (!confirm("Remove this manager? This action cannot be undone.")) return;

    try {
      // Call edge function to delete both database record and auth user
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { email, table: "managers" },
      });

      if (error) {
        toast.error("Failed to delete manager");
        return;
      }

      toast.success("Manager removed");
      fetchManagers();
    } catch (error) {
      console.error("Error deleting manager:", error);
      toast.error("Failed to delete manager");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!authVerified) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Super admin privileges required to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              try {
                const { data, error } = await supabase.functions.invoke("reconcile-subscription", {
                  body: { reason: "manual_admin_trigger" },
                });

                if (error) throw error;

                if (data.reconciled?.length > 0) {
                  toast.success(`Reconciled ${data.reconciled.length} organization(s)`);
                } else {
                  toast.success("No discrepancies found");
                }

                await fetchOrganizations();
              } catch (error: any) {
                toast.error("Reconciliation failed: " + error.message);
              }
            }}
            variant="outline"
            className="border-primary hover:bg-primary/10"
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Reconcile Subscriptions
          </Button>
          <Button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/login");
            }}
            variant="outline"
            className="border-black hover:bg-gray-100"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
      <div className="mb-4 p-3 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          Logged in as: <span className="font-medium">{user?.email}</span> | Organizations: {organizations.length} |
          Managers: {managers.length}
        </p>
      </div>

      {/* Organizations Section */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organizations ({organizations.length})
          </CardTitle>
          <Button onClick={() => setShowOrgDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Organization
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Managers</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => (
                <TableRow
                  key={org.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/organization/${org.id}`)}
                >
                  <TableCell className="font-medium text-primary hover:underline">{org.name}</TableCell>
                  <TableCell>{org.email || "Not set"}</TableCell>
                  <TableCell>{org.phone || "Not set"}</TableCell>
                  <TableCell>{org.managers?.count || 0}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openUpdateOrgDialog(org)}
                        className="hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteOrganization(org.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Managers Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Managers ({managers.length})
          </CardTitle>
          <Button onClick={() => setShowManagerDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Manager
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map((manager) => (
                <TableRow key={manager.email}>
                  <TableCell className="font-medium">{manager.name}</TableCell>
                  <TableCell>{manager.email}</TableCell>
                  <TableCell>{manager.organizations?.name || "Unassigned"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedManager({
                                  id: manager.id,
                                  name: manager.name,
                                  email: manager.email,
                                });
                                setTempPasswordModalOpen(true);
                              }}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Generate temp password</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteManager(manager.email)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Organization Dialog */}
      <Dialog
        open={showOrgDialog}
        onOpenChange={(open) => {
          if (!open) {
            setStagedLogoFile(null);
          }
          setShowOrgDialog(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="org-name">Organization Name *</Label>
              <Input
                id="org-name"
                value={orgForm.name}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                placeholder="Enter organization name"
              />
            </div>
            <div>
              <Label htmlFor="org-email">Email</Label>
              <Input
                id="org-email"
                type="email"
                value={orgForm.email}
                onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="org-phone">Phone</Label>
              <Input
                id="org-phone"
                value={orgForm.phone}
                onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <Label htmlFor="org-address">Address</Label>
              <Input
                id="org-address"
                value={orgForm.address}
                onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                placeholder="Enter address"
              />
            </div>
            <div>
              <Label htmlFor="org-company-number">Company Number</Label>
              <Input
                id="org-company-number"
                value={orgForm.company_number}
                onChange={(e) => setOrgForm({ ...orgForm, company_number: e.target.value })}
                placeholder="Enter company number"
              />
            </div>
            <div>
              <Label htmlFor="org-vat-number">VAT Number</Label>
              <Input
                id="org-vat-number"
                value={orgForm.vat_number}
                onChange={(e) => setOrgForm({ ...orgForm, vat_number: e.target.value })}
                placeholder="Enter VAT number"
              />
            </div>

            <div className="space-y-4">
              <OrganizationLogoUpload
                ref={logoUploadRef}
                mode="staged"
                onFileSelected={(file) => setStagedLogoFile(file)}
                currentLogoUrl={null}
                onUploadComplete={() => {}}
              />
            </div>

            <div>
              <Label htmlFor="org-subscription-plan">Subscription Plan *</Label>
              <select
                id="org-subscription-plan"
                className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                value={orgForm.subscriptionPlan}
                onChange={(e) => handlePlanChange(e.target.value as SubscriptionPlan)}
              >
                <option value="trial">Trial (1 Manager, 3 Workers - Free for 1 month)</option>
                <option value="starter">Starter (2 Managers, 10 Workers - £55/month)</option>
                <option value="pro">Pro (5 Managers, 100 Workers - £275/month)</option>
                <option value="enterprise">Enterprise (Custom capacity)</option>
              </select>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
              <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].label} Plan
              </div>
              <div className="text-blue-700 dark:text-blue-300 text-xs space-y-1">
                {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].isCustomizable ? (
                  <div>✓ Customizable capacity for managers and workers</div>
                ) : (
                  <>
                    <div>
                      ✓ {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].maxManagers} Manager
                      {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].maxManagers > 1 ? "s" : ""}
                    </div>
                    <div>
                      ✓ {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].maxWorkers} Worker
                      {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].maxWorkers > 1 ? "s" : ""}
                    </div>
                  </>
                )}
                <div>✓ {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].durationMonths} month subscription</div>
              </div>
            </div>

            <div>
              <Label htmlFor="org-planned-managers">Planned Number of Managers *</Label>
              <Input
                id="org-planned-managers"
                type="number"
                min="1"
                value={orgForm.plannedManagers}
                onChange={(e) => setOrgForm({ ...orgForm, plannedManagers: parseInt(e.target.value) || 1 })}
                placeholder="1"
                disabled={!SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].isCustomizable}
              />
              {!SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].isCustomizable && (
                <div className="text-xs text-muted-foreground mt-1">
                  Fixed for {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].label} plan
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="org-planned-workers">Planned Number of Workers *</Label>
              <Input
                id="org-planned-workers"
                type="number"
                min="0"
                value={orgForm.plannedWorkers}
                onChange={(e) => setOrgForm({ ...orgForm, plannedWorkers: parseInt(e.target.value) || 0 })}
                placeholder="0"
                disabled={!SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].isCustomizable}
              />
              {!SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].isCustomizable && (
                <div className="text-xs text-muted-foreground mt-1">
                  Fixed for {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].label} plan
                </div>
              )}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">
                {orgForm.subscriptionPlan === "trial" ? "Trial Period Cost" : "Estimated Monthly Cost"}
              </div>
              <div className="text-2xl font-bold text-primary">
                {orgForm.subscriptionPlan === "trial"
                  ? "FREE"
                  : `£${calculateTotalCost(orgForm.subscriptionPlan, orgForm.plannedManagers, orgForm.plannedWorkers).toFixed(2)}`}
              </div>
              {orgForm.subscriptionPlan !== "trial" && (
                <div className="text-xs text-muted-foreground mt-2">
                  ({orgForm.plannedManagers} × £{SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].costPerManager.toFixed(2)}
                  ) + ({orgForm.plannedWorkers} × £
                  {SUBSCRIPTION_PLANS[orgForm.subscriptionPlan].costPerWorker.toFixed(2)})
                </div>
              )}
            </div>
            <Button onClick={createOrganization} className="w-full">
              Create Organization
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Organization Dialog */}
      <Dialog open={showUpdateOrgDialog} onOpenChange={setShowUpdateOrgDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Company Details Section */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Company Details</div>
              <div>
                <Label htmlFor="update-org-name">Organization Name *</Label>
                <Input
                  id="update-org-name"
                  value={updateOrgForm.organizationName}
                  onChange={(e) => setUpdateOrgForm({ ...updateOrgForm, organizationName: e.target.value })}
                  placeholder="Enter organization name"
                />
              </div>
              <div>
                <Label htmlFor="update-org-email">Email</Label>
                <Input
                  id="update-org-email"
                  type="email"
                  value={updateOrgForm.email}
                  onChange={(e) => setUpdateOrgForm({ ...updateOrgForm, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <Label htmlFor="update-org-phone">Phone</Label>
                <Input
                  id="update-org-phone"
                  value={updateOrgForm.phone}
                  onChange={(e) => setUpdateOrgForm({ ...updateOrgForm, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="update-org-address">Address</Label>
                <Input
                  id="update-org-address"
                  value={updateOrgForm.address}
                  onChange={(e) => setUpdateOrgForm({ ...updateOrgForm, address: e.target.value })}
                  placeholder="Enter address"
                />
              </div>
            </div>

            {/* Registration Details Section */}
            <div className="space-y-3 pt-3 border-t">
              <div className="text-sm font-semibold text-foreground">Registration Details</div>
              <div>
                <Label htmlFor="update-org-company-number">Company Number</Label>
                <Input
                  id="update-org-company-number"
                  value={updateOrgForm.company_number}
                  onChange={(e) => setUpdateOrgForm({ ...updateOrgForm, company_number: e.target.value })}
                  placeholder="Enter company number"
                />
              </div>
              <div>
                <Label htmlFor="update-org-vat-number">VAT Number</Label>
                <Input
                  id="update-org-vat-number"
                  value={updateOrgForm.vat_number}
                  onChange={(e) => setUpdateOrgForm({ ...updateOrgForm, vat_number: e.target.value })}
                  placeholder="Enter VAT number"
                />
              </div>
            </div>

            {/* Logo Upload Section */}
            <div className="space-y-3 pt-3 border-t">
              <div className="text-sm font-semibold text-foreground">Organization Logo</div>
              <OrganizationLogoUpload
                organizationId={updateOrgForm.organizationId}
                currentLogoUrl={updateOrgForm.logo_url}
                onUploadComplete={(logoUrl) => setUpdateOrgForm({ ...updateOrgForm, logo_url: logoUrl })}
                onDeleteComplete={() => setUpdateOrgForm({ ...updateOrgForm, logo_url: null })}
              />
            </div>

            {/* Subscription Capacity Section */}
            <div className="space-y-3 pt-3 border-t">
              <div className="text-sm font-semibold text-foreground">Subscription Capacity</div>

              <div>
                <Label htmlFor="update-subscription-plan">Subscription Plan *</Label>
                <select
                  id="update-subscription-plan"
                  className="w-full p-2 border border-border rounded-md bg-background text-foreground"
                  value={updateOrgForm.subscriptionPlan}
                  onChange={(e) => handleUpdatePlanChange(e.target.value as SubscriptionPlan)}
                >
                  <option value="trial">{PLAN_DISPLAY_NAMES.trial}</option>
                  <option value="starter">{PLAN_DISPLAY_NAMES.starter}</option>
                  <option value="pro">{PLAN_DISPLAY_NAMES.pro}</option>
                  <option value="enterprise">{PLAN_DISPLAY_NAMES.enterprise}</option>
                </select>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
                <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].label} Plan
                </div>
                <div className="text-blue-700 dark:text-blue-300 text-xs space-y-1">
                  {SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].isCustomizable ? (
                    <div>✓ Customizable capacity</div>
                  ) : (
                    <>
                      <div>✓ Max {SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].maxManagers} Managers</div>
                      <div>✓ Max {SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].maxWorkers} Workers</div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground">
                  Active: {updateOrgForm.currentActive.managers} managers, {updateOrgForm.currentActive.workers} workers
                </div>
              </div>

              <div>
                <Label htmlFor="update-planned-managers">Planned Number of Managers *</Label>
                <Input
                  id="update-planned-managers"
                  type="number"
                  min={updateOrgForm.currentActive.managers}
                  value={updateOrgForm.plannedManagers}
                  onChange={(e) =>
                    setUpdateOrgForm({ ...updateOrgForm, plannedManagers: parseInt(e.target.value) || 1 })
                  }
                  placeholder="1"
                  disabled={!SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].isCustomizable}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Minimum: {updateOrgForm.currentActive.managers} (current active)
                  {!SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].isCustomizable && " • Fixed for this plan"}
                </div>
              </div>

              <div>
                <Label htmlFor="update-planned-workers">Planned Number of Workers *</Label>
                <Input
                  id="update-planned-workers"
                  type="number"
                  min={updateOrgForm.currentActive.workers}
                  value={updateOrgForm.plannedWorkers}
                  onChange={(e) =>
                    setUpdateOrgForm({ ...updateOrgForm, plannedWorkers: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                  disabled={!SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].isCustomizable}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Minimum: {updateOrgForm.currentActive.workers} (current active)
                  {!SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].isCustomizable && " • Fixed for this plan"}
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-2">
                  {updateOrgForm.subscriptionPlan === "trial" ? "Trial Period Cost" : "Updated Monthly Cost"}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {updateOrgForm.subscriptionPlan === "trial"
                    ? "FREE"
                    : `£${calculateTotalCost(updateOrgForm.subscriptionPlan, updateOrgForm.plannedManagers, updateOrgForm.plannedWorkers).toFixed(2)}`}
                </div>
                {updateOrgForm.subscriptionPlan !== "trial" && (
                  <div className="text-xs text-muted-foreground mt-2">
                    ({updateOrgForm.plannedManagers} × £
                    {SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].costPerManager.toFixed(2)}) + (
                    {updateOrgForm.plannedWorkers} × £
                    {SUBSCRIPTION_PLANS[updateOrgForm.subscriptionPlan].costPerWorker.toFixed(2)})
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-100">
                Available capacity: {updateOrgForm.plannedManagers - updateOrgForm.currentActive.managers} managers,{" "}
                {updateOrgForm.plannedWorkers - updateOrgForm.currentActive.workers} workers
              </div>
            </div>

            <Button onClick={updateOrganization} className="w-full">
              Update Organization
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manager Dialog */}
      <Dialog open={showManagerDialog} onOpenChange={setShowManagerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Manager</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="manager-org">Organization *</Label>
              <select
                id="manager-org"
                className="w-full p-2 border border-border rounded-md bg-background"
                value={managerForm.organization_id}
                onChange={(e) => setManagerForm({ ...managerForm, organization_id: e.target.value })}
              >
                <option value="">Select Organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="manager-name">Manager Name *</Label>
              <Input
                id="manager-name"
                value={managerForm.name}
                onChange={(e) => setManagerForm({ ...managerForm, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <Label htmlFor="manager-email">Email *</Label>
              <Input
                id="manager-email"
                type="email"
                value={managerForm.email}
                onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
              A secure password will be automatically generated for the manager.
            </div>
            <Button onClick={createManager} className="w-full" disabled={creatingManager}>
              {creatingManager ? "Creating Manager..." : "Create Manager"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TempPasswordModal
        open={tempPasswordModalOpen}
        onOpenChange={setTempPasswordModalOpen}
        manager={selectedManager}
      />

      {/* Manager Success Modal */}
      <AlertDialog open={showManagerSuccessModal} onOpenChange={handleManagerSuccessModalClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Manager Created Successfully!</AlertDialogTitle>
            <AlertDialogDescription>
              The manager account has been created. Please share these temporary credentials:
            </AlertDialogDescription>
          </AlertDialogHeader>
          {managerCredentials && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-md space-y-2">
              <div>
                <strong>Name:</strong> {managerCredentials.name}
              </div>
              <div>
                <strong>Email:</strong> {managerCredentials.email}
              </div>
              <div>
                <strong>Temporary Password:</strong> {managerCredentials.password}
              </div>
              <div className="text-sm text-muted-foreground mt-3 pt-3 border-t border-green-300">
                ⚠️ Manager should change this password on first login for security.
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={copyManagerCredentialsToClipboard} className="mr-2">
              Copy Login Details
            </AlertDialogAction>
            <AlertDialogCancel onClick={handleManagerSuccessModalClose}>Done</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Capacity Limit Dialog */}
      <CapacityLimitDialog
        open={capacityLimitDialog.open}
        onClose={() => setCapacityLimitDialog({ ...capacityLimitDialog, open: false })}
        type={capacityLimitDialog.type}
        planName={capacityLimitDialog.planName}
        currentCount={capacityLimitDialog.currentCount}
        maxAllowed={capacityLimitDialog.maxAllowed}
        plannedCount={capacityLimitDialog.plannedCount}
      />
    </div>
  );
}

