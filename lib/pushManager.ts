import webpush from 'web-push';
import { sql } from './db/pg';

// Configure Web Push with VAPID keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@nhadat.city',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export const sendPushNotification = async (userId: string | null, payload: any) => {
  if (!userId) return;
  try {
    // Find all subscriptions for this user
    const subscriptions = await sql`
      SELECT endpoint, keys FROM push_subscriptions WHERE user_mongo_id = ${userId}`;
    
    if (subscriptions.length === 0) return;

    const pushPromises = subscriptions.map(sub => 
      webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys } as any, JSON.stringify(payload)).catch(err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log('Subscription has expired or is no longer valid: ', err);
          return sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
        } else {
          console.error('Error sending push notification: ', err);
        }
      })
    );
    await Promise.all(pushPromises);
  } catch (error) {
    console.error('Push notification error:', error);
  }
};
