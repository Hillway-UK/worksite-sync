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
    content: '✅ Green badge means active, gray means inactive.',
    placement: 'top',
  },
  {
    target: '.worker-edit-button',
    content: '✏️ Click the edit icon to update a worker\'s details like rate or contact info.',
    placement: 'left',
  },
  {
    target: '.worker-actions-menu',
    content: '⋮ Click this menu to access more options for the worker.',
    placement: 'left',
  },
  {
    target: '.worker-toggle-active',
    content: '⚙️ Toggle this switch to activate or deactivate a worker. Inactive workers can\'t clock in.',
    placement: 'left',
  },
  {
    target: '.worker-delete-button',
    content: '🗑️ Use this option to delete a worker if they\'ve left the company.',
    placement: 'left',
  },
  {
    target: '#nav-jobs-button',
    content: '🏗️ Ready to manage job sites? Click here to see the Jobs page and continue the tour!',
    placement: 'bottom',
  },
];
