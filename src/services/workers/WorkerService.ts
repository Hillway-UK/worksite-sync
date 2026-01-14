/**
 * Worker Service
 * Handles all worker-related data operations
 * Following SOLID principles - Single Responsibility & Dependency Inversion
 */

import { supabase } from '@/integrations/supabase/client';
import {
  Worker,
  WorkerInsert,
  WorkerUpdate,
  WorkerFilterOptions,
  ServiceResult,
  CapacityCheckResult,
  createSuccessResult,
  createErrorResult,
  handleSupabaseError,
} from '../types';

export interface CreateWorkerInput {
  name: string;
  email: string;
  phone?: string | null;
  hourlyRate: number;
  address?: string | null;
  emergencyContact?: string | null;
  dateStarted?: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  shiftDays?: number[] | null;
  password: string;
  organizationId: string;
}

export interface UpdateWorkerInput {
  name?: string;
  email?: string;
  phone?: string | null;
  hourlyRate?: number;
  address?: string | null;
  emergencyContact?: string | null;
  dateStarted?: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  shiftDays?: number[] | null;
  isActive?: boolean;
}

export interface WorkerCredentials {
  name: string;
  email: string;
  password: string;
}

export interface CreateWorkerResult {
  worker: Worker;
  credentials: WorkerCredentials;
}

/**
 * Worker Service class
 * Encapsulates all worker-related database operations
 */
