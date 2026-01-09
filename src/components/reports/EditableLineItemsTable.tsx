import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Save, RefreshCw, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ReportLineItem, EntryType, calculateTotal } from "@/lib/report-utils";
import { supabase } from "@/integrations/supabase/client";

interface EditableLineItemsTableProps {
  lineItems: ReportLineItem[];
  loading: boolean;
  saving: boolean;
  onUpdate: (
    itemId: string,
    updates: Partial<Pick<ReportLineItem, "entry_type" | "expense_type" | "quantity" | "unit_amount" | "project_id" | "project_name" | "account_code" | "tax_type">>
  ) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
  onRegenerate: () => Promise<void>;
  totals: {
    workTotal: number;
    overtimeTotal: number;
    expenseTotal: number;
    grandTotal: number;
  };
}

interface Job {
  id: string;
  name: string;
}

export function EditableLineItemsTable({
  lineItems,
  loading,
  saving,
  onUpdate,
  onDelete,
  onRegenerate,
  totals,
}: EditableLineItemsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>("all");
  const [showExpensesOnly, setShowExpensesOnly] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});

  // Fetch jobs for project dropdown
  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setJobs(data || []);
    };
    fetchJobs();
  }, []);

  // Filter line items
  const filteredItems = lineItems.filter((item) => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      item.worker_name?.toLowerCase().includes(searchLower) ||
      item.project_name?.toLowerCase().includes(searchLower) ||
      item.description_generated?.toLowerCase().includes(searchLower) ||
      item.expense_type?.toLowerCase().includes(searchLower);

    // Type filter
    const matchesType =
      typeFilter === "all" || item.entry_type === typeFilter;

    // Expenses only toggle
    const matchesExpenses = !showExpensesOnly || item.entry_type === "expense";

    return matchesSearch && matchesType && matchesExpenses;
  });

  // Start editing a row
  const startEditing = (item: ReportLineItem) => {
    setEditingRow(item.id);
    setEditValues({
      entry_type: item.entry_type,
      expense_type: item.expense_type || "",
      quantity: item.quantity,
      unit_amount: item.unit_amount,
      project_id: item.project_id || "",
      account_code: item.account_code,
      tax_type: item.tax_type,
    });
  };

  // Save edits
  const saveEdits = async (itemId: string) => {
    const item = lineItems.find((i) => i.id === itemId);
    if (!item) return;

    const updates: any = {};

    if (editValues.entry_type !== item.entry_type) {
      updates.entry_type = editValues.entry_type;
    }
    if (editValues.expense_type !== (item.expense_type || "")) {
      updates.expense_type = editValues.expense_type || null;
    }
    if (parseFloat(editValues.quantity) !== item.quantity) {
      updates.quantity = parseFloat(editValues.quantity);
    }
    if (parseFloat(editValues.unit_amount) !== item.unit_amount) {
      updates.unit_amount = parseFloat(editValues.unit_amount);
    }
    if (editValues.project_id !== (item.project_id || "")) {
      updates.project_id = editValues.project_id || null;
      const job = jobs.find((j) => j.id === editValues.project_id);
      updates.project_name = job?.name || null;
    }
    if (editValues.account_code !== item.account_code) {
      updates.account_code = editValues.account_code;
    }
    if (editValues.tax_type !== item.tax_type) {
      updates.tax_type = editValues.tax_type;
    }

    if (Object.keys(updates).length > 0) {
      await onUpdate(itemId, updates);
    }

    setEditingRow(null);
    setEditValues({});
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingRow(null);
    setEditValues({});
  };

  // Get entry type badge color
  const getEntryTypeBadge = (type: EntryType) => {
    switch (type) {
      case "work":
        return <Badge variant="default">Work</Badge>;
      case "overtime":
        return <Badge variant="secondary">Overtime</Badge>;
      case "expense":
        return <Badge variant="outline">Expense</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search worker, project..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Type Filter */}
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as any)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="work">Work</SelectItem>
              <SelectItem value="overtime">Overtime</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>

          {/* Expenses Only Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="expenses-only"
              checked={showExpensesOnly}
              onCheckedChange={setShowExpensesOnly}
            />
            <Label htmlFor="expenses-only" className="text-sm">
              Show Expenses Only
            </Label>
          </div>
        </div>

        {/* Regenerate Button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate from Timesheet
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate Line Items?</AlertDialogTitle>
              <AlertDialogDescription>
                This will discard all edits and regenerate line items from the
                original timesheet data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onRegenerate}>
                Regenerate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Totals Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Work Total</div>
            <div className="text-xl font-bold">£{totals.workTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Overtime Total</div>
            <div className="text-xl font-bold">£{totals.overtimeTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Expenses Total</div>
            <div className="text-xl font-bold">£{totals.expenseTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Grand Total</div>
            <div className="text-2xl font-bold text-primary">
              £{totals.grandTotal.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Worker</TableHead>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead className="w-[100px]">Entry Type</TableHead>
                <TableHead className="w-[120px]">Expense Type</TableHead>
                <TableHead className="min-w-[200px]">Description</TableHead>
                <TableHead className="w-[100px]">Quantity</TableHead>
                <TableHead className="w-[100px]">Unit Amount</TableHead>
                <TableHead className="w-[150px]">Project</TableHead>
                <TableHead className="w-[80px]">Account</TableHead>
                <TableHead className="w-[100px]">Tax</TableHead>
                <TableHead className="w-[100px]">Total</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8">
                    No line items found
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const isEditing = editingRow === item.id;
                  const total = calculateTotal(item.quantity, item.unit_amount);

                  return (
                    <TableRow key={item.id}>
                      {/* Worker (read-only) */}
                      <TableCell className="font-medium">
                        {item.worker_name}
                      </TableCell>

                      {/* Date (read-only) */}
                      <TableCell>
                        {format(new Date(item.work_date), "dd/MM/yyyy")}
                      </TableCell>

                      {/* Entry Type (editable) */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editValues.entry_type}
                            onValueChange={(value) =>
                              setEditValues((prev) => ({
                                ...prev,
                                entry_type: value,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="work">Work</SelectItem>
                              <SelectItem value="overtime">Overtime</SelectItem>
                              <SelectItem value="expense">Expense</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          getEntryTypeBadge(item.entry_type)
                        )}
                      </TableCell>

                      {/* Expense Type (conditional) */}
                      <TableCell>
                        {isEditing && editValues.entry_type === "expense" ? (
                          <Input
                            value={editValues.expense_type}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                expense_type: e.target.value,
                              }))
                            }
                            placeholder="Expense type"
                            className="w-full"
                          />
                        ) : item.entry_type === "expense" ? (
                          item.expense_type || "-"
                        ) : (
                          "-"
                        )}
                      </TableCell>

                      {/* Description (read-only, auto-generated) */}
                      <TableCell className="text-sm text-muted-foreground">
                        {item.description_generated}
                      </TableCell>

                      {/* Quantity (editable) */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.quantity}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                quantity: e.target.value,
                              }))
                            }
                            className="w-full"
                          />
                        ) : (
                          item.quantity.toFixed(2)
                        )}
                      </TableCell>

                      {/* Unit Amount (editable) */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.unit_amount}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                unit_amount: e.target.value,
                              }))
                            }
                            className="w-full"
                          />
                        ) : (
                          `£${item.unit_amount.toFixed(2)}`
                        )}
                      </TableCell>

                      {/* Project (editable) */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editValues.project_id || ""}
                            onValueChange={(value) =>
                              setEditValues((prev) => ({
                                ...prev,
                                project_id: value,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                              {jobs.map((job) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          item.project_name || "-"
                        )}
                      </TableCell>

                      {/* Account Code (editable) */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editValues.account_code}
                            onChange={(e) =>
                              setEditValues((prev) => ({
                                ...prev,
                                account_code: e.target.value,
                              }))
                            }
                            className="w-full"
                          />
                        ) : (
                          item.account_code
                        )}
                      </TableCell>

                      {/* Tax Type (editable) */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editValues.tax_type}
                            onValueChange={(value) =>
                              setEditValues((prev) => ({
                                ...prev,
                                tax_type: value,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="No VAT">No VAT</SelectItem>
                              <SelectItem value="20% VAT">20% VAT</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          item.tax_type
                        )}
                      </TableCell>

                      {/* Total (auto-calculated) */}
                      <TableCell className="font-semibold">
                        £{total.toFixed(2)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveEdits(item.id)}
                                disabled={saving}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditing}
                              >Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(item)}
                              >
                                Edit
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete Line Item?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove this line item from the
                                      report. The original timesheet entry will
                                      not be affected.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => onDelete(item.id)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Row count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredItems.length} of {lineItems.length} line items
      </div>
    </div>
  );
}







