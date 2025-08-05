import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    console.log('Login page - userRole changed to:', userRole);
    console.log('Login page - user:', user);
    console.log('Login page - loading:', loading);
    
    if (!loading && user && userRole) {
      console.log('Navigation conditions met - userRole:', userRole);
      if (userRole === 'manager') {
        console.log('Navigating to /admin');
        navigate('/admin', { replace: true });
      } else if (userRole === 'worker') {
        console.log('Navigating to /dashboard');
        navigate('/dashboard', { replace: true });
      }
    } else {
      console.log('Navigation conditions not met:', { loading, user: !!user, userRole });
    }
  }, [user, userRole, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', email);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      console.error('Login failed:', error);
      setError(error);
      setIsLoading(false);
      toast({
        title: "Login failed",
        description: error,
        variant: "destructive",
      });
    } else {
      console.log('Login successful, waiting for role...');
      // The useEffect will handle navigation once userRole is set
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Clock className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Time Keeper</CardTitle>
          <CardDescription>
            Sign in to your workforce account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="min-h-[44px]"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="min-h-[44px]"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full min-h-[44px]"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}