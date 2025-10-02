import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Building, Users, Trash, AlertCircle, LogOut, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { TempPasswordModal } from '@/components/TempPasswordModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function SuperAdmin() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showManagerDialog, setShowManagerDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authVerified, setAuthVerified] = useState(false);
  const [creatingManager, setCreatingManager] = useState(false);
  const [selectedManager, setSelectedManager] = useState<{ id: string; name: string; email: string } | null>(null);
  const [tempPasswordModalOpen, setTempPasswordModalOpen] = useState(false);
  
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

  useEffect(() => {
    verifyAuthentication();
  }, [user, userRole]);

  const verifyAuthentication = async () => {
    if (!user) {
      toast.error('Please log in to access this page');
      setLoading(false);
      return;
    }

    // Check if user is in super_admins table
    try {
      const { data: superAdmin, error } = await supabase
        .from('super_admins')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (error) {
        toast.error('Failed to verify admin status');
        setLoading(false);
        return;
      }

      if (!superAdmin) {
        toast.error('Access denied: Super admin privileges required');
        setLoading(false);
        return;
      }

      setAuthVerified(true);
      await initializeData();
    } catch (err: any) {
      toast.error('Authentication verification failed');
      setLoading(false);
    }
  };

  const initializeData = async () => {
    try {
      await Promise.all([fetchOrganizations(), fetchManagers()]);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      // First try simple query without joins
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      
      if (error) {
        toast.error(`Failed to load organizations: ${error.message}`);
        return;
      }
      
      // Get manager count separately for each organization
      const orgsWithManagerCount = await Promise.all(
        (data || []).map(async (org) => {
          try {
            const { count, error: countError } = await supabase
              .from('managers')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id);
            
            return {
              ...org,
              managers: { count: count || 0 }
            };
          } catch (err) {
            return {
              ...org,
              managers: { count: 0 }
            };
          }
        })
      );
      
      setOrganizations(orgsWithManagerCount);
      
    } catch (err: any) {
      toast.error('Failed to load organizations');
    }
  };

  const fetchManagers = async () => {
    try {
      // First get managers
      const { data: managersData, error } = await supabase
        .from('managers')
        .select('*')
        .order('name');
      
      if (error) {
        toast.error(`Failed to load managers: ${error.message}`);
        return;
      }
      
      // Get organization names separately
      const managersWithOrgs = await Promise.all(
        (managersData || []).map(async (manager) => {
          if (!manager.organization_id) {
            return {
              ...manager,
              organizations: null
            };
          }
          
          try {
            const { data: orgData, error: orgError } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', manager.organization_id)
              .maybeSingle();
            
            return {
              ...manager,
              organizations: orgData
            };
          } catch (err) {
            return {
              ...manager,
              organizations: null
            };
          }
        })
      );
      
      setManagers(managersWithOrgs);
      
    } catch (err: any) {
      toast.error('Failed to load managers');
    }
  };

  const createOrganization = async () => {
    try {
      if (!orgForm.name || !orgForm.email) {
        toast.error('Organization name and email are required');
        return;
      }

      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: orgForm.name,
          email: orgForm.email,
          phone: orgForm.phone || null,
          address: orgForm.address || null,
          subscription_status: 'active',
          max_workers: 50,
          max_managers: 5
        })
        .select()
        .single();
      
      if (error) {
        toast.error(`Failed to create organization: ${error.message}`);
        return;
      }
      
      toast.success('Organization created successfully');
      setShowOrgDialog(false);
      setOrgForm({ name: '', email: '', phone: '', address: '' });
      await fetchOrganizations();
    } catch (err: any) {
      toast.error('An unexpected error occurred');
    }
  };

  const createManager = async () => {
    try {
      if (!managerForm.email || !managerForm.name || !managerForm.password || !managerForm.organization_id) {
        toast.error('Please fill in all fields');
        return;
      }

      setCreatingManager(true);

      // Create auth user using regular signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: managerForm.email,
        password: managerForm.password,
        options: {
          emailRedirectTo: "https://autotime.hillwayco.uk/login",
          data: {
            name: managerForm.name,
            role: 'manager'
          }
        }
      });
      
      if (authError) {
        // Check if user already exists
        if (authError.message.includes('already registered')) {
          // User exists, use upsert to handle potential duplicates gracefully
          const { error: managerError } = await supabase
            .from('managers')
            .upsert({
              email: managerForm.email,
              name: managerForm.name,
              organization_id: managerForm.organization_id
            }, {
              onConflict: 'email'
            });
          
          if (managerError) {
            toast.error(`Manager record error: ${managerError.message}`);
          } else {
            toast.success('Manager linked to existing user successfully!');
            setShowManagerDialog(false);
            setManagerForm({ email: '', name: '', password: '', organization_id: '' });
            await fetchManagers();
          }
          setCreatingManager(false);
          return;
        }
        
        toast.error(`Auth error: ${authError.message}`);
        setCreatingManager(false);
        return;
      }
      
      // Create manager record for new user - use upsert to handle edge cases
      const { error: managerError } = await supabase
        .from('managers')
        .upsert({
          email: managerForm.email,
          name: managerForm.name,
          organization_id: managerForm.organization_id
        }, {
          onConflict: 'email'
        });
      
      if (managerError) {
        toast.error(`Failed to create manager record: ${managerError.message}`);
        setCreatingManager(false);
        return;
      }
      
      toast.success('Manager created successfully! They can now log in.');
      setShowManagerDialog(false);
      setManagerForm({ email: '', name: '', password: '', organization_id: '' });
      await fetchManagers();
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to create manager');
    } finally {
      setCreatingManager(false);
    }
  };

  const deleteOrganization = async (id: string) => {
    if (!confirm('Delete this organization and all its data? This action cannot be undone.')) return;
    
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to delete organization');
      return;
    }
    
    toast.success('Organization deleted');
    fetchOrganizations();
  };

  const deleteManager = async (email: string) => {
    if (!confirm('Remove this manager? This action cannot be undone.')) return;
    
    try {
      // Call edge function to delete both database record and auth user
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { email, table: 'managers' }
      });

      if (error) {
        toast.error('Failed to delete manager');
        return;
      }
      
      toast.success('Manager removed');
      fetchManagers();
    } catch (error) {
      console.error('Error deleting manager:', error);
      toast.error('Failed to delete manager');
    }
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
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.map(manager => (
                <TableRow key={manager.email}>
                  <TableCell className="font-medium">{manager.name}</TableCell>
                  <TableCell>{manager.email}</TableCell>
                  <TableCell>{manager.organizations?.name || 'Unassigned'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedManager({
                                  id: manager.id,
                                  name: manager.name,
                                  email: manager.email,
                                });
                                setTempPasswordModalOpen(true);
                              }}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Generate temp password</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteManager(manager.email)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
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

      <TempPasswordModal
        open={tempPasswordModalOpen}
        onOpenChange={setTempPasswordModalOpen}
        manager={selectedManager}
      />
    </div>
  );
}