import { Step } from 'react-joyride';

export const dashboardSteps: Step[] = [
  {
    target: 'body',
    content: '👋 Hey there! Welcome to your Manager Dashboard. Let\'s take a quick tour so you can feel right at home.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#clocked-in-card',
    content: '👷 Here you can see how many workers are currently on-site',
    placement: 'bottom',
  },
  {
    target: '#total-hours-card',
    content: '⏰ Track the total hours logged by your team today',
    placement: 'bottom',
  },
  {
    target: '#pending-amendments-card',
    content: '🕒 See time change requests that need your review',
    placement: 'bottom',
  },
  {
    target: '#active-workers-card',
    content: '👥 View your total active workforce at a glance',
    placement: 'bottom',
  },
  {
    target: '#workers-on-site-section',
    content: '👔 See detailed info about who\'s clocked in right now',
    placement: 'top',
  },
  {
    target: '#recent-activity-card',
    content: '🔔 This shows all recent workers who are auto clocked-out',
    placement: 'top',
  },
  {
    target: '#nav-workers-button',
    content: '👷 Ready to manage your team? Click here to see the Workers page and continue the tour!',
    placement: 'bottom',
  },
];
