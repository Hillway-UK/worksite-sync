import { Step } from 'react-joyride';

export const reportsSteps: Step[] = [
  {
    target: '#week-selector',
    content: '📅 Pick the week you\'d like to review or export.',
    placement: 'bottom',
  },
  {
    target: '#timesheet-table',
    content: '📋 See everyone\'s worked hours per job and per day.',
    placement: 'top',
  },
  {
    target: '.row-expand-btn',
    content: '🔎 Click a row to drill down into daily entries.',
    placement: 'left',
  },
  {
    target: '#export-xero-btn',
    content: '💾 All set? Export a Xero-ready CSV in one click.',
    placement: 'left',
  },
];