export class WorkerService {
  /**
   * Get all workers for an organization
   */
  async getWorkers(
    organizationId: string,
    options?: WorkerFilterOptions
  ): Promise<ServiceResult<Worker[]>> {
    try {
      let query = supabase
        .from('workers')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (options?.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      }

      if (options?.search) {
        query = query.or(`name.ilike.%${options.search}%,email.ilike.%${options.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        return handleSupabaseError(error, 'getWorkers');
      }

      return createSuccessResult(data || []);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching workers',
        undefined,
        error
      );
    }
  }

  /**
   * Get a single worker by ID
   */
  async getWorkerById(workerId: string): Promise<ServiceResult<Worker>> {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('id', workerId)
        .single();

      if (error) {
        return handleSupabaseError(error, 'getWorkerById');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching worker',
        undefined,
        error
      );
    }
  }

  /**
   * Get worker by email within an organization
   */
  async getWorkerByEmail(
    email: string,
    organizationId: string
  ): Promise<ServiceResult<Worker | null>> {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) {
        return handleSupabaseError(error, 'getWorkerByEmail');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while checking worker email',
        undefined,
        error
      );
    }
  }

  /**
   * Check if email is already in use
   */
  async isEmailInUse(
    email: string,
    organizationId: string,
    excludeWorkerId?: string
  ): Promise<ServiceResult<boolean>> {
    try {
      let query = supabase
        .from('workers')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('organization_id', organizationId);

      if (excludeWorkerId) {
        query = query.neq('id', excludeWorkerId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        return handleSupabaseError(error, 'isEmailInUse');
      }

      return createSuccessResult(data !== null);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while checking email',
        undefined,
        error
      );
    }
  }

  /**
   * Create a new worker with auth account
   */
  async createWorker(
    input: CreateWorkerInput
  ): Promise<ServiceResult<CreateWorkerResult>> {
    try {
      // Check for duplicate email first
      const duplicateCheck = await this.isEmailInUse(input.email, input.organizationId);
      if (!duplicateCheck.success) {
        return createErrorResult(
          duplicateCheck.error!.code,
          duplicateCheck.error!.message
        );
      }

      if (duplicateCheck.data) {
        return createErrorResult(
          'DUPLICATE_EMAIL',
          'A worker with this email already exists in your organization'
        );
      }

      // Create auth user for worker
      const { error: authError } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: 'https://autotimeworkers.hillwayco.uk/login',
          data: {
            name: input.name,
            role: 'worker',
          },
        },
      });

      // Allow if user already exists (they can reset password)
      if (authError && !authError.message.includes('already registered')) {
        return createErrorResult(
          'AUTH_ERROR',
          `Failed to create login account: ${authError.message}`,
          undefined,
          authError
        );
      }

      // Create worker database record
      const workerData: WorkerInsert = {
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone || null,
        hourly_rate: input.hourlyRate,
        address: input.address || null,
        emergency_contact: input.emergencyContact || null,
        date_started: input.dateStarted || null,
        organization_id: input.organizationId,
        is_active: true,
        shift_start: input.shiftStart || null,
        shift_end: input.shiftEnd || null,
        shift_days: input.shiftDays || null,
      };

      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .insert(workerData)
        .select()
        .single();

      if (workerError) {
        // Check if this is a capacity limit error
        if (workerError.message.includes('Worker limit reached')) {
          const match = workerError.message.match(/active (\d+) \/ planned (\d+)/);
          if (match) {
            return createErrorResult(
              'CAPACITY_LIMIT',
              'Worker limit reached for your subscription plan',
              {
                currentCount: parseInt(match[1]),
                plannedCount: parseInt(match[2]),
              }
            );
          }
        }

        return handleSupabaseError(workerError, 'createWorker');
      }

      return createSuccessResult({
        worker,
        credentials: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
      });
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while creating worker',
        undefined,
        error
      );
    }
  }

  /**
   * Update an existing worker
   */
  async updateWorker(
    workerId: string,
    input: UpdateWorkerInput
  ): Promise<ServiceResult<Worker>> {
    try {
      const updateData: WorkerUpdate = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email.toLowerCase();
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.hourlyRate !== undefined) updateData.hourly_rate = input.hourlyRate;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.emergencyContact !== undefined) updateData.emergency_contact = input.emergencyContact;
      if (input.dateStarted !== undefined) updateData.date_started = input.dateStarted;
      if (input.shiftStart !== undefined) updateData.shift_start = input.shiftStart;
      if (input.shiftEnd !== undefined) updateData.shift_end = input.shiftEnd;
      if (input.shiftDays !== undefined) updateData.shift_days = input.shiftDays;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;

      const { data, error } = await supabase
        .from('workers')
        .update(updateData)
        .eq('id', workerId)
        .select()
        .single();

      if (error) {
        return handleSupabaseError(error, 'updateWorker');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while updating worker',
        undefined,
        error
      );
    }
  }

  /**
   * Deactivate a worker (soft delete)
   */
  async deactivateWorker(workerId: string): Promise<ServiceResult<Worker>> {
    return this.updateWorker(workerId, { isActive: false });
  }

  /**
   * Activate a worker
   */
  async activateWorker(workerId: string): Promise<ServiceResult<Worker>> {
    return this.updateWorker(workerId, { isActive: true });
  }

  /**
   * Get worker count for an organization
   */
  async getWorkerCount(
    organizationId: string,
    activeOnly: boolean = true
  ): Promise<ServiceResult<number>> {
    try {
      let query = supabase
        .from('workers')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { count, error } = await query;

      if (error) {
        return handleSupabaseError(error, 'getWorkerCount');
      }

      return createSuccessResult(count || 0);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while counting workers',
        undefined,
        error
      );
    }
  }

  /**
   * Send invitation email to worker
   */
  async sendInvitationEmail(
    workerEmail: string,
    workerName: string,
    password: string,
    organizationName: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          type: 'worker',
          recipientEmail: workerEmail,
          recipientName: workerName,
          password: password,
          organizationName: organizationName,
          loginUrl: 'https://autotimeworkers.hillwayco.uk/login',
        },
      });

      if (error) {
        return createErrorResult(
          'EMAIL_ERROR',
          'Failed to send invitation email',
          undefined,
          error
        );
      }

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while sending email',
        undefined,
        error
      );
    }
  }
}

// Export singleton instance
export const workerService = new WorkerService();
