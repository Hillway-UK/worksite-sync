/**
 * Auth Service
 * Handles all authentication-related operations
 * Following SOLID principles - Single Responsibility & Dependency Inversion
 */

import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import {
  UserRole,
  AuthUserInfo,
  ServiceResult,
  createSuccessResult,
  createErrorResult,
  handleSupabaseError,
} from '../types';

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  role?: 'manager' | 'worker';
  redirectTo?: string;
}

export interface RoleAndOrg {
  role: UserRole;
  organizationId: string | null;
}

/**
 * Auth Service class
 * Encapsulates all authentication-related operations
 */
export class AuthService {
  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<ServiceResult<User | null>> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        // User not authenticated is not an error
        if (error.message.includes('not authenticated')) {
          return createSuccessResult(null);
        }
        return handleSupabaseError(error, 'getCurrentUser');
      }

      return createSuccessResult(user);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while getting current user',
        undefined,
        error
      );
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<ServiceResult<Session | null>> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        return handleSupabaseError(error, 'getSession');
      }

      return createSuccessResult(session);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while getting session',
        undefined,
        error
      );
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(credentials: SignInCredentials): Promise<ServiceResult<{ user: User; session: Session }>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return createErrorResult(
          'AUTH_ERROR',
          error.message,
          undefined,
          error
        );
      }

      if (!data.user || !data.session) {
        return createErrorResult('AUTH_ERROR', 'Sign in failed - no user or session returned');
      }

      return createSuccessResult({
        user: data.user,
        session: data.session,
      });
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred during sign in',
        undefined,
        error
      );
    }
  }

  /**
   * Sign up a new user
   */
  async signUp(input: SignUpInput): Promise<ServiceResult<{ user: User | null; session: Session | null }>> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: input.redirectTo,
          data: {
            name: input.name,
            role: input.role || 'worker',
          },
        },
      });

      if (error) {
        return createErrorResult(
          'AUTH_ERROR',
          error.message,
          undefined,
          error
        );
      }

      return createSuccessResult({
        user: data.user,
        session: data.session,
      });
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred during sign up',
        undefined,
        error
      );
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return createErrorResult(
          'AUTH_ERROR',
          error.message,
          undefined,
          error
        );
      }

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred during sign out',
        undefined,
        error
      );
    }
  }

  /**
   * Update user password
   */
  async updatePassword(newPassword: string): Promise<ServiceResult<User>> {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return createErrorResult(
          'AUTH_ERROR',
          error.message,
          undefined,
          error
        );
      }

      return createSuccessResult(data.user);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while updating password',
        undefined,
        error
      );
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string, redirectTo?: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || `${window.location.origin}/update-password`,
      });

      if (error) {
        return createErrorResult(
          'AUTH_ERROR',
          error.message,
          undefined,
          error
        );
      }

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while sending reset email',
        undefined,
        error
      );
    }
  }

  /**
   * Get user role and organization
   */
  async getUserRoleAndOrg(email: string): Promise<ServiceResult<RoleAndOrg>> {
    try {
      // Try the RPC function first (most efficient)
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_role_and_org', {
        user_email: email,
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const result = rpcData[0];
        return createSuccessResult({
          role: result.role as UserRole,
          organizationId: result.organization_id,
        });
      }

      // Fallback: Check tables directly
      // Check super_admins
      const { data: superAdmin } = await supabase
        .from('super_admins')
        .select('organization_id')
        .eq('email', email)
        .maybeSingle();

      if (superAdmin) {
        return createSuccessResult({
          role: 'super_admin',
          organizationId: superAdmin.organization_id,
        });
      }

      // Check managers
      const { data: manager } = await supabase
        .from('managers')
        .select('organization_id')
        .eq('email', email)
        .maybeSingle();

      if (manager) {
        return createSuccessResult({
          role: 'manager',
          organizationId: manager.organization_id,
        });
      }

      // Check workers
      const { data: worker } = await supabase
        .from('workers')
        .select('organization_id')
        .eq('email', email)
        .maybeSingle();

      if (worker) {
        return createSuccessResult({
          role: 'worker',
          organizationId: worker.organization_id,
        });
      }

      // No role found
      return createSuccessResult({
        role: null,
        organizationId: null,
      });
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while getting user role',
        undefined,
        error
      );
    }
  }

  /**
   * Get manager by email
   */
  async getManagerByEmail(email: string): Promise<ServiceResult<{ id: string; organizationId: string | null } | null>> {
    try {
      const { data, error } = await supabase
        .from('managers')
        .select('id, organization_id')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        return handleSupabaseError(error, 'getManagerByEmail');
      }

      if (!data) {
        return createSuccessResult(null);
      }

      return createSuccessResult({
        id: data.id,
        organizationId: data.organization_id,
      });
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while getting manager',
        undefined,
        error
      );
    }
  }

  /**
   * Check if user must change password
   */
  async mustChangePassword(email: string, role: UserRole): Promise<ServiceResult<boolean>> {
    try {
      if (role === 'manager') {
        const { data, error } = await supabase
          .from('managers')
          .select('must_change_password')
          .eq('email', email)
          .maybeSingle();

        if (error) {
          return handleSupabaseError(error, 'mustChangePassword');
        }

        return createSuccessResult(data?.must_change_password ?? false);
      }

      if (role === 'worker') {
        const { data, error } = await supabase
          .from('workers')
          .select('must_change_password')
          .eq('email', email)
          .maybeSingle();

        if (error) {
          return handleSupabaseError(error, 'mustChangePassword');
        }

        return createSuccessResult(data?.must_change_password ?? false);
      }

      return createSuccessResult(false);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while checking password status',
        undefined,
        error
      );
    }
  }

  /**
   * Clear must change password flag
   */
  async clearMustChangePassword(email: string, role: UserRole): Promise<ServiceResult<void>> {
    try {
      if (role === 'manager') {
        const { error } = await supabase
          .from('managers')
          .update({ must_change_password: false })
          .eq('email', email);

        if (error) {
          return handleSupabaseError(error, 'clearMustChangePassword');
        }
      }

      if (role === 'worker') {
        const { error } = await supabase
          .from('workers')
          .update({ must_change_password: false })
          .eq('email', email);

        if (error) {
          return handleSupabaseError(error, 'clearMustChangePassword');
        }
      }

      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(
        'UNEXPECTED_ERROR',
        'An unexpected error occurred while clearing password flag',
        undefined,
        error
      );
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
