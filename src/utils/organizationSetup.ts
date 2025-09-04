/**
 * Organization Setup Utilities
 * Helper functions and SQL templates for setting up new organizations
 */

import { supabase } from '@/integrations/supabase/client';

export interface OrganizationSetupData {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  adminEmail: string;
  adminName: string;
  maxWorkers?: number;
  maxManagers?: number;
}

/**
 * Creates a new organization and returns the organization ID
 * Note: The admin user must be created in Supabase Auth first
 */
export const createOrganization = async (data: OrganizationSetupData): Promise<string> => {
  try {
    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        subscription_status: 'active',
        max_workers: data.maxWorkers || 10,
        max_managers: data.maxManagers || 2,
      })
      .select()
      .single();

    if (orgError) throw orgError;

    return org.id;
  } catch (error) {
    console.error('Error creating organization:', error);
    throw error;
  }
};

/**
 * Links a manager to an organization
 * Call this after creating the auth user
 */
export const linkManagerToOrganization = async (
  adminEmail: string, 
  adminName: string, 
  organizationId: string,
  isSuper: boolean = false
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('managers')
      .insert({
        email: adminEmail,
        name: adminName,
        organization_id: organizationId,
        is_super: isSuper,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error linking manager to organization:', error);
    throw error;
  }
};

/**
 * SQL Template for manual organization setup
 * Use this when manually setting up organizations via SQL
 */
export const getOrganizationSetupSQL = (data: OrganizationSetupData): string => {
  return `
-- Step 1: Create Organization
INSERT INTO public.organizations (
  name, 
  email, 
  phone, 
  address, 
  subscription_status,
  max_workers,
  max_managers
) VALUES (
  '${data.name}',
  '${data.email}',
  ${data.phone ? `'${data.phone}'` : 'NULL'},
  ${data.address ? `'${data.address}'` : 'NULL'},
  'active',
  ${data.maxWorkers || 10},
  ${data.maxManagers || 2}
) RETURNING id;

-- Step 2: Create Manager (run after creating auth user)
-- Replace ORGANIZATION_ID_FROM_ABOVE with the ID returned from step 1
INSERT INTO public.managers (
  email,
  name,
  organization_id,
  is_super
) VALUES (
  '${data.adminEmail}',
  '${data.adminName}',
  'ORGANIZATION_ID_FROM_ABOVE',
  false
);
  `.trim();
};

/**
 * Validates organization setup data
 */
export const validateOrganizationData = (data: Partial<OrganizationSetupData>): string[] => {
  const errors: string[] = [];

  if (!data.name?.trim()) {
    errors.push('Organization name is required');
  }

  if (!data.email?.trim()) {
    errors.push('Organization email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }

  if (!data.adminEmail?.trim()) {
    errors.push('Admin email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail)) {
    errors.push('Invalid admin email format');
  }

  if (!data.adminName?.trim()) {
    errors.push('Admin name is required');
  }

  if (data.maxWorkers !== undefined && data.maxWorkers < 1) {
    errors.push('Max workers must be at least 1');
  }

  if (data.maxManagers !== undefined && data.maxManagers < 1) {
    errors.push('Max managers must be at least 1');
  }

  return errors;
};