import { Step } from 'react-joyride';

export const dashboardSteps: Step[] = [
  {
    target: 'body',
    content: '👋 Hey there! Welcome to your Manager Dashboard. Let\'s take a quick tour so you can feel right at home.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#recent-activity-card',
    content: '🔔 This shows all recent workers who are auto clocked-out',
    placement: 'top',
  },
  {
    target: '#active-workers-card',
    content: '👥 Here you can see all of your team workers who are currently active',
    placement: 'bottom',
  },
  {
    target: '#clocked-in-card',
    content: '👷 Here you can see all of your team workers who are currently on-site',
    placement: 'bottom',
  },
  {
    target: '#quick-nav-workers',
    content: '👷 Need to add or check a worker? Tap here to go to Workers.',
    placement: 'bottom',
  },
  {
    target: '#quick-nav-amendments',
    content: '🕒 If someone requested a time change, you\'ll review it here.',
    placement: 'bottom',
  },
  {
    target: '#quick-nav-reports',
    content: '📈 Want to see who worked where and when? Reports are right here.',
    placement: 'bottom',
  },
];
