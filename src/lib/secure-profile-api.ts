import { supabase } from '@/integrations/supabase/client';
import { secureLog, secureError } from '@/lib/validation';
import { z } from 'zod';

// Validation schemas for profile operations
const profileUpdateSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .optional(),
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Valid email is required')
    .max(255, 'Email must be less than 255 characters')
    .optional(),
});

const passwordChangeSchema = z.object({
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase, uppercase, and number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

interface ProfileUpdateData {
  name?: string;
  email?: string;
}

interface PasswordChangeData {
  newPassword: string;
  confirmPassword: string;
}

interface PhotoUploadData {
  file: File;
}

/**
 * Secure API client for profile operations
 * All sensitive operations are handled server-side
 */
export class SecureProfileAPI {
  private static async callSecureEndpoint(action: string, data: any) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      const response = await supabase.functions.invoke('secure-profile-operations', {
        body: { action, data },
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Operation failed');
      }

      return response.data;
    } catch (error) {
      secureError('Secure profile operation failed:', { action, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Update user profile information
   */
  static async updateProfile(data: ProfileUpdateData) {
    // Client-side validation
    const validated = profileUpdateSchema.parse(data);
    
    secureLog('Profile update requested', { hasName: !!validated.name, hasEmail: !!validated.email });
    
    return await this.callSecureEndpoint('update_profile', validated);
  }

  /**
   * Change user password
   */
  static async changePassword(data: PasswordChangeData) {
    // Client-side validation
    const validated = passwordChangeSchema.parse(data);
    
    secureLog('Password change requested');
    
    // Remove password from data before sending (extra security)
    const secureData = {
      newPassword: validated.newPassword,
      confirmPassword: validated.confirmPassword,
    };
    
    return await this.callSecureEndpoint('change_password', secureData);
  }

  /**
   * Upload profile photo
   */
  static async uploadPhoto(data: PhotoUploadData) {
    const { file } = data;
    
    // Validate file type and size client-side
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPG, PNG, and WebP allowed.');
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
      throw new Error('File too large. Maximum size is 5MB.');
    }
    
    secureLog('Photo upload requested', { fileType: file.type, fileSize: file.size });
    
    // Convert file to base64 for secure transmission
    const reader = new FileReader();
    const photoData = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 data
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    return await this.callSecureEndpoint('upload_photo', {
      photoData,
      photoFileName: file.name,
    });
  }

  /**
   * Get current user profile (read-only, safe for client-side)
   */
  static async getCurrentProfile() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: worker, error: workerError } = await supabase
        .from('workers')
        .select('id, name, email, hourly_rate, photo_url, phone, address, emergency_contact, date_started')
        .eq('email', user.email)
        .single();

      if (workerError) {
        throw new Error('Failed to load profile');
      }

      return {
        user,
        worker,
      };
    } catch (error) {
      secureError('Failed to load profile:', error);
      throw error;
    }
  }
}