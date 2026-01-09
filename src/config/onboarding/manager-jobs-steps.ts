import { Step } from 'react-joyride';

export const jobsSteps: Step[] = [
  {
    target: 'body',
    content: '👋 Welcome to Jobs Management! Let\'s see how to manage your construction sites.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '#rams-global-toggle',
    content: '📋 Global RAMS & Site Info Toggle: Control whether RAMS and Site Information documents are visible to workers across all jobs at once.',
    placement: 'bottom',
  },
  {
    target: '.btn-add-job',
    content: '➕ Click here to add a new job site with geofence tracking and upload job documents.',
    placement: 'bottom',
  },
  {
    target: '#job-search',
    content: '🔍 Quickly find job sites by name, code, or address.',
    placement: 'bottom',
  },
  {
    target: '.job-code-cell',
    content: '🏷️ Each job has a unique code for easy reference.',
    placement: 'top',
  },
  {
    target: '.geofence-cell',
    content: '📍 Set how close workers must be to clock in (50-500 meters).',
    placement: 'top',
  },
  {
    target: '.workers-on-site-badge',
    content: '👷 See who\'s currently at this location in real-time.',
    placement: 'top',
  },
  {
    target: '.job-edit-button',
    content: '✏️ Update job details or adjust geofence settings.',
    placement: 'left',
  },
  {
    target: '.job-toggle-button',
    content: '⚙️ Deactivate sites when projects are complete.',
    placement: 'left',
  },
  {
    target: '.job-delete-button',
    content: '🗑️ Remove old job sites permanently when no longer needed.',
    placement: 'left',
  },
  {
    target: '#nav-amendments-button',
    content: '📝 Ready to manage time and expense additions? Click here to review and approve worker submissions!',
    placement: 'bottom',
  },
];
