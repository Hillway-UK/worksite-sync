import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface ExpenseType {
  id: string;
  name: string;
  amount: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
}

interface ExpenseTypeForm {
  name: string;
  amount: string;
  description: string;
  is_active: boolean;
}

export function ExpenseTypesManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExpenseType | null>(null);
  const [formData, setFormData] = useState<ExpenseTypeForm>({
    name: '',
    amount: '',
    description: '',
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: expenseTypes = [], isLoading } = useQuery({
    queryKey: ['expense-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_types')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ExpenseType[];
    }
  });

  const { data: currentManager } = useQuery({
    queryKey: ['current-manager'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No user found');

      const { data, error } = await supabase
        .from('managers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<ExpenseType, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('expense_types')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type created successfully"
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create expense type",
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ExpenseType> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('expense_types')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type updated successfully"
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update expense type",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expense_types')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type deactivated successfully"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate expense type",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      amount: '',
      description: '',
      is_active: true
    });
    setEditingType(null);
    setDialogOpen(false);
  };

  const handleEdit = (expenseType: ExpenseType) => {
    setEditingType(expenseType);
    setFormData({
      name: expenseType.name,
      amount: expenseType.amount.toString(),
      description: expenseType.description || '',
      is_active: expenseType.is_active
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.amount.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and amount are required",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Amount must be a positive number",
        variant: "destructive"
      });
      return;
    }

    if (!currentManager?.id) {
      toast({
        title: "Error",
        description: "Manager information not found",
        variant: "destructive"
      });
      return;
    }

    const expenseTypeData = {
      name: formData.name.trim(),
      amount,
      description: formData.description.trim() || null,
      is_active: formData.is_active,
      created_by: currentManager.id
    };

    if (editingType) {
      updateMutation.mutate({ id: editingType.id, ...expenseTypeData });
    } else {
      createMutation.mutate(expenseTypeData);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expense Types</CardTitle>
          <CardDescription>Loading expense types...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Expense Types
            </CardTitle>
            <CardDescription>
              Manage predefined expense categories and amounts for workers
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingType(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingType ? 'Edit Expense Type' : 'Create Expense Type'}
                </DialogTitle>
                <DialogDescription>
                  {editingType ? 'Update the expense type details' : 'Add a new predefined expense type for workers to use'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Lunch Allowance, Travel Expenses"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (£) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="15.00"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Additional details about this expense type..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {expenseTypes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No expense types found</p>
            <p className="text-sm">Create your first expense type to get started</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseTypes.map((expenseType) => (
                  <TableRow key={expenseType.id}>
                    <TableCell className="font-medium">{expenseType.name}</TableCell>
                    <TableCell>£{expenseType.amount.toFixed(2)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {expenseType.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expenseType.is_active ? "default" : "secondary"}>
                        {expenseType.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(expenseType.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(expenseType)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {expenseType.is_active && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate Expense Type</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to deactivate "{expenseType.name}"? 
                                  This will hide it from workers but preserve existing expense records.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(expenseType.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Deactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}