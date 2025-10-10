import { Step } from 'react-joyride';

export const timeAmendmentsSteps: Step[] = [
  {
    target: 'body',
    content: '⏰ Time Amendments tab! Workers can request changes to their clock entries, and you review them here.',
    placement: 'center',
  },
  {
    target: '.amendments-table',
    content: '📋 This table displays all time amendment requests from your workers.',
    placement: 'top',
  },
  {
    target: '.review-amendment-button',
    content: '👀 Click "Review" to see the details of a time amendment request.',
    placement: 'left',
  },
  {
    target: '.btn-approve-amendment',
    content: '✅ Approve the request if it\'s valid. You can add optional notes for the worker.',
    placement: 'left',
  },
  {
    target: '.btn-reject-amendment',
    content: '❌ Reject the request if needed. Always add a reason so the worker understands why.',
    placement: 'left',
  },
];
