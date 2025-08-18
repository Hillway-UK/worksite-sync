import { supabase } from '@/integrations/supabase/client';

export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  static async subscribeToPushNotifications(workerId: string): Promise<PushSubscription | null> {
    try {
      // Register service worker if not already registered
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      
      let subscription = existingSubscription;
      
      if (!subscription) {
        // Subscribe to push notifications
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(
            'BEl62iUYgUivxIkv69yViEuiBIa40HI80NqIJQ4TcSPGpKrKQtxW5J5Mc9Ej3MXNHxJF8tZiCZGwNgbHqcGzJ2A' // Replace with your VAPID public key
          )
        });
      }

      // Save subscription to database
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          worker_id: workerId,
          push_token: JSON.stringify(subscription)
        }, {
          onConflict: 'worker_id'
        });

      if (error) throw error;
      
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  static showLocalNotification(title: string, body: string, icon?: string): void {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: icon || '/lovable-uploads/81534cbc-ebc0-4c27-9d16-6c2069e07bf2.png',
        badge: '/lovable-uploads/81534cbc-ebc0-4c27-9d16-6c2069e07bf2.png',
        tag: 'pioneer-timesheets',
        requireInteraction: true
      });
      
      // Add vibration through navigator if available
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }
  }

  static async updateNotificationPreferences(workerId: string, preferences: {
    morning_reminder?: boolean;
    evening_reminder?: boolean;
    reminder_time_morning?: string;
    reminder_time_evening?: string;
    enabled_days?: number[];
  }) {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        worker_id: workerId,
        ...preferences
      }, {
        onConflict: 'worker_id'
      });

    if (error) throw error;
  }

  private static urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}