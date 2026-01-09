import { Step } from 'react-joyride';

export const timeAmendmentsSteps: Step[] = [
  {
    target: 'body',
    content: '⏰ Welcome to Additions! This is where workers request changes to their clock entries, and you review them.',
    placement: 'center',
  },
  {
    target: '.amendments-table',
    content: '📋 This table displays all time addition requests from your workers with their details.',
    placement: 'top',
  },
  {
    target: '.review-amendment-button',
    content: '👀 Click "Review" to see the full details of a time addition request.',
    placement: 'left',
  },
  {
    target: 'body',
    content: '✅❌ Approve or Reject the request. You can add your reasons why you approved it or rejected it - this helps workers understand your decision!',
    placement: 'center',
  },
  {
    target: '#overtime-tab',
    content: '⏰ Next, let\'s check out the Overtime Requests tab! Click it to continue.',
    placement: 'bottom',
  },
];
