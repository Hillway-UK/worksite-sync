/**
 * Report Service
 * Handles all report-related data operations
 * Following SOLID principles - Single Responsibility & Dependency Inversion
 */

import { supabase } from '@/integrations/supabase/client';
import { format, addDays } from 'date-fns';
import {
  ClockEntry,
  AdditionalCost,
  ServiceResult,
  createSuccessResult,
  createErrorResult,
  handleSupabaseError,
} from '../types';
import {
  ReportLineItem,
  EntryType,
  generateDescription,
  getDefaultAccountCode,
  getDefaultTaxType,
} from '@/lib/report-utils';

export interface ClockEntryWithRelations extends ClockEntry {
  workers?: {
    id: string;
    name: string;
    email: string;
    hourly_rate: number;
    address: string | null;
    organization_id: string;
  };
  jobs?: {
    id: string;
    name: string;
  };
}

export interface AdditionalCostWithRelations extends AdditionalCost {
  workers?: {
    id: string;
    name: string;
    email: string;
    address: string | null;
    organization_id: string;
  };
  expense_types?: {
    name: string;
    calculation_type: string;
  };
  clock_entries?: {
    id: string;
    clock_in: string;
    total_hours: number;
    jobs?: {
      id: string;
      name: string;
    };
  };
}

export interface ReportTotals {
  workTotal: number;
  overtimeTotal: number;
  expenseTotal: number;
  grandTotal: number;
}

export interface GenerateLineItemsOptions {
  organizationId: string;
  weekStart: string;
}

/**
 * Report Service class
 * Encapsulates all report-related data operations
 */
