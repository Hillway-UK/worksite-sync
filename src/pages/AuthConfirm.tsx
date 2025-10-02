import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

const AuthConfirm = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const confirmationUrl = searchParams.get('confirmation_url');
    
    if (confirmationUrl) {
      console.log('Redirecting to Supabase confirmation URL...');
      // Immediately redirect to Supabase confirmation link
      window.location.assign(confirmationUrl);
    } else {
      console.error('No confirmation_url parameter found');
      // Redirect to login after 3 seconds if no confirmation URL
      setTimeout(() => {
        window.location.assign('https://autotimeworkers.hillwayco.uk/');
      }, 3000);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg font-medium">Confirming your account...</p>
            <p className="text-sm text-muted-foreground mt-2">You will be redirected shortly.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthConfirm;
