import React, { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhotoModal } from "@/components/PhotoModal";
import { XeroSettingsModal } from "@/components/XeroSettingsModal";
import { toast } from "@/hooks/use-toast";
import { FileText, Download, ChevronDown, Camera, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfWeek, endOfWeek, addDays, getWeek, getYear } from "date-fns";
import moment from "moment";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { CompletionModal } from "@/components/onboarding/CompletionModal";
import { reportsSteps } from "@/config/onboarding";
import { getPageTutorialStatus, markPageTutorialComplete } from "@/lib/supabase/manager-tutorial";

interface WeeklyData {
  worker_id: string;
  worker_name: string;
  worker_email: string;
  total_hours: number;
  hourly_rate: number;
  jobs: { job_id: string; job_name: string; job_address: string; hours: number }[];
  additional_costs: number;
  total_amount: number;
  profile_photo?: string;
}

interface XeroSettings {
  prefix: string;
  startingNumber: number;
  accountCode: string;
  taxType: string;
  paymentTerms: number;
}

interface JobSiteData {
  job_id: string;
  job_name: string;
  job_address: string;
  workers: Array<{
    worker_id: string;
    worker_name: string;
    total_hours: number;
    hourly_rate: number;
    additional_costs: number;
  }>;
}

interface DetailedEntry {
  id: string;
  worker_id: string;
  worker_name: string;
  date: string;
  job_name: string;
  clock_in: string;
  clock_out: string;
  clock_in_photo?: string;
  clock_out_photo?: string;
  hours: number;
  profile_photo?: string;
}

