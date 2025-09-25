/**
 * SECURITY: Environment Configuration
 * Centralized environment variable handling with validation and type safety
 * Prevents hard-coded credentials and ensures required configs are present
 */

import { z } from 'zod';

// Define strict schema for environment variables
const envSchema = z.object({
  // Supabase configuration - required for database access
  VITE_SUPABASE_URL: z.string().url('Invalid Supabase URL format'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'Supabase publishable key is required'),
  VITE_SUPABASE_PROJECT_ID: z.string().min(1, 'Supabase project ID is required'),
  
  // Optional configurations with defaults
  VITE_STRIPE_PUBLIC_KEY: z.string().optional(),
  
  // Runtime environment detection
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
});

/**
 * Parse and validate environment variables
 * Throws descriptive errors if validation fails to prevent runtime issues
 */
function parseEnvironment() {
  const env = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    VITE_STRIPE_PUBLIC_KEY: import.meta.env.VITE_STRIPE_PUBLIC_KEY,
    NODE_ENV: import.meta.env.NODE_ENV || 'development',
  };

  try {
    return envSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(
        `Environment validation failed:\n${missingVars.join('\n')}\n\nPlease check your .env file.`
      );
    }
    throw error;
  }
}

// Export validated environment configuration
export const env = parseEnvironment();

/**
 * Type-safe environment access
 * Use this instead of import.meta.env directly
 */
export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

/**
 * SECURITY: Sensitive data detection
 * Helps identify potentially sensitive information for logging/debugging
 */
export const isSensitiveField = (key: string): boolean => {
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /credential/i,
    /auth/i,
    /api[_-]?key/i,
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(key));
};

/**
 * SECURITY: Data masking utility
 * Masks sensitive data for safe logging
 */
export const maskSensitiveData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }
  
  const masked: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveField(key)) {
      masked[key] = typeof value === 'string' && value.length > 0 
        ? `${value.substring(0, 4)}****${value.substring(value.length - 4)}`
        : '****';
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
};