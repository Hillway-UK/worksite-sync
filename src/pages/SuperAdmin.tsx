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

export default function SuperAdmin() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
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
    const { data, error } = await supabase
      .from('organizations')
      .select(`
        *,
        managers:managers(count)
      `)
      .order('name');
    
    if (error) {
      toast.error('Failed to load organizations');
      return;
    }
    
    setOrganizations(data || []);
  };

  const fetchManagers = async () => {
    const { data, error } = await supabase
      .from('managers')
      .select(`
        *,
        organizations:organization_id(name)
      `)
      .order('name');
    
    if (error) {
      toast.error('Failed to load managers');
      return;
    }
    
    setManagers(data || []);
  };

  const createOrganization = async () => {
    if (!orgForm.name) {
      toast.error('Organization name is required');
      return;
    }

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: orgForm.name,
        email: orgForm.email,
        phone: orgForm.phone,
        address: orgForm.address,
        subscription_status: 'active'
      })
      .select()
      .single();
    
    if (error) {
      toast.error('Failed to create organization');
      return;
    }
    
    toast.success('Organization created successfully');
    setShowOrgDialog(false);
    setOrgForm({ name: '', email: '', phone: '', address: '' });
    fetchOrganizations();
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
                  <TableCell>{org.managers?.length || 0}</TableCell>
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