export class ReportService {
  /**
   * Fetch clock entries for a specific week and organization
   */
  async fetchClockEntries(
    organizationId: string,
    weekStart: string
  ): Promise<ServiceResult<ClockEntryWithRelations[]>> {
    try {
      const weekStartDate = new Date(weekStart);

      const { data, error } = await supabase
        .from('clock_entries')
        .select(`
          *,
          workers (id, name, email, hourly_rate, address, organization_id),
          jobs (id, name)
        `)
        .gte('clock_in', format(weekStartDate, 'yyyy-MM-dd'))
        .lt('clock_in', format(addDays(weekStartDate, 7), 'yyyy-MM-dd'))
        .not('clock_out', 'is', null)
        .not('total_hours', 'is', null);

      if (error) {
        return handleSupabaseError(error, 'fetchClockEntries');
      }

      // Filter to organization
      const orgEntries = (data || []).filter(
        (entry) => entry.workers?.organization_id === organizationId
      ) as ClockEntryWithRelations[];

      return createSuccessResult(orgEntries);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching clock entries',
        undefined,
        error
      );
    }
  }

  /**
   * Fetch additional costs for a specific week and organization
   */
  async fetchAdditionalCosts(
    organizationId: string,
    weekStart: string
  ): Promise<ServiceResult<AdditionalCostWithRelations[]>> {
    try {
      const weekStartDate = new Date(weekStart);
      const weekEnd = addDays(weekStartDate, 6);

      const { data, error } = await supabase
        .from('additional_costs')
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
        .gte('date', format(weekStartDate, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'));

      if (error) {
        return handleSupabaseError(error, 'fetchAdditionalCosts');
      }

      // Filter to organization
      const orgCosts = (data || []).filter(
        (cost) => cost.workers?.organization_id === organizationId
      ) as AdditionalCostWithRelations[];

      return createSuccessResult(orgCosts);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching additional costs',
        undefined,
        error
      );
    }
  }

  /**
   * Generate line items from clock entries and additional costs
   */
  generateLineItemsFromSource(
    clockEntries: ClockEntryWithRelations[],
    additionalCosts: AdditionalCostWithRelations[],
    organizationId: string,
    weekStart: string
  ): ReportLineItem[] {
    const generatedItems: ReportLineItem[] = [];

    // Group clock entries by worker, date, job, and overtime status
    const entryGroups = new Map<string, {
      workerId: string;
      workerName: string;
      workerEmail: string;
      workerAddress: string;
      date: string;
      jobId: string;
      jobName: string;
      totalHours: number;
      hourlyRate: number;
      isOvertime: boolean;
      sourceClockEntryId: string;
    }>();

    clockEntries.forEach((entry) => {
      const isOvertime = entry.is_overtime || false;
      // Skip unapproved overtime
      if (isOvertime && entry.ot_status !== 'approved') return;

      const entryDate = format(new Date(entry.clock_in), 'yyyy-MM-dd');
      const key = `${entry.worker_id}-${entryDate}-${entry.job_id}-${isOvertime}`;

      if (entryGroups.has(key)) {
        const existing = entryGroups.get(key)!;
        existing.totalHours += parseFloat(String(entry.total_hours)) || 0;
      } else {
        entryGroups.set(key, {
          workerId: entry.worker_id,
          workerName: entry.workers?.name || 'Unknown',
          workerEmail: entry.workers?.email || '',
          workerAddress: entry.workers?.address || '',
          date: entryDate,
          jobId: entry.job_id,
          jobName: entry.jobs?.name || 'Unknown Job',
          totalHours: parseFloat(String(entry.total_hours)) || 0,
          hourlyRate: entry.workers?.hourly_rate || 0,
          isOvertime,
          sourceClockEntryId: entry.id,
        });
      }
    });

    // Convert grouped entries to line items
    entryGroups.forEach((group) => {
      const entryType: EntryType = group.isOvertime ? 'overtime' : 'work';
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
    additionalCosts.forEach((cost) => {
      const expenseType = cost.expense_types?.name || cost.description || 'Expense';
      const costDate = cost.date ||
        (cost.clock_entries?.clock_in
          ? format(new Date(cost.clock_entries.clock_in), 'yyyy-MM-dd')
          : weekStart);
      const jobId = cost.clock_entries?.jobs?.id || null;
      const jobName = cost.clock_entries?.jobs?.name || 'General';

      // Handle calculation type
      let quantity = 1;
      const unitAmount = parseFloat(String(cost.amount)) || 0;
      const calcType = cost.expense_types?.calculation_type || 'flat_rate';

      if (calcType === 'hourly_multiplied' && cost.clock_entries?.total_hours) {
        quantity = parseFloat(String(cost.clock_entries.total_hours)) || 1;
      }

      generatedItems.push({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        week_start: weekStart,
        worker_id: cost.worker_id,
        worker_name: cost.workers?.name || 'Unknown',
        worker_email: cost.workers?.email || '',
        worker_address: cost.workers?.address || '',
        work_date: costDate,
        entry_type: 'expense',
        expense_type: expenseType,
        quantity,
        unit_amount: unitAmount,
        project_id: jobId,
        project_name: jobName,
        account_code: getDefaultAccountCode('expense'),
        tax_type: getDefaultTaxType(),
        description_generated: generateDescription('expense', expenseType, new Date(costDate)),
        source_clock_entry_id: cost.clock_entry_id,
        source_additional_cost_id: cost.id,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    // Sort by worker name, then date
    generatedItems.sort((a, b) => {
      const nameCompare = (a.worker_name || '').localeCompare(b.worker_name || '');
      if (nameCompare !== 0) return nameCompare;
      return a.work_date.localeCompare(b.work_date);
    });

    return generatedItems;
  }

  /**
   * Calculate totals from line items
   */
  calculateTotals(lineItems: ReportLineItem[]): ReportTotals {
    const workTotal = lineItems
      .filter((i) => i.entry_type === 'work')
      .reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);

    const overtimeTotal = lineItems
      .filter((i) => i.entry_type === 'overtime')
      .reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);

    const expenseTotal = lineItems
      .filter((i) => i.entry_type === 'expense')
      .reduce((sum, i) => sum + i.quantity * i.unit_amount, 0);

    return {
      workTotal,
      overtimeTotal,
      expenseTotal,
      grandTotal: workTotal + overtimeTotal + expenseTotal,
    };
  }

  /**
   * Update clock entry total hours with audit trail
   */
  async updateClockEntryHours(
    clockEntryId: string,
    oldHours: number,
    newHours: number,
    workDate: string,
    weekStart: string,
    managerEmail: string
  ): Promise<ServiceResult<void>> {
    try {
      // Get current clock entry data
      const { data: clockEntry, error: fetchError } = await supabase
        .from('clock_entries')
        .select('total_hours, notes, clock_in, clock_out')
        .eq('id', clockEntryId)
        .single();

      if (fetchError) {
        return handleSupabaseError(fetchError, 'updateClockEntryHours');
      }

      if (!clockEntry) {
        return createErrorResult('NOT_FOUND', 'Clock entry not found');
      }

      // Update clock entry
      const existingNotes = clockEntry.notes || '';
      const updateNote = ` | Hours updated via report editor from ${oldHours} to ${newHours} on ${new Date().toISOString().split('T')[0]}`;

      const { error: updateError } = await supabase
        .from('clock_entries')
        .update({
          total_hours: newHours,
          notes: existingNotes + updateNote,
        })
        .eq('id', clockEntryId);

      if (updateError) {
        return handleSupabaseError(updateError, 'updateClockEntryHours');
      }

      // Add audit trail
      const { data: manager } = await supabase
        .from('managers')
        .select('id')
        .eq('email', managerEmail)
        .single();

      if (manager) {
        await supabase.from('clock_entry_history').insert({
          clock_entry_id: clockEntryId,
          changed_by: manager.id,
          change_type: 'report_edit',
          old_total_hours: oldHours,
          new_total_hours: newHours,
          old_clock_in: clockEntry.clock_in,
          new_clock_in: clockEntry.clock_in,
          old_clock_out: clockEntry.clock_out,
          new_clock_out: clockEntry.clock_out,
          notes: 'Hours updated via report editor',
          metadata: {
            source: 'report_editor',
            report_week: weekStart,
            work_date: workDate,
          },
        });
      }

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while updating clock entry',
        undefined,
        error
      );
    }
  }

  /**
   * Update clock entry overtime status
   */
  async updateClockEntryOvertime(
    clockEntryId: string,
    isOvertime: boolean
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from('clock_entries')
        .update({ is_overtime: isOvertime })
        .eq('id', clockEntryId);

      if (error) {
        return handleSupabaseError(error, 'updateClockEntryOvertime');
      }

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while updating overtime status',
        undefined,
        error
      );
    }
  }

  /**
   * Enrich line items with worker and job names
   */
  async enrichLineItems(
    items: Partial<ReportLineItem>[]
  ): Promise<ServiceResult<ReportLineItem[]>> {
    try {
      const workerIds = [...new Set(items.map((i) => i.worker_id).filter(Boolean))] as string[];
      const jobIds = [...new Set(items.map((i) => i.project_id).filter(Boolean))] as string[];

      // Fetch workers
      const { data: workers } = await supabase
        .from('workers')
        .select('id, name, email, address')
        .in('id', workerIds);

      // Fetch jobs
      const { data: jobs } = jobIds.length > 0
        ? await supabase.from('jobs').select('id, name').in('id', jobIds)
        : { data: [] };

      const workerMap = new Map<string, { name: string; email: string; address: string | null }>();
      workers?.forEach((w) => workerMap.set(w.id, w));

      const jobMap = new Map<string, { id: string; name: string }>();
      jobs?.forEach((j) => jobMap.set(j.id, j));

      const enrichedItems = items.map((item) => {
        const worker = item.worker_id ? workerMap.get(item.worker_id) : null;
        const job = item.project_id ? jobMap.get(item.project_id) : null;
        return {
          ...item,
          worker_name: worker?.name || item.worker_name || 'Unknown',
          worker_email: worker?.email || item.worker_email || '',
          worker_address: worker?.address || item.worker_address || '',
          project_name: item.project_name || job?.name || null,
        } as ReportLineItem;
      });

      return createSuccessResult(enrichedItems);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while enriching line items',
        undefined,
        error
      );
    }
  }
}

// Export singleton instance
export const reportService = new ReportService();
