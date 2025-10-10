import { Step } from 'react-joyride';

export const workersSteps: Step[] = [
  {
    target: '#btn-add-worker',
    content: '➕ Add a new worker — set their rate, schedule, and start date.',
    placement: 'bottom',
  },
  {
    target: '#worker-search',
    content: '🔍 Quickly find anyone by name or email. Super handy for big teams!',
    placement: 'bottom',
  },
  {
    target: '.worker-toggle-active',
    content: '⚙️ Use this switch to activate or deactivate a worker.',
    placement: 'left',
  },
  {
    target: '.weekly-hours-cell',
    content: '⏱️ Check this week\'s total hours for each worker.',
    placement: 'top',
  },
];
