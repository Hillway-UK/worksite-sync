import { format, getWeek, getYear } from "date-fns";

export type EntryType = "work" | "overtime" | "expense";

export interface ReportLineItem {
  id: string;
  organization_id: string;
  week_start: string;
  worker_id: string;
  worker_name?: string;
  worker_email?: string;
  worker_address?: string;
  work_date: string;
  entry_type: EntryType;
  expense_type: string | null;
  quantity: number;
  unit_amount: number;
  project_id: string | null;
  project_name: string | null;
  account_code: string;
  tax_type: string;
  description_generated: string;
  source_clock_entry_id: string | null;
  source_additional_cost_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Generates a description based on entry type, expense type, and date
 * Following the format rules:
 * - Work: "Construction Work - {Date} - Week {WeekNumber} {Year}"
 * - Overtime: "Overtime Work - {Date} - Week {WeekNumber} {Year}"
 * - Expense: "{ExpenseType} - {Date} - Week {WeekNumber} {Year}"
 */
export function generateDescription(
  entryType: EntryType,
  expenseType: string | null,
  date: Date | string
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const weekNumber = getWeek(dateObj, { weekStartsOn: 1 });
  const year = getYear(dateObj);
  const dateFormatted = format(dateObj, "dd/MM/yyyy");

  switch (entryType) {
    case "work":
      return `Construction Work - ${dateFormatted} - Week ${weekNumber} ${year}`;
    case "overtime":
      return `Overtime Work - ${dateFormatted} - Week ${weekNumber} ${year}`;
    case "expense":
      return `${expenseType || "Expense"} - ${dateFormatted} - Week ${weekNumber} ${year}`;
    default:
      return `Unknown Entry - ${dateFormatted}`;
  }
}

/**
 * Calculate total amount from quantity and unit amount
 */
export function calculateTotal(quantity: number, unitAmount: number): number {
  return quantity * unitAmount;
}

/**
 * Get default account code based on entry type
 * - Work (labour): 323
 * - Overtime: 322
 * - Expenses: 322
 */
export function getDefaultAccountCode(entryType: EntryType): string {
  switch (entryType) {
    case "work":
      return "323";
    case "overtime":
      return "322";
    case "expense":
      return "322";
    default:
      return "323";
  }
}

/**
 * Get default tax type
 */
export function getDefaultTaxType(): string {
  return "No VAT";
}

/**
 * Parse address into components for Xero export
 */
export function parseAddress(address: string | null): {
  addressLine1: string;
  city: string;
  region: string;
  postcode: string;
} {
  if (!address) {
    return {
      addressLine1: "",
      city: "",
      region: "",
      postcode: "",
    };
  }

  const parts = address.split(",").map((part) => part.trim());

  // Extract postcode (last part matching UK pattern)
  const postcodeRegex = /^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\s?[0-9][A-Z]{2}$/i;
  const lastPart = parts[parts.length - 1] || "";
  const postcode = postcodeRegex.test(lastPart) ? lastPart : "";

  // Extract city
  let city = "";
  if (postcode && parts.length >= 2) {
    city = parts[parts.length - 2] || "";
  } else if (parts.length >= 2) {
    city = parts[1] || "";
  }

  // Extract address line 1
  const addressLine1 = parts[0] || "";

  // Region could be third part if available
  let region = "";
  if (parts.length >= 3 && postcode) {
    region = parts[parts.length - 3] || "";
  }

  return {
    addressLine1,
    city,
    region,
    postcode,
  };
}

/**
 * Escape CSV field
 */
export function escapeCSV(field: string): string {
  return field.replace(/"/g, '""');
}

/**
 * Group line items by worker for invoice generation
 */
export function groupItemsByWorker(items: ReportLineItem[]): Record<string, ReportLineItem[]> {
  return items.reduce((acc, item) => {
    const key = item.worker_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, ReportLineItem[]>);
}
