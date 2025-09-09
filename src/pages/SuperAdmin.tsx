import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Building, Users, Trash, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface OrganizationWithCount {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  manager_count?: number;
  [key: string]: any;
}

interface ManagerWithOrg {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  organization_name?: string;
  [key: string]: any;
}

export default function SuperAdmin() {
  const [organizations, setOrganizations] = useState<OrganizationWithCount[]>([]);
  const [managers, setManagers] = useState<ManagerWithOrg[]>([]);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [showManagerDialog, setShowManagerDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  
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
    fetchOrganizations();
    fetchManagers();
  }, []);

  const fetchOrganizations = async () => {
    try {
      console.log('Fetching organizations as super admin...');
      
      // First verify authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        toast.error('Authentication required');
        return;
      }
      
      console.log('Authenticated user email:', user.email);
      
      // Verify super admin status
      const { data: superAdminCheck, error: superAdminError } = await supabase
        .from('super_admins')
        .select('email')
        .eq('email', user.email)
        .single();
        
      if (superAdminError || !superAdminCheck) {
        console.error('Super admin verification failed:', superAdminError);
        toast.error('Super admin access required');
        return;
      }
      
      console.log('Super admin verified, fetching organizations...');
      
      // Fetch organizations with simple query first
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching organizations:', error);
        toast.error(`Failed to load organizations: ${error.message}`);
        return;
      }
      
      console.log('Organizations fetched successfully:', data?.length || 0, 'organizations');
      setOrganizations(data || []);
      
      // Fetch manager counts separately to avoid join issues
      if (data && data.length > 0) {
        const orgsWithCounts = await Promise.all(
          data.map(async (org) => {
            const { count, error: countError } = await supabase
              .from('managers')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', org.id);
              
            return {
              ...org,
              manager_count: countError ? 0 : (count || 0)
            } as OrganizationWithCount;
          })
        );
        setOrganizations(orgsWithCounts);
      } else {
        setOrganizations(data.map(org => ({ ...org, manager_count: 0 })) || []);
      }
      
    } catch (err: any) {
      console.error('Unexpected error fetching organizations:', err);
      toast.error('Failed to load organizations - check console for details');
    }
  };

  const fetchManagers = async () => {
    try {
      console.log('Fetching managers...');
      
      // First get managers
      const { data: managersData, error: managersError } = await supabase
        .from('managers')
        .select('*')
        .order('name');
      
      if (managersError) {
        console.error('Error fetching managers:', managersError);
        toast.error(`Failed to load managers: ${managersError.message}`);
        return;
      }
      
      console.log('Managers fetched:', managersData?.length || 0, 'managers');
      
      // Then get organizations for each manager
      if (managersData && managersData.length > 0) {
        const enrichedManagers = await Promise.all(
          managersData.map(async (manager): Promise<ManagerWithOrg> => {
            if (manager.organization_id) {
              const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', manager.organization_id)
                .single();
                
              return {
                ...manager,
                organization_name: (!orgError && orgData) ? orgData.name : 'Unknown'
              };
            }
            return { ...manager, organization_name: 'Unassigned' };
          })
        );
        
        setManagers(enrichedManagers);
      } else {
        setManagers([]);
      }
      
    } catch (err: any) {
      console.error('Unexpected error fetching managers:', err);
      toast.error('Failed to load managers - check console for details');
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

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Super Admin Dashboard</h1>
      
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
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>{org.email || 'Not set'}</TableCell>
                  <TableCell>{org.phone || 'Not set'}</TableCell>
                  <TableCell>{org.manager_count || 0}</TableCell>
                  <TableCell>
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
                  <TableCell>{manager.organization_name || 'Unassigned'}</TableCell>
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