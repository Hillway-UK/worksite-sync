import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Building, Users, Trash, AlertCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/query-client';

export default function SuperAdmin() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showManagerDialog, setShowManagerDialog] = useState(false);
  const [authVerified, setAuthVerified] = useState(false);
  const [creatingManager, setCreatingManager] = useState(false);
  
  const [orgForm, setOrgForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  
  const [managerForm, setManagerForm] = useState({
    email: '',
    name: '',
    password: '',
    organization_id: ''
  });

  // Authentication verification
  const { data: authData, isLoading: authLoading, error: authError } = useQuery({
    queryKey: ['superAdminAuth', user?.email],
    queryFn: async () => {
      if (!user?.email) throw new Error('No user');
      
      const { data: superAdmin, error } = await supabase
        .from('super_admins')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) throw error;
      if (!superAdmin) throw new Error('Access denied: Super admin privileges required');
      
      return superAdmin;
    },
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Set auth verified when data is available
  React.useEffect(() => {
    if (authData) {
      setAuthVerified(true);
    } else if (authError) {
      toast.error(authError.message || 'Authentication verification failed');
      setAuthVerified(false);
    }
  }, [authData, authError]);

  // Organizations query with manager counts
  const { data: organizations = [], isLoading: orgsLoading, error: orgsError } = useQuery({
    queryKey: queryKeys.organizations.withCounts(),
    queryFn: async (): Promise<any[]> => {
      // First get organizations
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      
      if (orgsError) throw orgsError;
      
      // Then get manager counts for each organization
      const orgsWithCounts = await Promise.all(
        (orgsData || []).map(async (org) => {
          const { count } = await supabase
            .from('managers')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id);
          
          return {
            ...org,
            managers: { count: count || 0 }
          };
        })
      );
      
      return orgsWithCounts;
    },
    enabled: authVerified,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Show organizations error
  React.useEffect(() => {
    if (orgsError) {
      toast.error(`Failed to load organizations: ${orgsError.message}`);
    }
  }, [orgsError]);

  // Managers query with organization names
  const { data: managers = [], isLoading: managersLoading, error: managersError } = useQuery({
    queryKey: queryKeys.managers.withOrganizations(),
    queryFn: async (): Promise<any[]> => {
      // First get managers
      const { data: managersData, error: managersError } = await supabase
        .from('managers')
        .select('*')
        .order('name');
      
      if (managersError) throw managersError;
      
      // Then get organization names for each manager
      const managersWithOrgs = await Promise.all(
        (managersData || []).map(async (manager) => {
          if (!manager.organization_id) {
            return { ...manager, organizations: null };
          }
          
          const { data: orgData } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', manager.organization_id)
            .maybeSingle();
          
          return {
            ...manager,
            organizations: orgData
          };
        })
      );
      
      return managersWithOrgs;
    },
    enabled: authVerified,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Show managers error
  React.useEffect(() => {
    if (managersError) {
      toast.error(`Failed to load managers: ${managersError.message}`);
    }
  }, [managersError]);

  const loading = authLoading || orgsLoading || managersLoading;

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (formData: typeof orgForm) => {
      if (!formData.name || !formData.email) {
        throw new Error('Organization name and email are required');
      }

      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          address: formData.address || null,
          subscription_status: 'active',
          max_workers: 50,
          max_managers: 5
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Organization created successfully');
      setShowOrgDialog(false);
      setOrgForm({ name: '', email: '', phone: '', address: '' });
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.withCounts() });
    },
    onError: (error: any) => {
      toast.error(`Failed to create organization: ${error.message}`);
    }
  });

  const createOrganization = () => {
    createOrgMutation.mutate(orgForm);
  };

  // Create manager mutation
  const createManagerMutation = useMutation({
    mutationFn: async (formData: typeof managerForm) => {
      const email = formData.email?.trim().toLowerCase();
      const name = formData.name?.trim();
      const password = formData.password;
      const organization_id = formData.organization_id;

      if (!email || !name || !password || !organization_id) {
        throw new Error('Please fill in all fields');
      }

      // 1) Try to create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: { name, role: 'manager' }
        }
      });

      // Some tenants return an error, others return identities=[] for existing users.
      const alreadyRegistered =
        !!authError &&
        (authError.message.toLowerCase().includes('already registered') ||
         authError.message.toLowerCase().includes('user already registered')) ||
        (authData?.user && Array.isArray(authData.user.identities) && authData.user.identities.length === 0);

      if (authError && !alreadyRegistered) {
        throw new Error(`Failed to create user: ${authError.message}`);
      }

      // 2) Upsert the manager row (works whether user is new or already existed)
      const { data: managerRow, error: managerError } = await supabase
        .from('managers')
        .upsert(
          { email, name, organization_id },
          { onConflict: 'email' }
        )
        .select()
        .single();

      if (managerError) {
        if ((managerError as any).code === '23505') {
          throw new Error('A manager with this email already exists.');
        } else {
          throw new Error(`Failed to create manager record: ${managerError.message}`);
        }
      }

      return { managerRow, alreadyRegistered };
    },
    onMutate: () => {
      setCreatingManager(true);
    },
    onSuccess: ({ alreadyRegistered }) => {
      if (alreadyRegistered) {
        toast.success('This email already had an account. Manager record was created/updated.');
      } else {
        toast.success('Manager created successfully! They should check their email to finish sign-up.');
      }

      setShowManagerDialog(false);
      setManagerForm({ email: '', name: '', password: '', organization_id: '' });
      queryClient.invalidateQueries({ queryKey: queryKeys.managers.withOrganizations() });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create manager');
    },
    onSettled: () => {
      setCreatingManager(false);
    }
  });

  const createManager = () => {
    createManagerMutation.mutate(managerForm);
  };

  // Delete organization mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Organization deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.withCounts() });
    },
    onError: () => {
      toast.error('Failed to delete organization');
    }
  });

  // Delete manager mutation
  const deleteManagerMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from('managers')
        .delete()
        .eq('email', email);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Manager removed');
      queryClient.invalidateQueries({ queryKey: queryKeys.managers.withOrganizations() });
    },
    onError: () => {
      toast.error('Failed to delete manager');
    }
  });

  const deleteOrganization = (id: string) => {
    if (!confirm('Delete this organization and all its data? This action cannot be undone.')) return;
    deleteOrgMutation.mutate(id);
  };

  const deleteManager = (email: string) => {
    if (!confirm('Remove this manager? This action cannot be undone.')) return;
    deleteManagerMutation.mutate(email);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!authVerified) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Super admin privileges required to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
        <Button 
          onClick={async () => {
            await supabase.auth.signOut();
            navigate('/login');
          }}
          variant="outline"
          className="border-black hover:bg-gray-100"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
      <div className="mb-4 p-3 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          Logged in as: <span className="font-medium">{user?.email}</span> | 
          Organizations: {organizations.length} | 
          Managers: {managers.length}
        </p>
      </div>
      
      {/* Organizations Section */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organizations ({organizations.length})
          </CardTitle>
          <Button onClick={() => setShowOrgDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Organization
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Managers</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map(org => (
                <TableRow 
                  key={org.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/organization/${org.id}`)}
                >
                  <TableCell className="font-medium text-primary hover:underline">
                    {org.name}
                  </TableCell>
                  <TableCell>{org.email || 'Not set'}</TableCell>
                  <TableCell>{org.phone || 'Not set'}</TableCell>
                  <TableCell>{org.managers?.count || 0}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteOrganization(org.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Managers Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Managers ({managers.length})
          </CardTitle>
          <Button onClick={() => setShowManagerDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Manager
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map(manager => (
                <TableRow key={manager.email}>
                  <TableCell className="font-medium">{manager.name}</TableCell>
                  <TableCell>{manager.email}</TableCell>
                  <TableCell>{manager.organizations?.name || 'Unassigned'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteManager(manager.email)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Organization Dialog */}
      <Dialog open={showOrgDialog} onOpenChange={setShowOrgDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="org-name">Organization Name *</Label>
              <Input
                id="org-name"
                value={orgForm.name}
                onChange={(e) => setOrgForm({...orgForm, name: e.target.value})}
                placeholder="Enter organization name"
              />
            </div>
            <div>
              <Label htmlFor="org-email">Email</Label>
              <Input
                id="org-email"
                type="email"
                value={orgForm.email}
                onChange={(e) => setOrgForm({...orgForm, email: e.target.value})}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="org-phone">Phone</Label>
              <Input
                id="org-phone"
                value={orgForm.phone}
                onChange={(e) => setOrgForm({...orgForm, phone: e.target.value})}
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <Label htmlFor="org-address">Address</Label>
              <Input
                id="org-address"
                value={orgForm.address}
                onChange={(e) => setOrgForm({...orgForm, address: e.target.value})}
                placeholder="Enter address"
              />
            </div>
            <Button onClick={createOrganization} className="w-full">
              Create Organization
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manager Dialog */}
      <Dialog open={showManagerDialog} onOpenChange={setShowManagerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Manager</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="manager-org">Organization *</Label>
              <select
                id="manager-org"
                className="w-full p-2 border border-border rounded-md bg-background"
                value={managerForm.organization_id}
                onChange={(e) => setManagerForm({...managerForm, organization_id: e.target.value})}
              >
                <option value="">Select Organization</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="manager-name">Manager Name *</Label>
              <Input
                id="manager-name"
                value={managerForm.name}
                onChange={(e) => setManagerForm({...managerForm, name: e.target.value})}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <Label htmlFor="manager-email">Email *</Label>
              <Input
                id="manager-email"
                type="email"
                value={managerForm.email}
                onChange={(e) => setManagerForm({...managerForm, email: e.target.value})}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="manager-password">Password *</Label>
              <Input
                id="manager-password"
                type="password"
                value={managerForm.password}
                onChange={(e) => setManagerForm({...managerForm, password: e.target.value})}
                placeholder="Enter password"
              />
            </div>
            <Button 
              onClick={createManager} 
              className="w-full"
              disabled={creatingManager}
            >
              {creatingManager ? 'Creating Manager...' : 'Create Manager'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}