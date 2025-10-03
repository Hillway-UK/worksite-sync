import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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
const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updatePassword } = useAuth();
  const [isValidating, setIsValidating] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  // Get source parameter to determine flow (invite or reset)
  const source = searchParams.get('source'); // 'invite' or 'reset'

  useEffect(() => {
    (async () => {
      try {
        // 1. Check for PKCE code first
        const code = searchParams.get('code');
        if (code) {
          console.log('ResetPassword: Exchanging code for session...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          
          // Clear URL after successful exchange
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsValidating(false);
          return;
        }

        // 2. Extract tokens from hash and query parameters
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const hashParams = new URLSearchParams(hash && hash.startsWith('#') ? hash.slice(1) : '');
        
        const accessToken = searchParams.get('access_token') || hashParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token');
        const type = searchParams.get('type') || hashParams.get('type');

        // 3. If we have tokens and it's a recovery link, establish session
        if (accessToken && refreshToken && type === 'recovery') {
          console.log('ResetPassword: Setting session with recovery tokens...');
          
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) throw error;
          
          // Clear URL tokens after successful session establishment
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsValidating(false);
          return;
        }

        // 4. Check if we already have a valid session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          console.log('ResetPassword: Valid session found');
          setIsValidating(false);
          return;
        }

        // 5. No valid tokens or session found
        console.log('ResetPassword: No valid tokens found, redirecting...');
        setShouldRedirect(true);
        toast({
          title: 'Invalid Reset Link',
          description: 'The reset link is invalid or has expired. Please request a new one.',
          variant: 'destructive',
        });
        navigate('/forgot-password', { replace: true });
        
      } catch (err) {
        console.error('ResetPassword: Session establishment failed', err);
        setShouldRedirect(true);
        toast({
          title: 'Invalid Reset Link',
          description: 'The reset link is invalid or has expired. Please request a new one.',
          variant: 'destructive',
        });
        navigate('/forgot-password', { replace: true });
      }
    })();
  }, [searchParams, navigate]);

  // Don't render anything if we're redirecting
  if (shouldRedirect) {
    return null;
  }

  const {
    register,
    handleSecureSubmit,
    formState: { errors, isSubmitting },
  } = useSecureForm<ResetPasswordForm>({
    schema: resetPasswordSchema,
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

      // Handle different flows based on source parameter
      if (source === 'invite') {
        // Worker invitation flow - keep them signed in and redirect to dashboard
        toast({
          title: "Welcome to AutoTime!",
          description: "Your password has been set successfully.",
        });
        navigate('/');
      } else {
        // Password reset flow - sign out and redirect to login
        toast({
          title: "Password Updated",
          description: "Your password has been successfully updated. You can now log in with your new password.",
        });
        await supabase.auth.signOut();
        navigate('/login');
      }
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
          <CardTitle>
            {source === 'invite' ? 'Welcome to AutoTime!' : 'Reset Password'}
          </CardTitle>
          <CardDescription>
            {source === 'invite' 
              ? 'Set your password to get started with AutoTime'
              : 'Enter your new password below'
            }
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
              {isSubmitting ? 'Setting Password...' : (source === 'invite' ? 'Set Password & Continue' : 'Confirm Reset')}
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;