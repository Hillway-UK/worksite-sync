/**
 * SECURITY: Secure Form Wrapper Component
 * Provides comprehensive form security including CSRF protection, input validation, and XSS prevention
 */

import React, { ReactNode, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { csrfProtection, XSSProtection, securityMonitor } from '@/lib/security-middleware';
import { useSecureForm } from '@/hooks/useSecureForm';
import { secureLog, secureError } from '@/lib/validation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

interface SecureFormWrapperProps<T extends Record<string, any>> {
  // Form configuration
  schema: z.ZodSchema<T>;
  onSubmit: (data: T) => Promise<void>;
  defaultValues?: Partial<T>;
  
  // Security configuration
  requireCSRF?: boolean;
  rateLimit?: {
    key: string;
    maxRequests?: number;
    windowMs?: number;
  };
  
  // UI configuration
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  
  // Callback props
  onSecurityViolation?: (violation: string) => void;
  onValidationError?: (errors: any) => void;
}

/**
 * SECURITY: Enhanced secure form wrapper with comprehensive protection
 */
export function SecureFormWrapper<T extends Record<string, any>>({
  schema,
  onSubmit,
  defaultValues,
  requireCSRF = true,
  rateLimit,
  title,
  description,
  children,
  className,
  onSecurityViolation,
  onValidationError
}: SecureFormWrapperProps<T>) {
  const [csrfToken, setCsrfToken] = React.useState<string>('');
  const [securityError, setSecurityError] = React.useState<string>('');
  
  // SECURITY: Initialize CSRF protection
  useEffect(() => {
    if (requireCSRF) {
      const token = csrfProtection.generateToken();
      setCsrfToken(token);
      
      securityMonitor.logSecurityEvent({
        type: 'authentication',
        severity: 'low',
        message: 'CSRF token generated for form',
        metadata: { formTitle: title }
      });
    }
  }, [requireCSRF, title]);
  
  // SECURITY: Enhanced schema with security validations
  const secureSchema = React.useMemo(() => {
    return schema.refine((data) => {
      // CSRF validation
      if (requireCSRF && !csrfProtection.validateToken(csrfToken)) {
        setSecurityError('Security validation failed. Please refresh the page.');
        onSecurityViolation?.('CSRF token validation failed');
        return false;
      }
      
      // XSS validation for string fields
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          const sanitized = XSSProtection.sanitizeHTML(value);
          if (sanitized !== value) {
            setSecurityError('Invalid characters detected in form data.');
            onSecurityViolation?.(`XSS attempt in field: ${key}`);
            return false;
          }
        }
      }
      
      return true;
    }, {
      message: 'Security validation failed'
    });
  }, [schema, requireCSRF, csrfToken, onSecurityViolation]);
  
  // SECURITY: Enhanced form submission with security checks
  const secureSubmit = React.useCallback(async (data: T) => {
    try {
      setSecurityError('');
      
      // Additional runtime security checks
      const serializedData = JSON.stringify(data);
      
      // Check payload size
      if (serializedData.length > 1024 * 1024) { // 1MB limit
        throw new Error('Form data exceeds maximum allowed size');
      }
      
      // Log form submission attempt
      securityMonitor.logSecurityEvent({
        type: 'input_validation',
        severity: 'low',
        message: 'Secure form submission attempt',
        metadata: {
          formTitle: title,
          dataSize: serializedData.length,
          fieldCount: Object.keys(data).length
        }
      });
      
      // Execute the actual submission
      await onSubmit(data);
      
      // Log successful submission
      secureLog('Secure form submitted successfully', {
        formTitle: title,
        fieldCount: Object.keys(data).length
      });
      
    } catch (error) {
      secureError('Secure form submission failed', { error, formTitle: title });
      
      securityMonitor.logSecurityEvent({
        type: 'input_validation',
        severity: 'medium',
        message: 'Form submission failed',
        metadata: {
          formTitle: title,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      throw error;
    }
  }, [onSubmit, title]);
  
  // Use the secure form hook
  const form = useSecureForm({
    schema: secureSchema,
    onSubmit: secureSubmit,
    defaultValues,
    rateLimit
  });
  
  // Handle validation errors
  React.useEffect(() => {
    const subscription = form.watch(() => {
      const errors = form.formState.errors;
      if (Object.keys(errors).length > 0) {
        onValidationError?.(errors);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, onValidationError]);
  
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-primary" />
            {title && <CardTitle>{title}</CardTitle>}
          </div>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
      )}
      
      <CardContent>
        {/* Security Error Display */}
        {securityError && (
          <Alert className="mb-4" variant="destructive">
            <Shield className="h-4 w-4" />
            <AlertDescription>{securityError}</AlertDescription>
          </Alert>
        )}
        
        {/* Form Provider */}
        <FormProvider {...form}>
          <form onSubmit={form.handleSecureSubmit} className="space-y-4">
            {/* CSRF Token (hidden) */}
            {requireCSRF && (
              <input
                type="hidden"
                name="csrf_token"
                value={csrfToken}
                readOnly
              />
            )}
            
            {/* Form Content */}
            {children}
          </form>
        </FormProvider>
        
        {/* Security Info */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>
              This form is protected by security measures including input validation, 
              {requireCSRF && ' CSRF protection,'} and XSS filtering.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SECURITY: Utility hook for form security status
 */
export const useFormSecurity = () => {
  return {
    generateCSRFToken: () => csrfProtection.generateToken(),
    validateCSRFToken: (token: string) => csrfProtection.validateToken(token),
    sanitizeHTML: (input: string) => XSSProtection.sanitizeHTML(input),
    validateURL: (url: string) => XSSProtection.validateURL(url)
  };
};