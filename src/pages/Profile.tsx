import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Lock, User, FileText, Camera } from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [hourlyRate, setHourlyRate] = useState(0);
  const [workerId, setWorkerId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    loadWorker();
  }, []);

  const loadWorker = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }
    
    const { data } = await supabase
      .from('workers')
      .select('*')
      .eq('email', user.email)
      .single();
    
    if (data) {
      setName(data.name || '');
      setEmail(data.email || '');
      setCurrentEmail(data.email || '');
      setHourlyRate(data.hourly_rate || 0);
      setWorkerId(data.id);
      setPhotoUrl(data.photo_url || '');
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      // Update name in database
      const { error: dbError } = await supabase
        .from('workers')
        .update({ name: name })
        .eq('id', workerId);
      
      if (dbError) throw dbError;

      // Update email if changed
      if (email !== currentEmail) {
        // Update auth email
        const { error: authError } = await supabase.auth.updateUser({
          email: email
        });
        
        if (authError) throw authError;

        // Update database email
        const { error: emailDbError } = await supabase
          .from('workers')
          .update({ email: email })
          .eq('id', workerId);
        
        if (emailDbError) throw emailDbError;
        
        toast.success('Profile updated! Check your new email for verification.');
        setCurrentEmail(email);
      } else {
        toast.success('Profile updated successfully!');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    // Validate passwords
    if (!newPassword || newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      // Clear password fields
      setNewPassword('');
      setConfirmPassword('');
      
      toast.success('Password changed successfully!');
    } catch (error: any) {
      console.error('Password change error:', error);
      toast.error(error.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${workerId}-${Date.now()}.${fileExt}`;
      const filePath = `worker-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('worker-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('worker-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('workers')
        .update({ photo_url: publicUrl })
        .eq('id', workerId);

      if (updateError) throw updateError;

      setPhotoUrl(publicUrl);
      toast.success('Photo updated successfully!');
    } catch (error: any) {
      toast.error('Failed to upload photo');
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-foreground">Worker Profile</h1>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Profile Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Photo Section */}
              <div className="flex items-center gap-4">
                {photoUrl && (
                  <img src={photoUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                )}
                <div>
                  <input
                    type="file"
                    id="photo-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={saving}
                  />
                  <label htmlFor="photo-upload">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Camera className="mr-2 h-4 w-4" />
                        Upload Photo
                      </span>
                    </Button>
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={saving}
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={saving}
                />
                {email !== currentEmail && (
                  <p className="text-sm text-amber-600 mt-1">
                    You'll need to verify your new email address
                  </p>
                )}
              </div>

              <div>
                <Label>Hourly Rate</Label>
                <div className="text-lg font-semibold">£{hourlyRate.toFixed(2)}/hour</div>
                <p className="text-sm text-muted-foreground">Contact your manager to update</p>
              </div>
              
              <Button 
                onClick={saveProfile} 
                className="w-full"
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  disabled={saving}
                />
              </div>
              
              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={saving}
                />
              </div>
              
              <Button 
                onClick={changePassword} 
                className="w-full"
                disabled={saving || !newPassword || !confirmPassword}
              >
                <Lock className="mr-2 h-4 w-4" />
                {saving ? 'Changing...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}