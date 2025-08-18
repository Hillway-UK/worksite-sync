import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ExpenseTypeDialog } from './ExpenseTypeDialog';
import { Plus, MoreHorizontal, Wallet, Search, Pencil, ToggleLeft, Trash2, DollarSign } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

export function ExpenseTypesManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExpenseType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [presetData, setPresetData] = useState<{ name: string; amount: number; description?: string } | undefined>();
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

  // Filter expense types based on search and status
  const filteredExpenseTypes = expenseTypes?.filter(expenseType => {
    const matchesSearch = expenseType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expenseType.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && expenseType.is_active) ||
                         (statusFilter === 'inactive' && !expenseType.is_active);
    return matchesSearch && matchesStatus;
  }) || [];

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expense_types'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['expense-types'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('expense_types')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Form handlers
  const handleQuickAdd = (preset: { name: string; amount: number; description?: string }) => {
    setPresetData(preset);
    setEditingType(null);
    setDialogOpen(true);
  };

  const handleEdit = (expenseType: ExpenseType) => {
    setEditingType(expenseType);
    setPresetData(undefined);
    setDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <CardTitle>Manage Expense Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex space-x-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-32" />
              ))}
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Manage Expense Types</CardTitle>
          <Button 
            onClick={() => {
              setEditingType(null);
              setPresetData(undefined);
              setDialogOpen(true);
            }}
            className="hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Expense Type
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAdd({ name: 'Lunch', amount: 15, description: 'Daily lunch allowance' })}
            >
              Quick Add: Lunch (£15)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAdd({ name: 'Travel', amount: 25, description: 'Travel expenses' })}
            >
              Quick Add: Travel (£25)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAdd({ name: 'Parking', amount: 10, description: 'Parking fees' })}
            >
              Quick Add: Parking (£10)
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search expense types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('inactive')}
              >
                Inactive
              </Button>
            </div>
          </div>
        </div>

        {filteredExpenseTypes.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenseTypes.map((expenseType) => (
                <TableRow key={expenseType.id}>
                  <TableCell className="font-medium">{expenseType.name}</TableCell>
                  <TableCell>{formatCurrency(expenseType.amount)}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {expenseType.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={expenseType.is_active ? 'default' : 'secondary'}>
                      {expenseType.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleEdit(expenseType)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleStatusMutation.mutate({
                            id: expenseType.id,
                            is_active: !expenseType.is_active
                          })}
                        >
                          <ToggleLeft className="h-4 w-4 mr-2" />
                          {expenseType.is_active ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <Wallet className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No matching expense types' : 'No expense types found'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Create expense types that workers can claim for their work.'
              }
            </p>
            <Button onClick={() => {
              setEditingType(null);
              setPresetData(undefined);
              setDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Expense Type
            </Button>
          </div>
        )}
      </CardContent>

      <ExpenseTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expenseType={editingType}
        presetData={presetData}
        onSuccess={() => {
          setEditingType(null);
          setPresetData(undefined);
        }}
      />
    </Card>
  );
}