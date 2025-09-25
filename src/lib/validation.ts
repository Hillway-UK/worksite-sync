import { z } from 'zod';

// Enhanced input validation schemas
export const sanitizeHtml = (input: string): string => {
  // Basic HTML sanitization - remove script tags and dangerous content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

export const sanitizeInput = (input: string): string => {
  // Basic input sanitization
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/['"]/g, '') // Remove quotes that could break SQL
    .trim()
    .substring(0, 1000); // Limit length
};

// Common validation schemas
export const emailSchema = z.string()
  .trim()
  .toLowerCase()
  .email('Valid email is required')
  .max(255, 'Email must be less than 255 characters')
  .refine(email => !email.includes('..'), 'Invalid email format')
  .refine(email => !/[<>'"]/g.test(email), 'Email contains invalid characters');

export const nameSchema = z.string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be less than 100 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .transform(name => sanitizeInput(name));

export const phoneSchema = z.string()
  .trim()
  .optional()
  .refine(val => !val || /^[\d\s\-\+\(\)]{7,20}$/.test(val), 'Invalid phone number format')
  .transform(phone => phone ? sanitizeInput(phone) : phone);

export const textSchema = (maxLength: number = 500) => z.string()
  .trim()
  .max(maxLength, `Text must be less than ${maxLength} characters`)
  .transform(text => sanitizeInput(text))
  .optional();

export const htmlTextSchema = (maxLength: number = 1000) => z.string()
  .trim()
  .max(maxLength, `Content must be less than ${maxLength} characters`)
  .transform(text => sanitizeHtml(text))
  .optional();

// Rate limiting helpers
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (key: string, maxRequests: number = 5, windowMs: number = 60000): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
};

// Security headers helper
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
};

// Secure password generation
export const generateSecurePassword = (length: number = 16): string => {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => charset[byte % charset.length]).join('') + 'Aa1!';
};

// Environment-based logging
export const secureLog = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(message, data);
  }
  // In production, this could send to a secure logging service
};

export const secureError = (message: string, error?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.error(message, error);
  }
  // In production, this could send to error monitoring service
};