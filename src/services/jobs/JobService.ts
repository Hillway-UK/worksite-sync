/**
 * Job Service
 * Handles all job-related data operations
 * Following SOLID principles - Single Responsibility & Dependency Inversion
 */

import { supabase } from '@/integrations/supabase/client';
import {
  Job,
  JobInsert,
  JobUpdate,
  JobFilterOptions,
  ServiceResult,
  createSuccessResult,
  createErrorResult,
  handleSupabaseError,
} from '../types';

export interface CreateJobInput {
  name: string;
  code: string;
  address: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  latitude: number;
  longitude: number;
  organizationId: string;
  geofenceEnabled?: boolean;
  geofenceRadius?: number;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  shiftDays?: number[] | null;
  termsAndConditionsUrl?: string | null;
  waiverUrl?: string | null;
  showRamsAndSiteInfo?: boolean;
}

export interface UpdateJobInput {
  name?: string;
  code?: string;
  address?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
  geofenceEnabled?: boolean;
  geofenceRadius?: number;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  shiftDays?: number[] | null;
  termsAndConditionsUrl?: string | null;
  waiverUrl?: string | null;
  showRamsAndSiteInfo?: boolean;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
}

/**
 * Job Service class
 * Encapsulates all job-related database operations
 */
export class JobService {
  /**
   * Get all jobs for an organization
   */
  async getJobs(
    organizationId: string,
    options?: JobFilterOptions
  ): Promise<ServiceResult<Job[]>> {
    try {
      let query = supabase
        .from('jobs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (options?.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      }

      if (options?.search) {
        query = query.or(
          `name.ilike.%${options.search}%,code.ilike.%${options.search}%,address.ilike.%${options.search}%`
        );
      }

      if (options?.hasGeofence !== undefined) {
        query = query.eq('geofence_enabled', options.hasGeofence);
      }

      const { data, error } = await query;

      if (error) {
        return handleSupabaseError(error, 'getJobs');
      }

      return createSuccessResult(data || []);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching jobs',
        undefined,
        error
      );
    }
  }

  /**
   * Get active jobs only
   */
  async getActiveJobs(organizationId: string): Promise<ServiceResult<Job[]>> {
    return this.getJobs(organizationId, { isActive: true });
  }

