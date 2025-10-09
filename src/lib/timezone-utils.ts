import moment from 'moment-timezone';

const UK_TIMEZONE = 'Europe/London';

/**
 * Formats a UTC timestamp to UK time (BST/GMT depending on date)
 * @param utcTimestamp - ISO 8601 timestamp string from database
 * @param format - moment format string (default: 'MMM D, h:mm A')
 * @returns Formatted string in UK time
 */
export function formatUKTime(
  utcTimestamp: string | null | undefined,
  format: string = 'MMM D, h:mm A'
): string {
  if (!utcTimestamp) return '';
  return moment.utc(utcTimestamp).tz(UK_TIMEZONE).format(format);
}

/**
 * Formats a UTC timestamp to UK date only
 */
export function formatUKDate(utcTimestamp: string | null | undefined): string {
  return formatUKTime(utcTimestamp, 'MMM D, YYYY');
}

/**
 * Formats a UTC timestamp to UK time only
 */
export function formatUKTimeOnly(utcTimestamp: string | null | undefined): string {
  return formatUKTime(utcTimestamp, 'h:mm A');
}
