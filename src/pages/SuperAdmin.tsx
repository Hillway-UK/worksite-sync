import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Building, Users, Trash, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export default function SuperAdmin() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showManagerDialog, setShowManagerDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authVerified, setAuthVerified] = useState(false);
  
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
    console.log('Verifying authentication...');
    console.log('User:', user?.email);
    console.log('User role:', userRole);
    
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
        console.error('Error checking super admin status:', error);
        toast.error('Failed to verify admin status');
        setLoading(false);
        return;
      }

      if (!superAdmin) {
        console.log('User not found in super_admins table');
        toast.error('Access denied: Super admin privileges required');
        setLoading(false);
        return;
      }

      console.log('Super admin verified:', superAdmin);
      setAuthVerified(true);
      await initializeData();
    } catch (err: any) {
      console.error('Authentication verification error:', err);
      toast.error('Authentication verification failed');
      setLoading(false);
    }
  };

  const initializeData = async () => {
    try {
      await Promise.all([fetchOrganizations(), fetchManagers()]);
      setLoading(false);
    } catch (err) {
      console.error('Failed to initialize data:', err);
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      console.log('Fetching organizations...');
      
      // First try simple query without joins
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching organizations:', error);
        toast.error(`Failed to load organizations: ${error.message}`);
        return;
      }
      
      console.log('Organizations fetched successfully:', data);
      
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
            console.error('Error counting managers for org:', org.id, err);
            return {
              ...org,
              managers: { count: 0 }
            };
          }
        })
      );
      
      setOrganizations(orgsWithManagerCount);
      
    } catch (err: any) {
      console.error('Unexpected error fetching organizations:', err);
      toast.error('Failed to load organizations');
    }
  };

  const fetchManagers = async () => {
    try {
      console.log('Fetching managers...');
      
      // First get managers
      const { data: managersData, error } = await supabase
        .from('managers')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching managers:', error);
        toast.error(`Failed to load managers: ${error.message}`);
        return;
      }
      
      console.log('Managers fetched successfully:', managersData);
      
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
            console.error('Error fetching org for manager:', manager.id, err);
            return {
              ...manager,
              organizations: null
            };
          }
        })
      );
      
      setManagers(managersWithOrgs);
      
    } catch (err: any) {
      console.error('Unexpected error fetching managers:', err);
      toast.error('Failed to load managers');
    }
  };

  const createOrganization = async () => {
    try {
      if (!orgForm.name || !orgForm.email) {
        toast.error('Organization name and email are required');
        return;
      }

      console.log('Creating organization:', orgForm);

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
        console.error('Organization creation error:', error);
        toast.error(`Failed to create organization: ${error.message}`);
        return;
      }
      
      console.log('Organization created successfully:', data);
      toast.success('Organization created successfully');
      setShowOrgDialog(false);
      setOrgForm({ name: '', email: '', phone: '', address: '' });
      await fetchOrganizations();
    } catch (err: any) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    }
  };

  const createManager = async () => {
    if (!managerForm.email || !managerForm.name || !managerForm.password || !managerForm.organization_id) {
      toast.error('All fields are required');
      return;
    }

    try {
      // Create manager record first
      const { error: managerError } = await supabase
        .from('managers')
        .insert({
          email: managerForm.email,
          name: managerForm.name,
          organization_id: managerForm.organization_id
        });
      
      if (managerError) throw managerError;
      
      toast.success('Manager created successfully');
      setShowManagerDialog(false);
      setManagerForm({ email: '', name: '', password: '', organization_id: '' });
      fetchManagers();
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to create manager');
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
    
    const { error } = await supabase
      .from('managers')
      .delete()
      .eq('email', email);
    
    if (error) {
      toast.error('Failed to delete manager');
      return;
    }
    
    toast.success('Manager removed');
    fetchManagers();
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
      <h1 className="text-3xl font-bold mb-6">Super Admin Dashboard</h1>
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
            <Button onClick={createManager} className="w-full">
              Create Manager
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}