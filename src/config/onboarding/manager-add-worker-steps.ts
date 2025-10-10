import { Step } from 'react-joyride';

export const addWorkerSteps: Step[] = [
  {
    target: 'body',
    content: '👋 Let\'s set up your first worker! This form has two key sections.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '.worker-details-section',
    content: '📝 Worker Details: Enter basic information like name, email, phone, and hourly rate. Email is required for the worker to log in to the mobile app.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.worker-schedule-section',
    content: '📅 Worker Schedule: Set the worker\'s typical shift times and working days. This helps with notifications and automatic clock-out.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.worker-submit-button',
    content: '✅ Once you fill in the details, click Create to add the worker. They\'ll receive login credentials for the mobile app!',
    placement: 'top',
    disableBeacon: true,
  },
];
