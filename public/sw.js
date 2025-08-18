// Service Worker for Push Notifications
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/lovable-uploads/81534cbc-ebc0-4c27-9d16-6c2069e07bf2.png',
      badge: '/lovable-uploads/81534cbc-ebc0-4c27-9d16-6c2069e07bf2.png',
      vibrate: [200, 100, 200],
      tag: 'pioneer-timesheets',
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Timesheets'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/timesheets')
    );
  }
});

self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});