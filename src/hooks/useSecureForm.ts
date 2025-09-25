import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { checkRateLimit, secureError } from '@/lib/validation';
import { toast } from '@/hooks/use-toast';

interface SecureFormOptions<T> {
  schema: z.ZodSchema<T>;
  rateLimit?: {
    key: string;
    maxRequests?: number;
    windowMs?: number;
  };
  onSubmit: (data: T) => Promise<void>;
  defaultValues?: Partial<T>;
}

export function useSecureForm<T extends Record<string, any>>({
  schema,
  rateLimit,
  onSubmit,
  defaultValues
}: SecureFormOptions<T>) {
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
  });

  const secureSubmit = async (data: T) => {
    try {
      // Rate limiting check
      if (rateLimit) {
        const rateLimitKey = `${rateLimit.key}_${Date.now()}`;
        if (!checkRateLimit(rateLimitKey, rateLimit.maxRequests, rateLimit.windowMs)) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Too many requests. Please try again later.",
            variant: "destructive",
          });
          return;
        }
      }

      // Schema validation (redundant but ensures data integrity)
      const validatedData = schema.parse(data);
      
      await onSubmit(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        error.errors.forEach(err => {
          toast({
            title: "Validation Error",
            description: err.message,
            variant: "destructive",
          });
        });
      } else {
        secureError('Form submission error:', error);
        toast({
          title: "Submission Failed",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  return {
    ...form,
    handleSecureSubmit: form.handleSubmit(secureSubmit),
  };
}