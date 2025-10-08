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
  plannedWorkers?: number;
  plannedManagers?: number;
}

/**
 * Creates a new organization and returns the organization ID
 * Note: The admin user must be created in Supabase Auth first
 */
export const createOrganization = async (data: OrganizationSetupData): Promise<string> => {
  try {
    // Create organization (capacity managed via subscription_usage)
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        subscription_status: 'active'
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // Create initial subscription_usage record
    const { error: subError } = await supabase
      .from('subscription_usage')
      .insert({
        organization_id: org.id,
        month: new Date().toISOString().split('T')[0],
        planned_number_of_managers: data.plannedManagers || 2,
        planned_number_of_workers: data.plannedWorkers || 10,
        active_managers: 0,
        active_workers: 0,
        status: 'active',
        effective_start_date: new Date().toISOString().split('T')[0],
        plan_type: 'starter'
      });

    if (subError) console.error('Error creating subscription:', subError);

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
  subscription_status
) VALUES (
  '${data.name}',
  '${data.email}',
  ${data.phone ? `'${data.phone}'` : 'NULL'},
  ${data.address ? `'${data.address}'` : 'NULL'},
  'active'
) RETURNING id;

-- Step 2: Create subscription_usage record
INSERT INTO public.subscription_usage (
  organization_id,
  month,
  planned_number_of_managers,
  planned_number_of_workers,
  active_managers,
  active_workers,
  status,
  effective_start_date,
  plan_type
) VALUES (
  'ORGANIZATION_ID_FROM_ABOVE',
  CURRENT_DATE,
  ${data.plannedManagers || 2},
  ${data.plannedWorkers || 10},
  0,
  0,
  'active',
  CURRENT_DATE,
  'starter'
);

-- Step 3: Create Manager (run after creating auth user)
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

  if (data.plannedWorkers !== undefined && data.plannedWorkers < 0) {
    errors.push('Planned workers must be at least 0');
  }

  if (data.plannedManagers !== undefined && data.plannedManagers < 1) {
    errors.push('Planned managers must be at least 1');
  }

  return errors;
};