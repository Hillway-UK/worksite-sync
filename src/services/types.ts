/**
 * Service Layer Types
 * Base types and error handling for all services
 * Following SOLID principles - Dependency Inversion
 */

import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

// Re-export table types for convenience
export type Worker = Tables<'workers'>;
export type WorkerInsert = TablesInsert<'workers'>;
export type WorkerUpdate = TablesUpdate<'workers'>;

export type Job = Tables<'jobs'>;
export type JobInsert = TablesInsert<'jobs'>;
export type JobUpdate = TablesUpdate<'jobs'>;

export type Organization = Tables<'organizations'>;
export type OrganizationInsert = TablesInsert<'organizations'>;
export type OrganizationUpdate = TablesUpdate<'organizations'>;

export type Manager = Tables<'managers'>;
export type ManagerInsert = TablesInsert<'managers'>;
export type ManagerUpdate = TablesUpdate<'managers'>;

export type ClockEntry = Tables<'clock_entries'>;
export type ClockEntryInsert = TablesInsert<'clock_entries'>;
export type ClockEntryUpdate = TablesUpdate<'clock_entries'>;

export type ExpenseType = Tables<'expense_types'>;
export type ExpenseTypeInsert = TablesInsert<'expense_types'>;
export type ExpenseTypeUpdate = TablesUpdate<'expense_types'>;

export type AdditionalCost = Tables<'additional_costs'>;
export type AdditionalCostInsert = TablesInsert<'additional_costs'>;
export type AdditionalCostUpdate = TablesUpdate<'additional_costs'>;

export type AmendmentRequest = Tables<'amendment_requests'>;
export type AmendmentRequestInsert = TablesInsert<'amendment_requests'>;
export type AmendmentRequestUpdate = TablesUpdate<'amendment_requests'>;

export type TimeAmendment = Tables<'time_amendments'>;
export type TimeAmendmentInsert = TablesInsert<'time_amendments'>;
export type TimeAmendmentUpdate = TablesUpdate<'time_amendments'>;

export type Notification = Tables<'notifications'>;
export type NotificationInsert = TablesInsert<'notifications'>;
export type NotificationUpdate = TablesUpdate<'notifications'>;

export type SubscriptionUsage = Tables<'subscription_usage'>;
export type SubscriptionUsageInsert = TablesInsert<'subscription_usage'>;
export type SubscriptionUsageUpdate = TablesUpdate<'subscription_usage'>;

export type ClockEntryHistory = Tables<'clock_entry_history'>;
export type ClockEntryHistoryInsert = TablesInsert<'clock_entry_history'>;

/**
 * Service Result Type
 * Standardized result type for all service operations
 */
export interface ServiceResult<T> {
  data: T | null;
  error: ServiceError | null;
  success: boolean;
}

/**
 * Service Error Type
 * Standardized error type for all services
 */
export interface ServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  originalError?: unknown;
}

/**
 * Pagination Options
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  offset?: number;
  limit?: number;
}

/**
 * Sort Options
 */
export interface SortOptions<T> {
  field: keyof T;
  direction: 'asc' | 'desc';
}

/**
 * Filter Options Base
 */
export interface FilterOptions {
  organizationId?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}

/**
 * Worker Filter Options
 */
export interface WorkerFilterOptions extends FilterOptions {
  search?: string;
}

/**
 * Job Filter Options
 */
export interface JobFilterOptions extends FilterOptions {
  search?: string;
  hasGeofence?: boolean;
}

/**
 * Clock Entry Filter Options
 */
export interface ClockEntryFilterOptions extends FilterOptions {
  workerId?: string;
  jobId?: string;
  isOvertime?: boolean;
  otStatus?: string;
  needsApproval?: boolean;
}

/**
 * Report Line Item (for reports)
 */
export interface ReportLineItem {
  id: string;
  worker_id: string;
  worker_name: string;
  job_id: string;
  job_name: string;
  job_code: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: number;
  hourly_rate: number;
  labor_cost: number;
  additional_costs: number;
  total_cost: number;
  notes: string | null;
  source_type: 'clock_entry' | 'additional_cost';
  source_id: string;
  is_overtime: boolean;
  clock_entry_id?: string;
}

/**
 * Overtime Request (combined view)
 */
export interface OvertimeRequest {
  id: string;
  type: 'clock_entry' | 'amendment_request';
  workerId: string;
  workerName: string;
  jobId?: string;
  jobName?: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number;
  status: string;
  reason?: string;
  requestedAt: string;
  sourceData: ClockEntry | AmendmentRequest;
}

/**
 * Capacity Check Result
 */
export interface CapacityCheckResult {
  canAddManager: boolean;
  canAddWorker: boolean;
  currentManagerCount: number;
  currentWorkerCount: number;
  maxManagers: number;
  maxWorkers: number;
  planName: string;
  plannedManagers: number;
  plannedWorkers: number;
}

/**
 * User Role Type
 */
export type UserRole = 'super_admin' | 'manager' | 'worker' | null;

/**
 * Auth User Info
 */
export interface AuthUserInfo {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
}

/**
 * Helper function to create a success result
 */
export function createSuccessResult<T>(data: T): ServiceResult<T> {
  return {
    data,
    error: null,
    success: true,
  };
}

/**
 * Helper function to create an error result
 */
export function createErrorResult<T>(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  originalError?: unknown
): ServiceResult<T> {
  return {
    data: null,
    error: {
      code,
      message,
      details,
      originalError,
    },
    success: false,
  };
}

/**
 * Helper to handle Supabase errors
 */
export function handleSupabaseError<T>(
  error: { message: string; code?: string; details?: string } | null,
  context: string
): ServiceResult<T> {
  if (!error) {
    return createErrorResult('UNKNOWN_ERROR', 'An unknown error occurred', { context });
  }

  return createErrorResult(
    error.code || 'SUPABASE_ERROR',
    error.message,
    { context, details: error.details },
    error
  );
}
