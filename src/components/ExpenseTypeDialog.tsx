import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { z } from 'zod';

interface ExpenseType {
  id: string;
  name: string;
  amount: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

interface ExpenseTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseType?: ExpenseType | null;
  onSuccess?: () => void;
  presetData?: {
    name: string;
    amount: number;
    description?: string;
  };
}

const expenseTypeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  amount: z.number().positive('Amount must be positive').multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  description: z.string().max(200, 'Description must be 200 characters or less').optional(),
  is_active: z.boolean()
});

type ExpenseTypeForm = z.infer<typeof expenseTypeSchema>;

export function ExpenseTypeDialog({ open, onOpenChange, expenseType, onSuccess, presetData }: ExpenseTypeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<ExpenseTypeForm>({
    name: '',
    amount: 0,
    description: '',
    is_active: true
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ExpenseTypeForm, string>>>({});

  // Get current manager ID
  const { data: currentManager } = useQuery({
    queryKey: ['current-manager'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('managers')
        .select('id')
        .eq('email', user.email)
        .single();

      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (presetData) {
      setFormData({
        name: presetData.name,
        amount: presetData.amount,
        description: presetData.description || '',
        is_active: true
      });
    } else if (expenseType) {
      setFormData({
        name: expenseType.name,
        amount: expenseType.amount,
        description: expenseType.description || '',
        is_active: expenseType.is_active
      });
    } else {
      setFormData({
        name: '',
        amount: 0,
        description: '',
        is_active: true
      });
    }
    setErrors({});
  }, [expenseType, presetData, open]);

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseTypeForm) => {
      if (!currentManager) throw new Error('Manager not found');

      // Check for duplicate names
      const { data: existing } = await supabase
        .from('expense_types')
        .select('id')
        .eq('name', data.name)
        .single();

      if (existing) {
        throw new Error('An expense type with this name already exists');
      }

      const { error } = await supabase
        .from('expense_types')
        .insert({
          name: data.name,
          amount: data.amount,
          description: data.description || null,
          is_active: data.is_active,
          created_by: currentManager.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type created successfully",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ExpenseTypeForm) => {
      if (!expenseType) throw new Error('No expense type to update');

      // Check for duplicate names (excluding current record)
      const { data: existing } = await supabase
        .from('expense_types')
        .select('id')
        .eq('name', data.name)
        .neq('id', expenseType.id)
        .single();

      if (existing) {
        throw new Error('An expense type with this name already exists');
      }

      const { error } = await supabase
        .from('expense_types')
        .update({
          name: data.name,
          amount: data.amount,
          description: data.description || null,
          is_active: data.is_active
        })
        .eq('id', expenseType.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type updated successfully",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!expenseType) throw new Error('No expense type to delete');

      // Check if expense type is being used
      const { data: usage } = await supabase
        .from('additional_costs')
        .select('id')
        .eq('expense_type_id', expenseType.id)
        .limit(1);

      if (usage && usage.length > 0) {
        throw new Error('Cannot delete expense type that has been used in expense claims');
      }

      const { error } = await supabase
        .from('expense_types')
        .update({ is_active: false })
        .eq('id', expenseType.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-types'] });
      toast({
        title: "Success",
        description: "Expense type deactivated successfully",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const validateForm = (data: ExpenseTypeForm): boolean => {
    try {
      expenseTypeSchema.parse(data);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof ExpenseTypeForm, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof ExpenseTypeForm] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm(formData)) return;

    if (expenseType) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {expenseType ? 'Edit Expense Type' : 'Create Expense Type'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Type Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Lunch Allowance"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">£</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                className={`pl-8 ${errors.amount ? 'border-destructive' : ''}`}
              />
            </div>
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description of this expense type"
              maxLength={200}
              className={errors.description ? 'border-destructive' : ''}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              {errors.description && (
                <span className="text-destructive">{errors.description}</span>
              )}
              <span className="ml-auto">{formData.description?.length || 0}/200</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="flex justify-between">
            <div>
              {expenseType && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Expense Type</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{expenseType.name}"? This will deactivate the expense type and it cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {expenseType ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}