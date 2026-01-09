import { Step } from 'react-joyride';

export const addJobSteps: Step[] = [
  {
    target: 'body',
    content: '👋 Let\'s create your first job site! This form has two main sections.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: '.job-details-section',
    content: '📝 Job Site Details: Enter the job code, name, and full address. These details help identify and locate the job site.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '#enable-geofencing-toggle',
    content: '🔒 Enable Geofencing: Toggle this ON to require workers to be at the job site to clock in. Turn it OFF to allow workers to clock in from anywhere within the UK.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '#terms-upload',
    content: '📄 RAMS Upload: Upload Risk Assessments and Method Statements that workers need to review before starting work.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '#waiver-upload',
    content: '📋 Site Instructions Upload: Upload site-specific instructions and safety information for workers.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.job-location-section',
    content: '📍 Location & Geofence: When geofencing is enabled, set the exact location on the map and define the geofence radius. This appears only when geofencing is ON.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.job-geofence-slider',
    content: '🎯 Geofence Radius: This is critical! Workers can only clock in when they\'re within this radius of the job site. Set it based on your site size (50-500 meters) to prevent buddy punching.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '.job-submit-button',
    content: '✅ Once you\'ve filled in all details and set the geofence, click Create to add the job site!',
    placement: 'top',
    disableBeacon: true,
  },
];
