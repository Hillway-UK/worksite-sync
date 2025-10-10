import { Step } from 'react-joyride';

export const reportsSteps: Step[] = [
  {
    target: 'body',
    content: '📊 Welcome to Reports! Generate detailed time and expense reports for your team.',
    placement: 'center',
  },
  {
    target: '#week-selector',
    content: '📅 Select the week you want to generate reports for. Click "Generate Report" to load the data.',
    placement: 'bottom',
  },
  {
    target: '.reports-tabs',
    content: '📑 Switch between Weekly Summary (payroll view) and Detailed Timesheet (daily breakdown).',
    placement: 'bottom',
  },
  {
    target: '#export-xero-btn',
    content: '💾 Export your reports to Xero for accounting! You can also download as CSV.',
    placement: 'left',
  },
  {
    target: '#timesheet-table',
    content: '👥 This table shows each worker\'s hours, jobs worked, and total amounts for the selected week.',
    placement: 'top',
  },
  {
    target: '.row-expand-btn',
    content: '🔎 Click the expand icon to drill down into daily entries and see detailed clock times.',
    placement: 'left',
  },
];
