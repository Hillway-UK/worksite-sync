import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { AutoTimeLogo } from '@/components/AutoTimeLogo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureForm } from '@/hooks/useSecureForm';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Eye, EyeOff, Lock } from 'lucide-react';

const updatePasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type UpdatePasswordForm = z.infer<typeof updatePasswordSchema>;

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updatePassword } = useAuth();
  const [isValidating, setIsValidating] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (typeof window === 'undefined') return;

        // Helpful for debugging in case users paste screenshots
        console.log('FULL URL', window.location.href);

        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(
          window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : ''
        );

        // 0) If Supabase sent error details in URL, surface it and bail.
        const urlError =
          hashParams.get('error') || queryParams.get('error');
        const urlErrorDesc =
          hashParams.get('error_description') || queryParams.get('error_description');

        if (urlError) {
          toast({
            title: 'Invalid Reset Link',
            description: urlErrorDesc || 'The reset link is invalid or has expired.',
            variant: 'destructive',
          });
          navigate('/forgot-password', { replace: true });
          return;
        }

        // 1) NEW FLOW (PKCE): Supabase redirects with ?code=...
        const code = queryParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          // Clean the URL after exchanging the code
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsValidating(false);
          return;
        }

        // 2) LEGACY FLOW: hash/query tokens (?/#+access_token, +refresh_token) with type=recovery
        const typeParam = hashParams.get('type') || queryParams.get('type');
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

        console.log('TOKENS', {
          typeParam,
          hasAccess: !!accessToken,
          hasRefresh: !!refreshToken,
        });

        if (typeParam === 'recovery' && (accessToken || refreshToken)) {
          // If both tokens exist, set the session explicitly.
          if (accessToken && refreshToken) {
            const { error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setErr) throw setErr;
          } else {
            // If only access_token is present, give supabase-js a moment to hydrate the session.
            await new Promise((r) => setTimeout(r, 100));
          }

          // Check if we now have a session
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            window.history.replaceState({}, document.title, window.location.pathname);
            setIsValidating(false);
            return;
          }
        }

        // 3) If we already have a session for any reason, proceed.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setIsValidating(false);
          return;
        }

        // 4) Otherwise, invalid/expired link
        throw new Error('No valid tokens found');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, searchParams]);

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
          title: 'Update Failed',
          description: error.message || 'Failed to update password. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Password Updated',
        description: 'Your password has been successfully updated. You can now log in with your new password.',
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
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <AutoTimeLogo className="mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Reset Your Password</h1>
        </div>

        <form onSubmit={handleSecureSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  {...register('password')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  {...register('confirmPassword')}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Password requirements:</p>
            <ul className="space-y-1 ml-4">
              <li className="flex items-center space-x-2">
                <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                <span>At least 8 characters long</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                <span>Contains uppercase and lowercase letters</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                <span>Contains at least one number</span>
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full bg-black hover:bg-black/90 text-white"
            disabled={isSubmitting}
          >
            <Lock size={16} className="mr-2" />
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </form>

        <div className="text-center">
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UpdatePassword;
