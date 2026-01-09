import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import {
  ReportLineItem,
  EntryType,
  generateDescription,
  getDefaultAccountCode,
  getDefaultTaxType,
} from "@/lib/report-utils";

interface UseReportLineItemsOptions {
  organizationId: string | null;
  weekStart: string;
}

export function useReportLineItems({ organizationId, weekStart }: UseReportLineItemsOptions) {
  const [lineItems, setLineItems] = useState<ReportLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * Fetch existing line items or generate from source data
   */
  const fetchOrGenerateLineItems = useCallback(async () => {
    if (!organizationId || !weekStart) return;

    setLoading(true);
    try {
      // First, check if we have existing line items for this week
      // Use 'as any' because table may not exist in types yet
      const { data: existingItems, error: fetchError } = await (supabase
        .from("report_line_items" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .eq("week_start", weekStart)
        .eq("is_deleted", false) as any);

      if (fetchError) {
        console.error("Error fetching line items:", fetchError);
        // Table might not exist yet, generate from source
        await generateFromSource();
        return;
      }

      if (existingItems && existingItems.length > 0) {
        // Fetch worker and job names for display
        const enrichedItems = await enrichLineItems(existingItems);
        setLineItems(enrichedItems);
      } else {
        // Generate from source data
        await generateFromSource();
      }
    } catch (error) {
      console.error("Error in fetchOrGenerateLineItems:", error);
      // Fallback to generating from source
      await generateFromSource();
    } finally {
      setLoading(false);
    }
  }, [organizationId, weekStart]);

  /**
   * Generate line items from clock entries and additional costs
   */
  const generateFromSource = useCallback(async () => {
    if (!organizationId || !weekStart) return;

    setLoading(true);
    try {
      const weekStartDate = new Date(weekStart);
      const weekEnd = addDays(weekStartDate, 6);

      // Fetch clock entries
      const { data: clockEntries, error: clockError } = await supabase
        .from("clock_entries")
        .select(`
          *,
          workers (id, name, email, hourly_rate, address, organization_id),
          jobs (id, name)
        `)
        .gte("clock_in", format(weekStartDate, "yyyy-MM-dd"))
        .lt("clock_in", format(addDays(weekStartDate, 7), "yyyy-MM-dd"))
        .not("clock_out", "is", null)
        .not("total_hours", "is", null);

      if (clockError) throw clockError;

      // Filter to organization
      const orgClockEntries = clockEntries?.filter(
        (entry: any) => entry.workers?.organization_id === organizationId
      ) || [];

      // Fetch additional costs
      const { data: additionalCosts, error: costsError } = await supabase
        .from("additional_costs")
        .select(`
          *,
          workers (id, name, email, address, organization_id),
          expense_types (name, calculation_type),
          clock_entries (
            id,
            clock_in,
            total_hours,
            jobs (id, name)
          )
        `)
        .gte("date", format(weekStartDate, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"));

      if (costsError) throw costsError;

      // Filter to organization
      const orgCosts = additionalCosts?.filter(
        (cost: any) => cost.workers?.organization_id === organizationId
      ) || [];

      // Generate line items from clock entries
      const generatedItems: ReportLineItem[] = [];

      // Group clock entries by worker, date, job, and overtime status
      const entryGroups = new Map<string, any>();

      orgClockEntries.forEach((entry: any) => {
        const isOvertime = entry.is_overtime || false;
        // Skip unapproved overtime
        if (isOvertime && entry.ot_status !== "approved") return;

        const entryDate = format(new Date(entry.clock_in), "yyyy-MM-dd");
        const key = `${entry.worker_id}-${entryDate}-${entry.job_id}-${isOvertime}`;

        if (entryGroups.has(key)) {
          const existing = entryGroups.get(key);
          existing.totalHours += parseFloat(entry.total_hours) || 0;
        } else {
          entryGroups.set(key, {
            workerId: entry.worker_id,
            workerName: entry.workers?.name || "Unknown",
            workerEmail: entry.workers?.email || "",
            workerAddress: entry.workers?.address || "",
            date: entryDate,
            jobId: entry.job_id,
            jobName: entry.jobs?.name || "Unknown Job",
            totalHours: parseFloat(entry.total_hours) || 0,
            hourlyRate: entry.workers?.hourly_rate || 0,
            isOvertime,
            sourceClockEntryId: entry.id,
          });
        }
      });

      // Convert grouped entries to line items
      entryGroups.forEach((group) => {
        const entryType: EntryType = group.isOvertime ? "overtime" : "work";
        const workDate = new Date(group.date);

        generatedItems.push({
          id: crypto.randomUUID(),
          organization_id: organizationId,
          week_start: weekStart,
          worker_id: group.workerId,
          worker_name: group.workerName,
          worker_email: group.workerEmail,
          worker_address: group.workerAddress,
          work_date: group.date,
          entry_type: entryType,
          expense_type: null,
          quantity: group.totalHours,
          unit_amount: group.hourlyRate,
          project_id: group.jobId,
          project_name: group.jobName,
          account_code: getDefaultAccountCode(entryType),
          tax_type: getDefaultTaxType(),
          description_generated: generateDescription(entryType, null, workDate),
          source_clock_entry_id: group.sourceClockEntryId,
          source_additional_cost_id: null,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      // Add expense line items
      orgCosts.forEach((cost: any) => {
        const expenseType = (cost.expense_types as any)?.name || cost.description || "Expense";
        const costDate = cost.date || (cost.clock_entries?.clock_in ? format(new Date(cost.clock_entries.clock_in), "yyyy-MM-dd") : weekStart);
        const jobId = (cost.clock_entries as any)?.jobs?.id || null;
        const jobName = (cost.clock_entries as any)?.jobs?.name || "General";

        // Handle calculation type
        let quantity = 1;
        let unitAmount = parseFloat(cost.amount) || 0;
        const calcType = (cost.expense_types as any)?.calculation_type || "flat_rate";

        if (calcType === "hourly_multiplied" && (cost.clock_entries as any)?.total_hours) {
          quantity = parseFloat((cost.clock_entries as any).total_hours) || 1;
        }

        generatedItems.push({
          id: crypto.randomUUID(),
          organization_id: organizationId,
          week_start: weekStart,
          worker_id: cost.worker_id,
          worker_name: (cost.workers as any)?.name || "Unknown",
          worker_email: (cost.workers as any)?.email || "",
          worker_address: (cost.workers as any)?.address || "",
          work_date: costDate,
          entry_type: "expense",
          expense_type: expenseType,
          quantity,
          unit_amount: unitAmount,
          project_id: jobId,
          project_name: jobName,
          account_code: getDefaultAccountCode("expense"),
          tax_type: getDefaultTaxType(),
          description_generated: generateDescription("expense", expenseType, new Date(costDate)),
          source_clock_entry_id: cost.clock_entry_id,
          source_additional_cost_id: cost.id,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      });

      // Sort by worker name, then date
      generatedItems.sort((a, b) => {
        const nameCompare = (a.worker_name || "").localeCompare(b.worker_name || "");
        if (nameCompare !== 0) return nameCompare;
        return a.work_date.localeCompare(b.work_date);
      });

      setLineItems(generatedItems);
    } catch (error) {
      console.error("Error generating line items from source:", error);
      toast({
        title: "Error",
        description: "Failed to generate line items from timesheet data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, weekStart]);

  /**
   * Enrich line items with worker and job names
   */
  const enrichLineItems = async (items: any[]): Promise<ReportLineItem[]> => {
    const workerIds = [...new Set(items.map((i) => i.worker_id))];
    const jobIds = [...new Set(items.map((i) => i.project_id).filter(Boolean))];

    // Fetch workers
    const { data: workers } = await supabase
      .from("workers")
      .select("id, name, email, address")
      .in("id", workerIds);

    // Fetch jobs
    const { data: jobs } = jobIds.length > 0
      ? await supabase.from("jobs").select("id, name").in("id", jobIds)
      : { data: [] };

    const workerMap = new Map<string, any>();
    workers?.forEach((w) => workerMap.set(w.id, w));

    const jobMap = new Map<string, any>();
    jobs?.forEach((j: any) => jobMap.set(j.id, j));

    return items.map((item) => {
      const worker = workerMap.get(item.worker_id);
      const job = jobMap.get(item.project_id);
      return {
        ...item,
        worker_name: worker?.name || "Unknown",
        worker_email: worker?.email || "",
        worker_address: worker?.address || "",
        project_name: item.project_name || job?.name || null,
      };
    });
  };

  /**
   * Update a line item and sync to source clock_entries if quantity changed
   */
  const updateLineItem = useCallback(async (
    itemId: string,
    updates: Partial<Pick<ReportLineItem, "entry_type" | "expense_type" | "quantity" | "unit_amount" | "project_id" | "project_name" | "account_code" | "tax_type">>
  ) => {
    setSaving(true);
    try {
      // Find the item
      const item = lineItems.find((i) => i.id === itemId);
      if (!item) throw new Error("Item not found");

      // Regenerate description if entry type or expense type changed
      let newDescription = item.description_generated;
      const newEntryType = updates.entry_type || item.entry_type;
      const newExpenseType = updates.expense_type !== undefined ? updates.expense_type : item.expense_type;

      if (updates.entry_type || updates.expense_type !== undefined) {
        newDescription = generateDescription(newEntryType, newExpenseType, item.work_date);
      }

      // Update account code if entry type changed
      let newAccountCode = updates.account_code || item.account_code;
      if (updates.entry_type && !updates.account_code) {
        newAccountCode = getDefaultAccountCode(updates.entry_type);
      }

      const updatedItem: ReportLineItem = {
        ...item,
        ...updates,
        description_generated: newDescription,
        account_code: newAccountCode,
        updated_at: new Date().toISOString(),
      };

      // Update local state
      setLineItems((prev) =>
        prev.map((i) => (i.id === itemId ? updatedItem : i))
      );

      // Sync quantity changes to source clock_entries
      if (updates.quantity !== undefined && item.source_clock_entry_id && item.entry_type !== "expense") {
        const oldQuantity = item.quantity;
        const newQuantity = updates.quantity;

        if (oldQuantity !== newQuantity) {
          // Get current clock entry data for history
          const { data: clockEntry } = await supabase
            .from("clock_entries")
            .select("total_hours, notes, clock_in, clock_out")
            .eq("id", item.source_clock_entry_id)
            .single();

          if (clockEntry) {
            // Update clock_entries.total_hours
            const existingNotes = clockEntry.notes || "";
            const updateNote = ` | Hours updated via report editor from ${oldQuantity} to ${newQuantity} on ${new Date().toISOString().split("T")[0]}`;
            
            await supabase
              .from("clock_entries")
              .update({
                total_hours: newQuantity,
                notes: existingNotes + updateNote,
              })
              .eq("id", item.source_clock_entry_id);

            // Add audit trail to clock_entry_history
            const { data: authData } = await supabase.auth.getUser();
            const { data: manager } = await supabase
              .from("managers")
              .select("id")
              .eq("email", authData?.user?.email || "")
              .single();

            if (manager) {
              await supabase.from("clock_entry_history").insert({
                clock_entry_id: item.source_clock_entry_id,
                changed_by: manager.id,
                change_type: "report_edit",
                old_total_hours: oldQuantity,
                new_total_hours: newQuantity,
                old_clock_in: clockEntry.clock_in,
                new_clock_in: clockEntry.clock_in,
                old_clock_out: clockEntry.clock_out,
                new_clock_out: clockEntry.clock_out,
                notes: `Hours updated via report editor`,
                metadata: {
                  source: "report_editor",
                  report_week: item.week_start,
                  work_date: item.work_date,
                },
              });
            }
          }
        }
      }

      // Sync entry_type changes to clock_entries.is_overtime
      if (updates.entry_type && item.source_clock_entry_id && item.entry_type !== "expense") {
        const isNowOvertime = updates.entry_type === "overtime";
        await supabase
          .from("clock_entries")
          .update({ is_overtime: isNowOvertime })
          .eq("id", item.source_clock_entry_id);
      }

      // Try to persist to database (will fail silently if table doesn't exist)
      try {
        await (supabase
          .from("report_line_items" as any)
          .upsert({
            id: updatedItem.id,
            organization_id: updatedItem.organization_id,
            week_start: updatedItem.week_start,
            worker_id: updatedItem.worker_id,
            work_date: updatedItem.work_date,
            entry_type: updatedItem.entry_type,
            expense_type: updatedItem.expense_type,
            quantity: updatedItem.quantity,
            unit_amount: updatedItem.unit_amount,
            project_id: updatedItem.project_id,
            project_name: updatedItem.project_name,
            account_code: updatedItem.account_code,
            tax_type: updatedItem.tax_type,
            description_generated: updatedItem.description_generated,
            source_clock_entry_id: updatedItem.source_clock_entry_id,
            source_additional_cost_id: updatedItem.source_additional_cost_id,
            is_deleted: updatedItem.is_deleted,
          }) as any);
      } catch (dbError) {
        console.log("Note: Line items not persisted to database (table may not exist yet)");
      }

      toast({
        title: "Changes saved!",
        description: "Line item updated successfully",
      });
    } catch (error) {
      console.error("Error updating line item:", error);
      toast({
        title: "Error",
        description: "Failed to update line item",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [lineItems]);

  /**
   * Delete a line item (soft delete)
   */
  const deleteLineItem = useCallback(async (itemId: string) => {
    setSaving(true);
    try {
      // Update local state
      setLineItems((prev) =>
        prev.filter((i) => i.id !== itemId)
      );

      // Try to persist to database
      try {
        await (supabase
          .from("report_line_items" as any)
          .update({ is_deleted: true })
          .eq("id", itemId) as any);
      } catch (dbError) {
        console.log("Note: Delete not persisted to database");
      }

      toast({
        title: "Deleted",
        description: "Line item removed",
      });
    } catch (error) {
      console.error("Error deleting line item:", error);
      toast({
        title: "Error",
        description: "Failed to delete line item",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, []);

  /**
   * Regenerate all line items from source data
   */
  const regenerateFromSource = useCallback(async () => {
    // Clear existing items in database
    if (organizationId && weekStart) {
      try {
        await (supabase
          .from("report_line_items" as any)
          .delete()
          .eq("organization_id", organizationId)
          .eq("week_start", weekStart) as any);
      } catch (dbError) {
        console.log("Note: Could not clear database items");
      }
    }

    // Generate fresh from source
    await generateFromSource();

    toast({
      title: "Regenerated",
      description: "Line items regenerated from timesheet data",
    });
  }, [organizationId, weekStart, generateFromSource]);

  /**
   * Get totals for summary
   */
  const getTotals = useCallback(() => {
    const workTotal = lineItems
      .filter((i) => i.entry_type === "work")
      .reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);

    const overtimeTotal = lineItems
      .filter((i) => i.entry_type === "overtime")
      .reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);

    const expenseTotal = lineItems
      .filter((i) => i.entry_type === "expense")
      .reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);

    return {
      workTotal,
      overtimeTotal,
      expenseTotal,
      grandTotal: workTotal + overtimeTotal + expenseTotal,
    };
  }, [lineItems]);

  return {
    lineItems,
    loading,
    saving,
    fetchOrGenerateLineItems,
    generateFromSource,
    updateLineItem,
    deleteLineItem,
    regenerateFromSource,
    getTotals,
  };
}