export default function AdminReports() {
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [detailedData, setDetailedData] = useState<DetailedEntry[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [showTutorial, setShowTutorial] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [xeroSettings, setXeroSettings] = useState<XeroSettings>({
    prefix: "INV",
    startingNumber: 1001,
    accountCode: "5000",
    taxType: "20% VAT",
    paymentTerms: 30,
  });
  const [photoModal, setPhotoModal] = useState<{
    isOpen: boolean;
    photoUrl: string;
    workerName: string;
    timestamp: string;
    jobName?: string;
  }>({
    isOpen: false,
    photoUrl: "",
    workerName: "",
    timestamp: "",
    jobName: "",
  });

  useEffect(() => {
    generateReport();
    generateDetailedReport();
  }, [selectedWeek]);

  // Check if tutorial should run
  useEffect(() => {
    const checkTutorial = async () => {
      const hasSeenReport = await getPageTutorialStatus('reports');
      if (!hasSeenReport) {
        setTimeout(() => setShowTutorial(true), 500);
      }
    };
    checkTutorial();
  }, []);

  const handleTutorialEnd = async () => {
    setShowTutorial(false);
    setShowCompletionModal(true);
    await markPageTutorialComplete('reports');
  };

  const handleTutorialReplay = () => {
    setShowCompletionModal(false);
    setShowTutorial(true);
  };

  const handleCompletionClose = () => {
    setShowCompletionModal(false);
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      // Get week boundaries (Saturday to Friday)
      const weekStart = new Date(selectedWeek);
      const weekEnd = addDays(weekStart, 6);

      // Get manager's organization first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error("User not authenticated");
      }

      const { data: manager } = await supabase
        .from("managers")
        .select("organization_id")
        .eq("email", user.email)
        .single();

      if (!manager?.organization_id) {
        // Check if super_admin
        const { data: superAdmin } = await supabase
          .from("super_admins")
          .select("organization_id")
          .eq("email", user.email)
          .single();

        if (!superAdmin?.organization_id) {
          throw new Error("No organization found for user");
        }
        
        // Use super admin's organization
        const { data: workers, error: workersError } = await supabase
          .from("workers")
          .select("id, name, email, hourly_rate")
          .eq("is_active", true)
          .eq("organization_id", superAdmin.organization_id);

        if (workersError) throw workersError;

        await processWorkersData(workers || [], weekStart, weekEnd);
        return;
      }

      // Fetch workers from manager's organization only
      const { data: workers, error: workersError } = await supabase
        .from("workers")
        .select("id, name, email, hourly_rate")
        .eq("is_active", true)
        .eq("organization_id", manager.organization_id);

      if (workersError) throw workersError;

      await processWorkersData(workers || [], weekStart, weekEnd);
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processWorkersData = async (workers: any[], weekStart: Date, weekEnd: Date) => {
    const reportData: WeeklyData[] = [];

    for (const worker of workers) {
        // Unified hour calculation: Get clock entries with joined job data for this worker during the week
        // Date filtering: weekStart (inclusive) to weekStart + 7 days (exclusive)
        // Only include completed entries (non-null clock_out) for weekly summary
        const { data: clockEntries, error: clockError } = await supabase
          .from("clock_entries")
          .select("job_id, total_hours, clock_in, clock_out, is_overtime, ot_status, jobs:jobs(id, name, address)")
          .eq("worker_id", worker.id)
          .gte("clock_in", format(weekStart, "yyyy-MM-dd"))
          .lt("clock_in", format(addDays(weekStart, 7), "yyyy-MM-dd"))
          .not("clock_out", "is", null);

        if (clockError) {
          console.error("Error fetching clock entries for worker", worker.name, ":", clockError);
        }

        // Filter out unapproved overtime
        const filteredClockEntries = clockEntries?.filter(entry => 
          !entry.is_overtime || entry.ot_status === 'approved'
        ) || [];

        // Skip workers who have no completed clock entries during the selected week
        if (filteredClockEntries.length === 0) {
          continue;
        }

        console.log(`Clock entries for ${worker.name}:`, clockEntries?.length || 0, clockEntries);

        // Calculate total hours using unified logic:
        // Use total_hours if available, otherwise calculate from timestamps, default to 0 for incomplete entries
        let totalHours = 0;
        const jobsMap = new Map();

        filteredClockEntries?.forEach((entry: any) => {
          // Calculate hours for this entry
          const hours =
            entry.total_hours != null
              ? Number(entry.total_hours)
              : entry.clock_in && entry.clock_out
                ? (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000
                : 0;

          totalHours += hours;

          // Aggregate job data using joined job information
          if (entry.job_id && entry.jobs) {
            if (jobsMap.has(entry.job_id)) {
              jobsMap.get(entry.job_id).hours += hours;
            } else {
              jobsMap.set(entry.job_id, {
                job_id: entry.job_id,
                job_name: entry.jobs.name || "Unknown Job",
                job_address: entry.jobs.address || "",
                hours,
              });
            }
          }
        });

        console.log(`Aggregated jobs for ${worker.name}:`, Array.from(jobsMap.values()));

        const jobs = Array.from(jobsMap.values());

        // Get additional costs
        const { data: costs } = await supabase
          .from("additional_costs")
          .select("amount")
          .eq("worker_id", worker.id)
          .gte("date", format(weekStart, "yyyy-MM-dd"))
          .lte("date", format(weekEnd, "yyyy-MM-dd"));

        const additionalCosts = costs?.reduce((sum, cost) => sum + Number(cost.amount), 0) || 0;

        // Get profile photo
        const { data: photoData } = await supabase
          .from("clock_entries")
          .select("clock_in_photo")
          .eq("worker_id", worker.id)
          .not("clock_in_photo", "is", null)
          .order("clock_in", { ascending: true })
          .limit(1);

        reportData.push({
          worker_id: worker.id,
          worker_name: worker.name,
          worker_email: worker.email || "",
          total_hours: totalHours,
          hourly_rate: worker.hourly_rate,
          jobs: jobs,
          additional_costs: additionalCosts,
          total_amount: totalHours * worker.hourly_rate + additionalCosts,
          profile_photo: photoData?.[0]?.clock_in_photo || undefined,
        });
    }

    setWeeklyData(reportData);
  };

  const generateDetailedReport = async () => {
    setLoading(true);
    try {
      const weekStart = new Date(selectedWeek);

      // Unified date filtering: weekStart (inclusive) to weekStart + 7 days (exclusive)
      const { data: entries, error } = await supabase
        .from("clock_entries")
        .select(
          `
          *,
          workers(name),
          jobs(name)
        `,
        )
        .gte("clock_in", format(weekStart, "yyyy-MM-dd"))
        .lt("clock_in", format(addDays(weekStart, 7), "yyyy-MM-dd"))
        .not("clock_out", "is", null)
        .order("worker_id")
        .order("clock_in");

      if (error) throw error;

      // Filter out unapproved overtime
      const filteredEntries = (entries || []).filter(entry => 
        !entry.is_overtime || entry.ot_status === 'approved'
      );

      const detailedEntries: DetailedEntry[] = [];
      const workerPhotos: Record<string, string> = {};

      for (const entry of filteredEntries) {
        // Get profile photo if not already fetched
        if (!workerPhotos[entry.worker_id]) {
          const { data: photoData } = await supabase
            .from("clock_entries")
            .select("clock_in_photo")
            .eq("worker_id", entry.worker_id)
            .not("clock_in_photo", "is", null)
            .order("clock_in", { ascending: true })
            .limit(1);

          workerPhotos[entry.worker_id] = photoData?.[0]?.clock_in_photo || "";
        }

        detailedEntries.push({
          id: entry.id,
          worker_id: entry.worker_id,
          worker_name: entry.workers?.name || "Unknown",
          date: format(new Date(entry.clock_in), "yyyy-MM-dd"),
          job_name: entry.jobs?.name || "Unknown Job",
          clock_in: entry.clock_in,
          clock_out: entry.clock_out,
          clock_in_photo: entry.clock_in_photo,
          clock_out_photo: entry.clock_out_photo,
          hours: entry.total_hours || 0,
          profile_photo: workerPhotos[entry.worker_id],
        });
      }

      setDetailedData(detailedEntries);
    } catch (error) {
      console.error("Error generating detailed report:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkerExpansion = (workerId: string) => {
    setExpandedWorkers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(workerId)) {
        newSet.delete(workerId);
      } else {
        newSet.add(workerId);
      }
      return newSet;
    });
  };

  const getWorkerDetailedEntries = (workerId: string) => {
    return detailedData.filter((entry) => entry.worker_id === workerId);
  };

  const groupEntriesByDate = (entries: DetailedEntry[]) => {
    const grouped: Record<string, DetailedEntry[]> = {};
    entries.forEach((entry) => {
      if (!grouped[entry.date]) {
        grouped[entry.date] = [];
      }
      grouped[entry.date].push(entry);
    });
    return grouped;
  };

  // Utility functions for Xero export
  const parseWorkerAddress = (address: string | null) => {
    if (!address) {
      return {
        addressLine1: "",
        city: "",
        region: "",
        postcode: "",
      };
    }

    const parts = address.split(",").map((part) => part.trim());

    // Extract postcode (last part matching UK pattern)
    const postcodeRegex = /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}$/i;
    const lastPart = parts[parts.length - 1] || "";
    const postcode = postcodeRegex.test(lastPart) ? lastPart : "";

    // Extract city (second to last part, or second part if no valid postcode)
    let city = "";
    if (postcode && parts.length >= 2) {
      city = parts[parts.length - 2] || "";
    } else if (parts.length >= 2) {
      city = parts[1] || "";
    }

    // Extract address line 1 (first part)
    const addressLine1 = parts[0] || "";

    // Region could be third part if available
    let region = "";
    if (parts.length >= 3 && postcode) {
      region = parts[parts.length - 3] || "";
    }

    return {
      addressLine1,
      city,
      region,
      postcode,
    };
  };

  const getNextInvoiceNumber = (): number => {
    const lastNumber = parseInt(
      localStorage.getItem("xero_last_invoice_number") || xeroSettings.startingNumber.toString(),
    );
    return lastNumber + 1;
  };

  const fetchWorkerData = async () => {
    const weekStart = new Date(selectedWeek);
    const weekEnd = addDays(weekStart, 6);

    try {
      const { data: entriesData, error: entriesError } = await supabase
        .from("clock_entries")
        .select(
          `
          *,
          workers (id, name, hourly_rate, email, address),
          jobs (id, name, address)
        `,
        )
        .gte("clock_in", format(weekStart, "yyyy-MM-dd"))
        .lte("clock_in", format(weekEnd, "yyyy-MM-dd"))
        .not("total_hours", "is", null);

      if (entriesError) throw entriesError;

      const { data: costsData, error: costsError } = await supabase
        .from("additional_costs")
        .select(
          `
          *,
          workers (id, name, email, address),
          clock_entries!inner (
            id,
            jobs (id, name)
          )
        `,
        )
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .not("clock_entry_id", "is", null);

      if (costsError) throw costsError;

      // Group by worker, then by job
      const workerMap = new Map<
        string,
        {
          workerId: string;
          workerName: string;
          workerEmail: string;
          workerAddress: string;
          jobs: Map<
            string,
            {
              jobId: string;
              jobName: string;
              totalHours: number;
              hourlyRate: number;
              expenses: Array<{
                amount: number;
                description: string;
              }>;
            }
          >;
          additionalCosts: Array<{
            amount: number;
            description: string;
            jobName?: string;
          }>;
        }
      >();

      // Process time entries
      entriesData?.forEach((entry: any) => {
        const workerId = entry.workers.id;
        const jobId = entry.jobs.id;

        if (!workerMap.has(workerId)) {
          workerMap.set(workerId, {
            workerId,
            workerName: entry.workers.name,
            workerEmail: entry.workers.email || "",
            workerAddress: entry.workers.address || "",
            jobs: new Map(),
            additionalCosts: [],
          });
        }

        const worker = workerMap.get(workerId)!;

        if (!worker.jobs.has(jobId)) {
          worker.jobs.set(jobId, {
            jobId,
            jobName: entry.jobs.name,
            totalHours: 0,
            hourlyRate: entry.workers.hourly_rate,
            expenses: [],
          });
        }

        const job = worker.jobs.get(jobId)!;
        job.totalHours += parseFloat(entry.total_hours) || 0;
      });

      // Process additional costs and link them to specific jobs
      costsData?.forEach((cost: any) => {
        const workerId = cost.workers.id;
        const jobId = cost.clock_entries?.jobs?.id;
        const jobName = cost.clock_entries?.jobs?.name;

        if (workerMap.has(workerId)) {
          const worker = workerMap.get(workerId)!;

          // If we have a job ID, link the expense to that specific job
          if (jobId && worker.jobs.has(jobId)) {
            const job = worker.jobs.get(jobId)!;
            job.expenses.push({
              amount: parseFloat(cost.amount) || 0,
              description: cost.description || "Additional Cost",
            });
          } else {
            // Fallback: add to general additional costs
            worker.additionalCosts.push({
              amount: parseFloat(cost.amount) || 0,
              description: cost.description || "Additional Cost",
              jobName: jobName || "General",
            });
          }
        }
      });

      return Array.from(workerMap.values());
    } catch (error) {
      console.error("Error fetching worker data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch data for Xero export",
        variant: "destructive",
      });
      return [];
    }
  };

  const generateXeroCSV = async () => {
    const startDate = new Date(selectedWeek);
    const endDate = new Date(selectedWeek);
    endDate.setDate(endDate.getDate() + 6); // End of week

    const workerData = await fetchWorkerData();

    if (workerData.length === 0) {
      toast({
        title: "No Data",
        description: "No timesheet data found for the selected week",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "*ContactName",
      "EmailAddress",
      "POAddressLine1",
      "POAddressLine2",
      "POAddressLine3",
      "POAddressLine4",
      "POCity",
      "PORegion",
      "POPostalCode",
      "POCountry",
      "*InvoiceNumber",
      "*InvoiceDate",
      "*DueDate",
      "Total",
      "InventoryItemCode",
      "Description",
      "*Quantity",
      "*UnitAmount",
      "*AccountCode",
      "*TaxType",
      "TaxAmount",
      "TrackingName1",
      "TrackingOption1",
      "TrackingName2",
      "TrackingOption2",
      "Currency",
    ];

    const today = new Date();
    const invoiceDate = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;

    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + xeroSettings.paymentTerms);
    const dueDateStr = `${dueDate.getDate().toString().padStart(2, "0")}/${(dueDate.getMonth() + 1).toString().padStart(2, "0")}/${dueDate.getFullYear()}`;

    const weekNumber = getWeek(startDate);
    const year = getYear(startDate);

    let csvContent = headers.join(",") + "\n";
    let currentInvoiceNumber = getNextInvoiceNumber();

    workerData.forEach((worker) => {
      const addressInfo = parseWorkerAddress(worker.workerAddress);
      const invoiceNum = `${xeroSettings.prefix}-${year}-${currentInvoiceNumber.toString().padStart(4, "0")}`;

      // Add line items for each job the worker worked on
      worker.jobs.forEach((job) => {
        if (job.totalHours > 0) {
          // Add labour line item
          const labourRow = [
            `"${worker.workerName}"`,
            `"${worker.workerEmail}"`,
            `"${addressInfo.addressLine1}"`,
            '""', // POAddressLine2
            '""', // POAddressLine3
            '""', // POAddressLine4
            `"${addressInfo.city}"`,
            `"${addressInfo.region}"`,
            `"${addressInfo.postcode}"`,
            '"United Kingdom"',
            `"${invoiceNum}"`,
            `"${invoiceDate}"`,
            `"${dueDateStr}"`,
            '""', // Total (Xero calculates)
            '""', // InventoryItemCode
            `"Construction Work - ${job.jobName} - Week ${weekNumber} ${year}"`,
            job.totalHours.toFixed(2),
            job.hourlyRate.toFixed(2),
            `"${xeroSettings.accountCode}"`,
            `"${xeroSettings.taxType}"`,
            '""', // TaxAmount (Xero calculates)
            '"Project"',
            `"${job.jobName}"`,
            '""', // TrackingName2
            '""', // TrackingOption2
            '"GBP"',
          ];
          csvContent += labourRow.join(",") + "\n";

          // Add expenses for this specific job
          job.expenses.forEach((expense) => {
            const expenseRow = [
              `"${worker.workerName}"`,
              `"${worker.workerEmail}"`,
              `"${addressInfo.addressLine1}"`,
              '""', // POAddressLine2
              '""', // POAddressLine3
              '""', // POAddressLine4
              `"${addressInfo.city}"`,
              `"${addressInfo.region}"`,
              `"${addressInfo.postcode}"`,
              '"United Kingdom"',
              `"${invoiceNum}"`,
              `"${invoiceDate}"`,
              `"${dueDateStr}"`,
              '""', // Total (Xero calculates)
              '""', // InventoryItemCode
              `"${expense.description} - ${job.jobName} - Week ${weekNumber} ${year}"`,
              "1",
              expense.amount.toFixed(2),
              `"${xeroSettings.accountCode}"`,
              `"${xeroSettings.taxType}"`,
              '""', // TaxAmount (Xero calculates)
              '"Project"',
              `"${job.jobName}"`, // Same job tracking as labour
              '""', // TrackingName2
              '""', // TrackingOption2
              '"GBP"',
            ];
            csvContent += expenseRow.join(",") + "\n";
          });
        }
      });

      // Add any general additional costs (fallback for expenses not linked to specific clock entries)
      worker.additionalCosts.forEach((cost) => {
        const row = [
          `"${worker.workerName}"`,
          `"${worker.workerEmail}"`,
          `"${addressInfo.addressLine1}"`,
          '""', // POAddressLine2
          '""', // POAddressLine3
          '""', // POAddressLine4
          `"${addressInfo.city}"`,
          `"${addressInfo.region}"`,
          `"${addressInfo.postcode}"`,
          '"United Kingdom"',
          `"${invoiceNum}"`,
          `"${invoiceDate}"`,
          `"${dueDateStr}"`,
          '""', // Total (Xero calculates)
          '""', // InventoryItemCode
          `"Additional Costs - ${cost.description}"`,
          "1",
          cost.amount.toFixed(2),
          `"${xeroSettings.accountCode}"`,
          `"${xeroSettings.taxType}"`,
          '""', // TaxAmount (Xero calculates)
          '"Project"',
          `"${cost.jobName || "General"}"`, // Use job name from cost or default to General
          '""', // TrackingName2
          '""', // TrackingOption2
          '"GBP"',
        ];
        csvContent += row.join(",") + "\n";
      });

      currentInvoiceNumber++;
    });

    // Update the last used invoice number
    localStorage.setItem("xero_last_invoice_number", currentInvoiceNumber.toString());

    // Download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];
    const filename = `Xero_Export_${startDateStr}_to_${endDateStr}.csv`;

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Xero invoice file "${filename}" exported successfully`,
    });
  };

  const generateCSV = () => {
    const weekStart = new Date(selectedWeek);
    const weekEnd = addDays(weekStart, 6);
    const invoiceDate = format(weekStart, "yyyy-MM-dd");
    const dueDate = format(addDays(weekStart, 7), "yyyy-MM-dd");

    const csvHeaders = [
      "ContactName",
      "EmailAddress",
      "InvoiceNumber",
      "InvoiceDate",
      "DueDate",
      "Description",
      "Quantity",
      "UnitAmount",
      "AccountCode",
      "TaxType",
      "TrackingName1",
      "TrackingOption1",
    ];

    const csvRows = weeklyData
      .filter((worker) => worker.total_hours > 0) // Only include workers with hours
      .map((worker, index) => {
        // TrackingOption1: Collect ALL job names where worker had clock entries (comma-separated)
        // If worker has job entries (even with 0 hours due to incomplete clock-out), include those job names
        // If no job entries exist, default to "General Work"
        let trackingOption1 = "General Work";

        if (worker.jobs && worker.jobs.length > 0) {
          const jobNames = worker.jobs.map((job) => job.job_name).filter(Boolean);
          if (jobNames.length > 0) {
            trackingOption1 = jobNames.join(", ");
          }
        }

        // Escape quotes in CSV fields
        const escapeCSV = (field: string) => field.replace(/"/g, '""');

        return [
          escapeCSV(worker.worker_name),
          escapeCSV(worker.worker_email || ""), // Use real worker email
          `WE-${format(weekEnd, "yyyyMMdd")}-${worker.worker_id.slice(-4)}`,
          invoiceDate,
          dueDate,
          escapeCSV(`Construction work - Week ending ${format(weekEnd, "dd/MM/yyyy")}`),
          worker.total_hours.toFixed(2),
          worker.hourly_rate.toFixed(2),
          "200",
          "No VAT",
          "Job",
          escapeCSV(trackingOption1),
        ];
      });

    const csvContent = [csvHeaders, ...csvRows].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-report-${format(weekEnd, "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "CSV file downloaded successfully",
    });
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8 flex items-center justify-center gap-4 relative">
          <div className="flex-1" />
          <div className="flex flex-col items-center">
            <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground mb-2">Weekly Reports</h1>
            <p className="text-muted-foreground">Generate Xero-compatible payroll reports</p>
          </div>
          <div className="flex-1 flex justify-end">
            <Button
              variant="outline"
              onClick={handleTutorialReplay}
              className="flex items-center gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              Tutorial
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Report Settings</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 items-end">
            <div>
              <Label htmlFor="week-selector">Week Starting (Monday)</Label>
              <Input 
                id="week-selector" 
                type="date" 
                value={selectedWeek} 
                onChange={(e) => setSelectedWeek(e.target.value)} 
              />
            </div>
            <Button onClick={generateReport} disabled={loading} className="generate-report-button">
              {loading ? "Generating..." : "Generate Report"}
            </Button>
            <Button onClick={generateCSV} disabled={weeklyData.length === 0} variant="outline" className="download-csv-button">
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </CardContent>
        </Card>

        <Tabs defaultValue="summary" className="space-y-4 reports-tabs">
          <TabsList>
            <TabsTrigger value="summary">Weekly Summary</TabsTrigger>
            <TabsTrigger value="detailed">Detailed Timesheet</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Weekly Summary</CardTitle>
                  <div className="flex items-center gap-2">
                    <XeroSettingsModal onSettingsChange={setXeroSettings} />
                    <Button 
                      id="export-xero-btn"
                      onClick={generateXeroCSV} 
                      disabled={weeklyData.length === 0 || loading} 
                      variant="outline"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export to Xero
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table id="timesheet-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Additional Costs</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6">
                          No data for selected week
                        </TableCell>
                      </TableRow>
                    ) : (
                      weeklyData.map((worker) => (
                        <TableRow key={worker.worker_id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {worker.profile_photo ? (
                                  <>
                                    <AvatarImage src={worker.profile_photo} alt={worker.worker_name} />
                                    <AvatarFallback>
                                      {worker.worker_name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </>
                                ) : (
                                  <AvatarFallback>
                                    {worker.worker_name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              {worker.worker_name}
                            </div>
                          </TableCell>
                          <TableCell>{worker.total_hours.toFixed(1)}h</TableCell>
                          <TableCell>£{worker.hourly_rate.toFixed(2)}</TableCell>
                          <TableCell>£{worker.additional_costs.toFixed(2)}</TableCell>
                          <TableCell className="font-semibold">£{worker.total_amount.toFixed(2)}</TableCell>
                          <TableCell>
                            {worker.profile_photo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setPhotoModal({
                                    isOpen: true,
                                    photoUrl: worker.profile_photo!,
                                    workerName: worker.worker_name,
                                    timestamp: "Profile Photo",
                                  })
                                }
                              >
                                <Camera className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Timesheet</CardTitle>
              </CardHeader>
              <CardContent>
                {detailedData.length === 0 ? (
                  <div className="text-center py-6">No detailed data for selected week</div>
                ) : (
                  <div className="space-y-4">
                    {Array.from(new Set(detailedData.map((entry) => entry.worker_id))).map((workerId) => {
                      const workerEntries = getWorkerDetailedEntries(workerId);
                      const workerName = workerEntries[0]?.worker_name;
                      const totalHours = workerEntries.reduce((sum, entry) => sum + entry.hours, 0);
                      const isExpanded = expandedWorkers.has(workerId);
                      const groupedByDate = groupEntriesByDate(workerEntries);

                      return (
                        <Collapsible key={workerId}>
                          <CollapsibleTrigger
                            className="row-expand-btn flex items-center justify-between w-full p-4 bg-muted rounded-lg hover:bg-muted/80"
                            onClick={() => toggleWorkerExpansion(workerId)}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {workerEntries[0]?.profile_photo ? (
                                  <>
                                    <AvatarImage src={workerEntries[0].profile_photo} alt={workerName} />
                                    <AvatarFallback>
                                      {workerName
                                        ?.split(" ")
                                        .map((n) => n[0])
                                        .join("")
                                        .slice(0, 2)
                                        .toUpperCase()}
                                    </AvatarFallback>
                                  </>
                                ) : (
                                  <AvatarFallback>
                                    {workerName
                                      ?.split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <span className="font-semibold">{workerName}</span>
                              <span className="text-muted-foreground">| Total Hours: {totalHours.toFixed(1)}</span>
                            </div>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </CollapsibleTrigger>

                          <CollapsibleContent className="space-y-2 mt-2">
                            {Object.entries(groupedByDate).map(([date, dayEntries]) => (
                              <div key={date} className="ml-4 space-y-1">
                                <div className="font-medium text-sm">
                                  {moment(date).format("dddd DD/MM")} | {dayEntries[0]?.job_name}
                                </div>
                                {dayEntries.map((entry) => (
                                  <div key={entry.id} className="ml-4 text-sm space-y-2 py-2">
                                    <div className="flex items-center gap-4">
                                      <span>Clock In: {moment(entry.clock_in).format("HH:mm")}</span>
                                      <span>| Clock Out: {moment(entry.clock_out).format("HH:mm")}</span>
                                      <span>| Hours: {entry.hours.toFixed(1)}</span>
                                    </div>

                                    {(entry.clock_in_photo || entry.clock_out_photo) && (
                                      <div className="flex items-center gap-4 mt-3">
                                        {entry.clock_in_photo && (
                                          <div className="flex flex-col items-center">
                                            <p className="text-xs font-body text-muted-foreground mb-1">Clock In</p>
                                            <div className="relative group">
                                              <img
                                                src={entry.clock_in_photo}
                                                alt="Clock in"
                                                className="w-16 h-16 rounded-full object-cover border-2 border-border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg"
                                                onClick={() => window.open(entry.clock_in_photo, "_blank")}
                                              />
                                              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-all duration-200 pointer-events-none"></div>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-body mt-1">
                                              {moment(entry.clock_in).format("h:mm A")}
                                            </p>
                                          </div>
                                        )}

                                        {entry.clock_out_photo && (
                                          <div className="flex flex-col items-center">
                                            <p className="text-xs font-body text-muted-foreground mb-1">Clock Out</p>
                                            <div className="relative group">
                                              <img
                                                src={entry.clock_out_photo}
                                                alt="Clock out"
                                                className="w-16 h-16 rounded-full object-cover border-2 border-border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-lg"
                                                onClick={() => window.open(entry.clock_out_photo, "_blank")}
                                              />
                                              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-all duration-200 pointer-events-none"></div>
                                            </div>
                                            <p className="text-xs text-muted-foreground font-body mt-1">
                                              {entry.clock_out ? moment(entry.clock_out).format("h:mm A") : "Active"}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <PhotoModal
          isOpen={photoModal.isOpen}
          onClose={() => setPhotoModal((prev) => ({ ...prev, isOpen: false }))}
          photoUrl={photoModal.photoUrl}
          workerName={photoModal.workerName}
          timestamp={photoModal.timestamp}
          jobName={photoModal.jobName}
        />
      </div>

      {/* Reports Tutorial */}
      <OnboardingTour
        steps={reportsSteps}
        run={showTutorial}
        onComplete={handleTutorialEnd}
        onSkip={handleTutorialEnd}
      />
      
      <CompletionModal
        open={showCompletionModal}
        onReplay={handleTutorialReplay}
        onClose={handleCompletionClose}
        description="You now know how to generate and manage reports! If you want a refresher later, just click the 'Tutorial' button on this page."
        exploreButtonText="Explore Reports"
      />
    </Layout>
  );
}
