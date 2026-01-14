/**
 * Organization Service
 * Handles all organization-related data operations
 * Following SOLID principles - Single Responsibility & Dependency Inversion
 */

import { supabase } from '@/integrations/supabase/client';
import {
  Organization,
  OrganizationInsert,
  OrganizationUpdate,
  Manager,
  CapacityCheckResult,
  ServiceResult,
  createSuccessResult,
  createErrorResult,
  handleSupabaseError,
} from '../types';

export interface CreateOrganizationInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyNumber?: string | null;
  vatNumber?: string | null;
}

export interface UpdateOrganizationInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyNumber?: string | null;
  vatNumber?: string | null;
  logoUrl?: string | null;
}

export interface OrganizationWithManagers extends Organization {
  managers?: Manager[];
}

/**
 * Organization Service class
 * Encapsulates all organization-related database operations
 */
export class OrganizationService {
  /**
   * Get all organizations
   */
  async getOrganizations(): Promise<ServiceResult<Organization[]>> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        return handleSupabaseError(error, 'getOrganizations');
      }

      return createSuccessResult(data || []);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching organizations',
        undefined,
        error
      );
    }
  }

  /**
   * Get organizations with their managers
   */
  async getOrganizationsWithManagers(): Promise<ServiceResult<OrganizationWithManagers[]>> {
    try {
      const { data: organizations, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .order('name', { ascending: true });

      if (orgError) {
        return handleSupabaseError(orgError, 'getOrganizationsWithManagers');
      }

      const { data: managers, error: managerError } = await supabase
        .from('managers')
        .select('*')
        .order('name', { ascending: true });

      if (managerError) {
        return handleSupabaseError(managerError, 'getOrganizationsWithManagers');
      }

      // Group managers by organization
      const managersByOrg = (managers || []).reduce(
        (acc, manager) => {
          const orgId = manager.organization_id;
          if (orgId) {
            if (!acc[orgId]) {
              acc[orgId] = [];
            }
            acc[orgId].push(manager);
          }
          return acc;
        },
        {} as Record<string, Manager[]>
      );

      // Combine organizations with their managers
      const result = (organizations || []).map((org) => ({
        ...org,
        managers: managersByOrg[org.id] || [],
      }));

      return createSuccessResult(result);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching organizations',
        undefined,
        error
      );
    }
  }

  /**
   * Get a single organization by ID
   */
  async getOrganizationById(
    organizationId: string
  ): Promise<ServiceResult<Organization>> {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (error) {
        return handleSupabaseError(error, 'getOrganizationById');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching organization',
        undefined,
        error
      );
    }
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    input: CreateOrganizationInput
  ): Promise<ServiceResult<Organization>> {
    try {
      const orgData: OrganizationInsert = {
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        company_number: input.companyNumber || null,
        vat_number: input.vatNumber || null,
      };

      const { data, error } = await supabase
        .from('organizations')
        .insert(orgData)
        .select()
        .single();

      if (error) {
        return handleSupabaseError(error, 'createOrganization');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while creating organization',
        undefined,
        error
      );
    }
  }

  /**
   * Update an existing organization
   */
  async updateOrganization(
    organizationId: string,
    input: UpdateOrganizationInput
  ): Promise<ServiceResult<Organization>> {
    try {
      const updateData: OrganizationUpdate = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.companyNumber !== undefined) updateData.company_number = input.companyNumber;
      if (input.vatNumber !== undefined) updateData.vat_number = input.vatNumber;
      if (input.logoUrl !== undefined) updateData.logo_url = input.logoUrl;

      const { data, error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', organizationId)
        .select()
        .single();

      if (error) {
        return handleSupabaseError(error, 'updateOrganization');
      }

      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while updating organization',
        undefined,
        error
      );
    }
  }

  /**
   * Delete an organization (using edge function for complete cleanup)
   */
  async deleteOrganization(organizationId: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.functions.invoke('delete-organization', {
        body: { organization_id: organizationId },
      });

      if (error) {
        return createErrorResult(
          'DELETE_ERROR',
          `Failed to delete organization: ${error.message}`,
          undefined,
          error
        );
      }

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while deleting organization',
        undefined,
        error
      );
    }
  }

  /**
   * Check capacity for an organization
   */
  async checkCapacity(
    organizationId: string
  ): Promise<ServiceResult<CapacityCheckResult>> {
    try {
      const { data, error } = await supabase.rpc('check_capacity_with_plan', {
        org_id: organizationId,
      });

      if (error) {
        return handleSupabaseError(error, 'checkCapacity');
      }

      const result = data?.[0];
      if (!result) {
        return createErrorResult(
          'NO_DATA',
          'No capacity data returned for organization'
        );
      }

      return createSuccessResult({
        canAddManager: result.can_add_manager,
        canAddWorker: result.can_add_worker,
        currentManagerCount: result.current_manager_count,
        currentWorkerCount: result.current_worker_count,
        maxManagers: result.max_managers,
        maxWorkers: result.max_workers,
        planName: result.plan_name,
        plannedManagers: result.planned_managers,
        plannedWorkers: result.planned_workers,
      });
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while checking capacity',
        undefined,
        error
      );
    }
  }

  /**
   * Upload organization logo
   */
  async uploadLogo(
    organizationId: string,
    file: File
  ): Promise<ServiceResult<string>> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${organizationId}/logo-${Date.now()}.${fileExt}`;
      const bucketName = 'organization-logos';

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        return createErrorResult(
          'UPLOAD_ERROR',
          `Failed to upload logo: ${uploadError.message}`,
          undefined,
          uploadError
        );
      }

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      // Update organization with new logo URL
      const updateResult = await this.updateOrganization(organizationId, {
        logoUrl: urlData.publicUrl,
      });

      if (!updateResult.success) {
        return createErrorResult(
          updateResult.error!.code,
          updateResult.error!.message
        );
      }

      return createSuccessResult(urlData.publicUrl);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while uploading logo',
        undefined,
        error
      );
    }
  }

  /**
   * Get managers for an organization
   */
  async getManagers(organizationId: string): Promise<ServiceResult<Manager[]>> {
    try {
      const { data, error } = await supabase
        .from('managers')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) {
        return handleSupabaseError(error, 'getManagers');
      }

      return createSuccessResult(data || []);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while fetching managers',
        undefined,
        error
      );
    }
  }

  /**
   * Reconcile subscription usage
   */
  async reconcileSubscription(
    organizationId: string,
    reason: string = 'manual'
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.functions.invoke('reconcile-subscription', {
        body: { organization_id: organizationId, reason },
      });

      if (error) {
        return createErrorResult(
          'RECONCILE_ERROR',
          `Failed to reconcile subscription: ${error.message}`,
          undefined,
          error
        );
      }

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while reconciling subscription',
        undefined,
        error
      );
    }
  }
}

// Export singleton instance
export const organizationService = new OrganizationService();
