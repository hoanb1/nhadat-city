'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function PushNotificationManager() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && 'serviceWorker' in navigator && 'PushManager' in window) {
      registerPush();
    }
  }, [status]);

  const registerPush = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) return;

        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        // Send subscription to server
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...subscription.toJSON(),
            userId: (session?.user as any)?.id || session?.user?.email
          })
        });
      }
    } catch (err) {
      console.error('Push registration failed:', err);
    }
  };

  // Utility to convert Base64 string to Uint8Array
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  return null;
}
