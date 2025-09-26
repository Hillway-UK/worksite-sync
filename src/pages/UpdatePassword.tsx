import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { AutoTimeLogo } from '@/components/AutoTimeLogo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureForm } from '@/hooks/useSecureForm';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
const updatePasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type UpdatePasswordForm = z.infer<typeof updatePasswordSchema>;

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updatePassword, user } = useAuth();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Check for error parameters in URL first (hash and query)
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const hashParams = new URLSearchParams(hash && hash.startsWith('#') ? hash.slice(1) : '');
        
        const errorFromHash = hashParams.get('error');
        const errorDescriptionFromHash = hashParams.get('error_description');
        const errorFromQuery = searchParams.get('error');
        const errorDescriptionFromQuery = searchParams.get('error_description');
        
        const error = errorFromHash || errorFromQuery;
        const errorDescription = errorDescriptionFromHash || errorDescriptionFromQuery;
        
        console.log('UpdatePassword: URL parameters check', {
          hash,
          error,
          errorDescription,
          searchParams: Object.fromEntries(searchParams.entries())
        });

        if (error) {
          console.error('UpdatePassword: Error in URL parameters', { error, errorDescription });
          let message = 'The reset link is invalid or has expired.';
          
          if (error === 'access_denied' || errorDescription) {
            message = errorDescription || 'Access denied. The reset link may have expired.';
          }
          
          toast({
            title: 'Invalid Reset Link',
            description: message,
            variant: 'destructive',
          });
          navigate('/forgot-password', { replace: true });
          return;
        }

        // 1) Check for password reset hash tokens (#access_token=...&refresh_token=...&type=recovery)
        const typeParam = hashParams.get('type') || searchParams.get('type');
        
        if (typeParam === 'recovery') {
          console.log('UpdatePassword: Found recovery type, processing password reset flow');
          
          const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            console.log('UpdatePassword: Found recovery tokens, setting session');
            const { data: current } = await supabase.auth.getSession();
            if (!current.session) {
              const { error: setErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (setErr) {
                console.error('UpdatePassword: setSession failed for recovery', setErr);
                throw setErr;
              }
            }
            
            console.log('UpdatePassword: Password reset session established');
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            setIsValidating(false);
            return;
          }
        }

        // 2) Fallback: Check for any access/refresh tokens without recovery type
        const accessFromHash = hashParams.get('access_token');
        const refreshFromHash = hashParams.get('refresh_token');
        const accessFromQuery = searchParams.get('access_token');
        const refreshFromQuery = searchParams.get('refresh_token');

        const accessToken = accessFromQuery || accessFromHash;
        const refreshToken = refreshFromQuery || refreshFromHash;

        if (accessToken && refreshToken && typeParam !== 'recovery') {
          console.log('UpdatePassword: Found general access/refresh tokens, setting session');
          const { data: current } = await supabase.auth.getSession();
          if (!current.session) {
            const { error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setErr) {
              console.error('UpdatePassword: setSession failed', setErr);
              throw setErr;
            }
          }
          setIsValidating(false);
          return;
        }

        // 3) As a fallback, check if a session already exists
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          console.log('UpdatePassword: Found existing session');
          setIsValidating(false);
          return;
        }

        // Otherwise, invalid link
        console.log('UpdatePassword: No valid tokens found, redirecting to forgot password');
        toast({
          title: 'Invalid Reset Link',
          description: 'The reset link is invalid or has expired. Please request a new one.',
          variant: 'destructive',
        });
        navigate('/forgot-password', { replace: true });
      } catch (err) {
        console.error('UpdatePassword: token handling failed', err);
        toast({
          title: 'Invalid Reset Link',
          description: 'The reset link is invalid or has expired. Please request a new one.',
          variant: 'destructive',
        });
        navigate('/forgot-password', { replace: true });
      }
    })();
  }, [searchParams, navigate]);

  const {
    register,
    handleSecureSubmit,
    formState: { errors, isSubmitting },
  } = useSecureForm<UpdatePasswordForm>({
    schema: updatePasswordSchema,
    rateLimit: {
      key: 'password_update',
      maxRequests: 5,
      windowMs: 300000, // 5 minutes
    },
    onSubmit: async (data) => {
      const { error } = await updatePassword(data.password);
      
      if (error) {
        toast({
          title: "Update Failed",
          description: error.message || "Failed to update password. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated. You can now log in with your new password.",
      });

      // Sign out to force fresh login with new password
      await supabase.auth.signOut();
      navigate('/login');
    },
  });

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Validating reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AutoTimeLogo className="mx-auto mb-4" />
          <CardTitle>Update Password</CardTitle>
          <CardDescription>
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSecureSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter new password"
                {...register('password')}
                className="w-full"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                {...register('confirmPassword')}
                className="w-full"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatePassword;