import { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { AutoTimeLogo } from '@/components/AutoTimeLogo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useSecureForm } from '@/hooks/useSecureForm';
import { emailSchema } from '@/lib/validation';
import { toast } from '@/hooks/use-toast';

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword = () => {
  const [isSuccess, setIsSuccess] = useState(false);
  const { requestPasswordReset } = useAuth();

  const {
    register,
    handleSecureSubmit,
    formState: { errors, isSubmitting },
  } = useSecureForm<ForgotPasswordForm>({
    schema: forgotPasswordSchema,
    rateLimit: {
      key: 'password_reset',
      maxRequests: 3,
      windowMs: 300000, // 5 minutes
    },
    onSubmit: async (data) => {
      const { error } = await requestPasswordReset(data.email);
      
      if (error) {
        toast({
          title: "Reset Failed",
          description: "An error occurred. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setIsSuccess(true);
      toast({
        title: "Reset Email Sent",
        description: "If an account with that email exists, we've sent you a reset link.",
      });
    },
  });

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AutoTimeLogo className="mx-auto mb-4" />
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We've sent a password reset link to your email address if an account exists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Didn't receive the email? Check your spam folder or wait a few minutes before trying again.
              </p>
              <div className="text-center">
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    Back to Login
                  </Button>
                </Link>
              </div>
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
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSecureSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register('email')}
                className="w-full"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
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

export default ForgotPassword;