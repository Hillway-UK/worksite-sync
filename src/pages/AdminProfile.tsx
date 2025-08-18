import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { User } from 'lucide-react';
import { format } from 'date-fns';

interface ManagerProfile {
  id: string;
  name: string;
  email: string;
  pin: string | null;
  created_at: string;
}

export default function AdminProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    pin: ''
  });

  useEffect(() => {
    fetchProfile();
  }, [user]);

  // Sync form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        pin: profile.pin || ''
      });
      setHasChanges(false);
    }
  }, [profile]);

  const fetchProfile = async () => {
    if (!user?.email) return;

    try {
      const { data, error } = await supabase
        .from('managers')
        .select('*')
        .eq('email', user.email)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile?.id) {
      toast({
        title: "Error",
        description: "Profile not found",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Update the manager record
      const { error } = await supabase
        .from('managers')
        .update({
          name: formData.name || '',
          pin: formData.pin || null
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Update local profile state
      setProfile(prev => prev ? { ...prev, ...formData } : null);
      setHasChanges(false);
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive">Profile Not Found</h1>
            <p className="text-muted-foreground">Unable to load your manager profile.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <User className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-heading font-extrabold text-foreground mb-2">
            Manager Profile
          </h1>
          <p className="text-muted-foreground font-body">
            Manage your personal information
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="font-body font-semibold text-[#111111]">
                  Full Name
                </Label>
                <div className="relative">
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setFormData(prev => ({ ...prev, name: newValue }));
                      setHasChanges(true);
                    }}
                    onKeyDown={(e) => {
                      // Allow all normal typing
                      e.stopPropagation();
                    }}
                    className="font-body border-[#939393] focus:border-[#702D30] focus:ring-[#702D30] pr-10"
                    placeholder="Enter your name"
                    disabled={loading}
                  />
                  {hasChanges && formData.name !== profile?.name && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <span className="text-xs text-[#ED8936] font-body">Modified</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <Label htmlFor="pin">PIN (Optional)</Label>
                <Input
                  id="pin"
                  type="password"
                  value={formData.pin}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setFormData(prev => ({ ...prev, pin: newValue }));
                    setHasChanges(true);
                  }}
                  placeholder="Enter 4-digit PIN"
                  maxLength={4}
                />
              </div>

              <Button 
                onClick={handleSave} 
                disabled={saving || !hasChanges} 
                className="w-full"
                variant={hasChanges ? "default" : "secondary"}
              >
                {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Manager Since</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  {format(new Date(profile.created_at), 'MMMM d, yyyy')}
                </div>
              </div>

              <div>
                <Label>Account Status</Label>
                <div className="p-2 bg-muted rounded text-sm text-green-600">
                  Active Manager
                </div>
              </div>

              <div>
                <Label>Role</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  Construction Manager
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}