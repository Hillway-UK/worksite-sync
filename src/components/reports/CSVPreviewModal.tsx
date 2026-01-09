import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, X, Save, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ReportLineItem, EntryType, calculateTotal } from "@/lib/report-utils";
import { supabase } from "@/integrations/supabase/client";

interface CSVPreviewModalProps {
  open: boolean;
  onClose: () => void;
  lineItems: ReportLineItem[];
  loading: boolean;
  saving: boolean;
  onUpdate: (
    itemId: string,
    updates: Partial<Pick<ReportLineItem, "entry_type" | "expense_type" | "quantity" | "unit_amount" | "project_id" | "project_name" | "account_code" | "tax_type">>
  ) => Promise<void>;
  onExport: () => void;
  onExportComplete?: () => void;
  exportType: "csv" | "xero";
  weekStart: string;
}

interface Job {
  id: string;
  name: string;
}

export function CSVPreviewModal({
  open,
  onClose,
  lineItems,
  loading,
  saving,
  onUpdate,
  onExport,
  onExportComplete,
  exportType,
  weekStart,
}: CSVPreviewModalProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<{ id: string; name: string; amount: number }[]>([]);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [expenseTypeOpen, setExpenseTypeOpen] = useState(false);
  const [expenseSearchTerm, setExpenseSearchTerm] = useState("");

  // Fetch jobs and expense types for dropdowns
  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setJobs(data || []);
    };
    const fetchExpenseTypes = async () => {
      const { data } = await supabase
        .from("expense_types")
        .select("id, name, amount")
        .eq("is_active", true)
        .order("name");
      setExpenseTypes(data || []);
    };
    if (open) {
      fetchJobs();
      fetchExpenseTypes();
    }
  }, [open]);

  // Calculate totals
  const totals = {
    workTotal: lineItems
      .filter((i) => i.entry_type === "work")
      .reduce((sum, i) => sum + i.quantity * i.unit_amount, 0),
    overtimeTotal: lineItems
      .filter((i) => i.entry_type === "overtime")
      .reduce((sum, i) => sum + i.quantity * i.unit_amount, 0),
    expenseTotal: lineItems
      .filter((i) => i.entry_type === "expense")
      .reduce((sum, i) => sum + i.quantity * i.unit_amount, 0),
    grandTotal: lineItems.reduce((sum, i) => sum + i.quantity * i.unit_amount, 0),
  };

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
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });
    }

    setEditingRow(null);
    setEditValues({});
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingRow(null);
    setEditValues({});
  };

  // Handle export click
  const handleExport = () => {
    onExport();
    onExportComplete?.();
    onClose();
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {exportType === "xero" ? "Review & Edit Xero Export" : "Review & Edit CSV Export"}
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          </DialogTitle>
        </DialogHeader>

        {/* Totals Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Work</div>
              <div className="text-lg font-bold">£{totals.workTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Overtime</div>
              <div className="text-lg font-bold">£{totals.overtimeTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Expenses</div>
              <div className="text-lg font-bold">£{totals.expenseTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Grand Total</div>
              <div className="text-xl font-bold text-primary">£{totals.grandTotal.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Scrollable Table */}
        <ScrollArea className="h-[400px] border rounded-lg">
          <div className="overflow-x-auto min-w-full">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lineItems.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No line items found for the selected week.
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[130px]">Worker</TableHead>
                  <TableHead className="w-[90px]">Date</TableHead>
                  <TableHead className="w-[90px]">Type</TableHead>
                  <TableHead className="w-[100px]">Expense</TableHead>
                  <TableHead className="w-[80px]">Qty</TableHead>
                  <TableHead className="w-[90px]">Rate</TableHead>
                  <TableHead className="w-[120px]">Project</TableHead>
                  <TableHead className="w-[70px]">Acct</TableHead>
                  <TableHead className="w-[90px]">Tax</TableHead>
                  <TableHead className="w-[80px]">Total</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => {
                  const isEditing = editingRow === item.id;
                  const total = isEditing 
                    ? calculateTotal(parseFloat(editValues.quantity) || 0, parseFloat(editValues.unit_amount) || 0)
                    : calculateTotal(item.quantity, item.unit_amount);

                  return (
                    <TableRow key={item.id} className={pendingChanges.has(item.id) ? "bg-primary/5" : ""}>
                      {/* Worker */}
                      <TableCell className="font-medium text-sm">{item.worker_name}</TableCell>

                      {/* Date */}
                      <TableCell className="text-sm">
                        {format(new Date(item.work_date), "dd/MM")}
                      </TableCell>

                      {/* Entry Type */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editValues.entry_type}
                            onValueChange={(value) =>
                              setEditValues((prev) => ({ ...prev, entry_type: value }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
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

                      {/* Expense Type */}
                      <TableCell>
                        {isEditing && editValues.entry_type === "expense" ? (
                          <Popover 
                            open={expenseTypeOpen} 
                            onOpenChange={(open) => {
                              setExpenseTypeOpen(open);
                              if (open) setExpenseSearchTerm("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <div className="relative">
                                <Input
                                  value={editValues.expense_type}
                                  onChange={(e) =>
                                    setEditValues((prev) => ({ ...prev, expense_type: e.target.value }))
                                  }
                                  onFocus={() => setExpenseTypeOpen(true)}
                                  placeholder="Type or select..."
                                  className="h-8 text-xs pr-6"
                                />
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-[180px] p-0 z-50" align="start">
                              <Command>
                                <div className="px-2 py-1.5 border-b">
                                  <Input
                                    value={expenseSearchTerm}
                                    onChange={(e) => setExpenseSearchTerm(e.target.value)}
                                    placeholder="Search..."
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <CommandList>
                                  <CommandGroup>
                                    {expenseTypes
                                      .filter((et) =>
                                        et.name.toLowerCase().includes(expenseSearchTerm.toLowerCase())
                                      )
                                      .map((et) => (
                                        <CommandItem
                                          key={et.id}
                                          onSelect={() => {
                                            setEditValues((prev) => ({ 
                                              ...prev, 
                                              expense_type: et.name,
                                              unit_amount: et.amount 
                                            }));
                                            setExpenseTypeOpen(false);
                                            setExpenseSearchTerm("");
                                          }}
                                          className="text-xs cursor-pointer"
                                        >
                                          {et.name}
                                        </CommandItem>
                                      ))}
                                    {expenseTypes.filter((et) =>
                                      et.name.toLowerCase().includes(expenseSearchTerm.toLowerCase())
                                    ).length === 0 && (
                                      <div className="py-2 px-3 text-xs text-muted-foreground">
                                        No matching types
                                      </div>
                                    )}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : item.entry_type === "expense" ? (
                          <span className="text-sm">{item.expense_type || "-"}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* Quantity */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.quantity}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, quantity: e.target.value }))
                            }
                            className="h-8 w-16 text-xs"
                          />
                        ) : (
                          <span className="text-sm">{item.quantity.toFixed(2)}</span>
                        )}
                      </TableCell>

                      {/* Unit Amount */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.unit_amount}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, unit_amount: e.target.value }))
                            }
                            className="h-8 w-20 text-xs"
                          />
                        ) : (
                          <span className="text-sm">£{item.unit_amount.toFixed(2)}</span>
                        )}
                      </TableCell>

                      {/* Project */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editValues.project_id || ""}
                            onValueChange={(value) =>
                              setEditValues((prev) => ({ ...prev, project_id: value }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select" />
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
                          <span className="text-sm">{item.project_name || "-"}</span>
                        )}
                      </TableCell>

                      {/* Account Code */}
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editValues.account_code}
                            onChange={(e) =>
                              setEditValues((prev) => ({ ...prev, account_code: e.target.value }))
                            }
                            className="h-8 w-16 text-xs"
                          />
                        ) : (
                          <span className="text-sm">{item.account_code}</span>
                        )}
                      </TableCell>

                      {/* Tax Type */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editValues.tax_type}
                            onValueChange={(value) =>
                              setEditValues((prev) => ({ ...prev, tax_type: value }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="20% (VAT on Income)">20% VAT</SelectItem>
                              <SelectItem value="No VAT">No VAT</SelectItem>
                              <SelectItem value="Exempt">Exempt</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs">{item.tax_type}</span>
                        )}
                      </TableCell>

                      {/* Total */}
                      <TableCell className="font-semibold text-sm">
                        £{total.toFixed(2)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => saveEdits(item.id)}
                              disabled={saving}
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={cancelEditing}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => startEditing(item)}
                          >
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading || lineItems.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {exportType === "xero" ? "Export to Xero" : "Download CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

