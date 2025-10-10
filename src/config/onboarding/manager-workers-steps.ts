import { Step } from 'react-joyride';

export const workersSteps: Step[] = [
  {
    target: 'body',
    content: '👋 Welcome to Workers Management! Let\'s see how to manage your team.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#btn-add-worker',
    content: '➕ Click here to add a new worker. You\'ll set their rate, schedule, and start date.',
    placement: 'bottom',
  },
  {
    target: '#worker-search',
    content: '🔍 Quickly find anyone by typing their name or email. Great for large teams!',
    placement: 'bottom',
  },
  {
    target: '.worker-name-cell',
    content: '👤 Each row shows a worker\'s basic information.',
    placement: 'top',
  },
  {
    target: '.weekly-hours-cell',
    content: '⏱️ See each worker\'s total hours for the current week at a glance.',
    placement: 'top',
  },
  {
    target: '.worker-status-badge',
    content: '✅ Active workers can log in to the app. Inactive workers cannot.',
    placement: 'top',
  },
  {
    target: '.worker-edit-button',
    content: '✏️ Click the edit icon to update a worker\'s details, activate/deactivate them, or remove them from the system.',
    placement: 'left',
  },
  {
    target: '#nav-jobs-button',
    content: '🏗️ Ready to manage job sites? Click here to see the Jobs page and continue the tour!',
    placement: 'bottom',
  },
];