  /**
   * Get a single job by ID
   */
  async getJobById(jobId: string): Promise<ServiceResult<Job>> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        return handleSupabaseError(error, 'getJobById');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching job',
        undefined,
        error
      );
    }
  }

  /**
   * Get job by code within an organization
   */
  async getJobByCode(
    code: string,
    organizationId: string
  ): Promise<ServiceResult<Job | null>> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) {
        return handleSupabaseError(error, 'getJobByCode');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while checking job code',
        undefined,
        error
      );
    }
  }

  /**
   * Check if job code is already in use
   */
  async isCodeInUse(
    code: string,
    organizationId: string,
    excludeJobId?: string
  ): Promise<ServiceResult<boolean>> {
    try {
      let query = supabase
        .from('jobs')
        .select('id')
        .eq('code', code.toUpperCase())
        .eq('organization_id', organizationId);

      if (excludeJobId) {
        query = query.neq('id', excludeJobId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        return handleSupabaseError(error, 'isCodeInUse');
      }

      return createSuccessResult(data !== null);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while checking code',
        undefined,
        error
      );
    }
  }

  /**
   * Create a new job
   */
  async createJob(input: CreateJobInput): Promise<ServiceResult<Job>> {
    try {
      // Check for duplicate code first
      const codeCheck = await this.isCodeInUse(input.code, input.organizationId);
      if (!codeCheck.success) {
        return createErrorResult(codeCheck.error!.code, codeCheck.error!.message);
      }

      if (codeCheck.data) {
        return createErrorResult(
          'DUPLICATE_CODE',
          'A job with this code already exists in your organization'
        );
      }

      const jobData: JobInsert = {
        name: input.name,
        code: input.code.toUpperCase(),
        address: input.address,
        address_line_1: input.addressLine1 || null,
        address_line_2: input.addressLine2 || null,
        city: input.city || null,
        county: input.county || null,
        postcode: input.postcode || null,
        latitude: input.latitude,
        longitude: input.longitude,
        organization_id: input.organizationId,
        is_active: true,
        geofence_enabled: input.geofenceEnabled ?? false,
        geofence_radius: input.geofenceRadius || 100,
        shift_start: input.shiftStart || null,
        shift_end: input.shiftEnd || null,
        shift_days: input.shiftDays || null,
        terms_and_conditions_url: input.termsAndConditionsUrl || null,
        waiver_url: input.waiverUrl || null,
        show_rams_and_site_info: input.showRamsAndSiteInfo ?? false,
      };

      const { data, error } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single();

      if (error) {
        return handleSupabaseError(error, 'createJob');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while creating job',
        undefined,
        error
      );
    }
  }

  /**
   * Update an existing job
   */
  async updateJob(
    jobId: string,
    input: UpdateJobInput
  ): Promise<ServiceResult<Job>> {
    try {
      const updateData: JobUpdate = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.code !== undefined) updateData.code = input.code.toUpperCase();
      if (input.address !== undefined) updateData.address = input.address;
      if (input.addressLine1 !== undefined) updateData.address_line_1 = input.addressLine1;
      if (input.addressLine2 !== undefined) updateData.address_line_2 = input.addressLine2;
      if (input.city !== undefined) updateData.city = input.city;
      if (input.county !== undefined) updateData.county = input.county;
      if (input.postcode !== undefined) updateData.postcode = input.postcode;
      if (input.latitude !== undefined) updateData.latitude = input.latitude;
      if (input.longitude !== undefined) updateData.longitude = input.longitude;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      if (input.geofenceEnabled !== undefined) updateData.geofence_enabled = input.geofenceEnabled;
      if (input.geofenceRadius !== undefined) updateData.geofence_radius = input.geofenceRadius;
      if (input.shiftStart !== undefined) updateData.shift_start = input.shiftStart;
      if (input.shiftEnd !== undefined) updateData.shift_end = input.shiftEnd;
      if (input.shiftDays !== undefined) updateData.shift_days = input.shiftDays;
      if (input.termsAndConditionsUrl !== undefined)
        updateData.terms_and_conditions_url = input.termsAndConditionsUrl;
      if (input.waiverUrl !== undefined) updateData.waiver_url = input.waiverUrl;
      if (input.showRamsAndSiteInfo !== undefined)
        updateData.show_rams_and_site_info = input.showRamsAndSiteInfo;

      const { data, error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        return handleSupabaseError(error, 'updateJob');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while updating job',
        undefined,
        error
      );
    }
  }

  /**
   * Deactivate a job (soft delete)
   */
  async deactivateJob(jobId: string): Promise<ServiceResult<Job>> {
    return this.updateJob(jobId, { isActive: false });
  }

  /**
   * Activate a job
   */
  async activateJob(jobId: string): Promise<ServiceResult<Job>> {
    return this.updateJob(jobId, { isActive: true });
  }

  /**
   * Get job count for an organization
   */
  async getJobCount(
    organizationId: string,
    activeOnly: boolean = true
  ): Promise<ServiceResult<number>> {
    try {
      let query = supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { count, error } = await query;

      if (error) {
        return handleSupabaseError(error, 'getJobCount');
      }

      return createSuccessResult(count || 0);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while counting jobs',
        undefined,
        error
      );
    }
  }

  /**
   * Geocode a postcode using the postcodes table
   */
  async geocodePostcode(postcode: string): Promise<ServiceResult<GeocodeResult | null>> {
    try {
      // Normalize postcode (remove spaces, uppercase)
      const normalizedPostcode = postcode.replace(/\s+/g, '').toUpperCase();

      const { data, error } = await supabase
        .from('postcodes')
        .select('latitude, longitude, town, county')
        .eq('postcode', normalizedPostcode)
        .maybeSingle();

      if (error) {
        return handleSupabaseError(error, 'geocodePostcode');
      }

      if (!data) {
        return createSuccessResult(null);
      }

      return createSuccessResult({
        latitude: data.latitude,
        longitude: data.longitude,
        formattedAddress: [data.town, data.county].filter(Boolean).join(', '),
      });
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while geocoding postcode',
        undefined,
        error
      );
    }
  }

  /**
   * Upload a file for job (terms/waiver)
   */
  async uploadJobFile(
    file: File,
    jobId: string,
    fileType: 'terms' | 'waiver'
  ): Promise<ServiceResult<string>> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${jobId}/${fileType}-${Date.now()}.${fileExt}`;
      const bucketName = 'job-documents';

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        return createErrorResult(
          'UPLOAD_ERROR',
          `Failed to upload file: ${uploadError.message}`,
          undefined,
          uploadError
        );
      }

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      return createSuccessResult(urlData.publicUrl);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while uploading file',
        undefined,
        error
      );
    }
  }
}

// Export singleton instance
export const jobService = new JobService();
