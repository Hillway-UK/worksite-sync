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
    target: '.job-location-section',
    content: '📍 Location & Geofence: Set the exact location on the map and define the geofence radius.',
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
