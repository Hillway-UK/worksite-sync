import { Step } from 'react-joyride';

export const amendmentsSteps: Step[] = [
  {
    target: '#amendments-tab',
    content: '📨 Start here — these are the pending time change requests.',
    placement: 'bottom',
  },
  {
    target: '.btn-approve-amendment',
    content: '✅ Approve a request and leave a quick note if you\'d like.',
    placement: 'left',
  },
  {
    target: '.btn-reject-amendment',
    content: '❌ Reject it with a reason so your worker knows why.',
    placement: 'left',
  },
  {
    target: '#status-filter-tabs',
    content: '🎚️ Filter between pending, approved, and rejected requests.',
    placement: 'top',
  },
];
