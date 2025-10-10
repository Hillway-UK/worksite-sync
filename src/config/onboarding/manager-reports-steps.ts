import { Step } from 'react-joyride';

export const reportsSteps: Step[] = [
  {
    target: 'body',
    content: '📊 Welcome to Reports! Generate detailed time and expense reports for your team.',
    placement: 'center',
  },
  {
    target: '#week-selector',
    content: '📅 Select the week you want to generate reports for.',
    placement: 'bottom',
  },
  {
    target: '.generate-report-button',
    content: '🔄 Click "Generate Report" to load worker data for the selected week.',
    placement: 'bottom',
  },
  {
    target: '.download-csv-button',
    content: '💾 Download a CSV file for easy importing into spreadsheets or accounting software.',
    placement: 'bottom',
  },
  {
    target: '.reports-tabs',
    content: '📑 Switch between Weekly Summary (payroll overview) and Detailed Timesheet (daily breakdown with photos).',
    placement: 'bottom',
  },
  {
    target: '#export-xero-btn',
    content: '💼 Export directly to Xero format for seamless accounting integration!',
    placement: 'left',
  },
  {
    target: '#timesheet-table',
    content: '👥 This table shows each worker\'s total hours, hourly rate, additional costs, and amounts for the week.',
    placement: 'top',
  },
  {
    target: '.row-expand-btn',
    content: '🔎 Click to expand and see detailed daily entries with exact clock in/out times.',
    placement: 'left',
  },
  {
    target: 'body',
    content: '📸 In the Detailed Timesheet tab, you can view workers\' actual clock in and clock out photos to verify their attendance!',
    placement: 'center',
  },
];
