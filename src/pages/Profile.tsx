import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Lock, User, FileText, Camera, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { SecureProfileAPI } from '@/lib/secure-profile-api';
import { SecureFormWrapper } from '@/components/SecureFormWrapper';
import { z } from 'zod';

// Validation schemas
const profileSchema = z.object({
  name: z.string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Valid email is required')
    .max(255, 'Email must be less than 255 characters'),
});

const passwordSchema = z.object({
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase, uppercase, and number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function Profile() {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    hourlyRate: 0,
    workerId: '',
    photoUrl: '',
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setInitialLoading(true);
      const { user, worker } = await SecureProfileAPI.getCurrentProfile();
      
      if (!user) {
        navigate('/login');
        return;
      }
      
      setProfileData({
        name: worker.name || '',
        email: worker.email || '',
        hourlyRate: worker.hourly_rate || 0,
        workerId: worker.id,
        photoUrl: worker.photo_url || '',
      });
    } catch (error) {
      toast.error('Failed to load profile');
      navigate('/login');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleProfileSubmit = async (data: z.infer<typeof profileSchema>) => {
    try {
      const result = await SecureProfileAPI.updateProfile({
        name: data.name,
        email: data.email,
      });
      
      toast.success(result.message);
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        name: data.name,
        email: data.email,
      }));
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
      throw error; // Re-throw to let SecureFormWrapper handle it
    }
  };

  const handlePasswordSubmit = async (data: z.infer<typeof passwordSchema>) => {
    try {
      const result = await SecureProfileAPI.changePassword({
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      
      toast.success(result.message);
      
      // Clear password fields
      setPasswordData({
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
      throw error; // Re-throw to let SecureFormWrapper handle it
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const result = await SecureProfileAPI.uploadPhoto({ file });
      
      setProfileData(prev => ({
        ...prev,
        photoUrl: result.photoUrl,
      }));
      
      toast.success(result.message);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading secure profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <Button
              onClick={() => navigate('/timesheets')}
              variant="outline"
            >
              <FileText className="mr-2 h-4 w-4" />
              Timesheets
            </Button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">Secure Worker Profile</h1>
            <Shield className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm text-muted-foreground">
            Your profile data is protected with enterprise-grade security
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Profile Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
                <Shield className="h-4 w-4 text-green-600 ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo Section */}
              <div className="flex items-center gap-4">
                {profileData.photoUrl && (
                  <img src={profileData.photoUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                )}
                <div>
                  <input
                    type="file"
                    id="photo-upload"
                    className="hidden"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    disabled={loading}
                  />
                  <label htmlFor="photo-upload">
                    <Button variant="outline" size="sm" asChild disabled={loading}>
                      <span>
                        <Camera className="mr-2 h-4 w-4" />
                        {loading ? 'Uploading...' : 'Upload Photo'}
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 5MB. JPG, PNG, WebP only.
                  </p>
                </div>
              </div>

              <SecureFormWrapper
                schema={profileSchema}
                onSubmit={handleProfileSubmit}
                defaultValues={{
                  name: profileData.name,
                  email: profileData.email,
                }}
                requireCSRF={true}
                rateLimit={{
                  key: 'profile-update',
                  maxRequests: 3,
                  windowMs: 60000,
                }}
                title="Update Profile"
                description="Your data is encrypted and securely processed"
              >
                {({ register, formState: { errors, isSubmitting } }) => (
                  <>
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        type="text"
                        {...register('name')}
                        placeholder="Enter your name"
                        disabled={isSubmitting}
                        maxLength={100}
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        {...register('email')}
                        placeholder="Enter your email"
                        disabled={isSubmitting}
                        maxLength={255}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        You'll need to verify any new email address
                      </p>
                    </div>

                    <div>
                      <Label>Hourly Rate</Label>
                      <div className="text-lg font-semibold">£{profileData.hourlyRate.toFixed(2)}/hour</div>
                      <p className="text-sm text-muted-foreground">Contact your manager to update</p>
                    </div>
                    
                    <Button 
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting ? 'Saving...' : 'Save Profile'}
                    </Button>
                  </>
                )}
              </SecureFormWrapper>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
                <Shield className="h-4 w-4 text-green-600 ml-auto" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SecureFormWrapper
                schema={passwordSchema}
                onSubmit={handlePasswordSubmit}
                defaultValues={{
                  newPassword: '',
                  confirmPassword: '',
                }}
                requireCSRF={true}
                rateLimit={{
                  key: 'password-change',
                  maxRequests: 2,
                  windowMs: 300000, // 5 minutes
                }}
                title="Change Password"
                description="Password must be at least 8 characters with uppercase, lowercase, and numbers"
              >
                {({ register, formState: { errors, isSubmitting }, reset }) => (
                  <>
                    <div>
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        {...register('newPassword')}
                        placeholder="Enter new password (min 8 characters)"
                        disabled={isSubmitting}
                        maxLength={128}
                      />
                      {errors.newPassword && (
                        <p className="text-sm text-destructive mt-1">{errors.newPassword.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        {...register('confirmPassword')}
                        placeholder="Confirm new password"
                        disabled={isSubmitting}
                        maxLength={128}
                      />
                      {errors.confirmPassword && (
                        <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>
                      )}
                    </div>
                    
                    <Button 
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      {isSubmitting ? 'Changing...' : 'Change Password'}
                    </Button>
                  </>
                )}
              </SecureFormWrapper>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}