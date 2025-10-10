import { Step } from 'react-joyride';

export const timeAmendmentsSteps: Step[] = [
  {
    target: 'body',
    content: '⏰ Welcome to Time Amendments! This is where workers request changes to their clock entries, and you review them.',
    placement: 'center',
  },
  {
    target: '.amendments-table',
    content: '📋 This table displays all time amendment requests from your workers with their details.',
    placement: 'top',
  },
  {
    target: '.review-amendment-button',
    content: '👀 Click "Review" to see the full details of a time amendment request.',
    placement: 'left',
  },
  {
    target: 'body',
    content: '✅❌ Approve or Reject the request. You can add your reasons why you approved it or rejected it - this helps workers understand your decision!',
    placement: 'center',
  },
  {
    target: '#nav-reports-button',
    content: '📊 Next, click Reports to generate detailed time and expense reports for your team!',
    placement: 'bottom',
  },
];
