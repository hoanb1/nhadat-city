import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/pg';

export async function POST(req: Request) {
  try {
    const subscription = await req.json();

    // In production, you would attach this subscription to the logged-in user.
    // For now, we'll store it in a generic subscriptions table.
    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ success: false, message: 'Invalid subscription' }, { status: 400 });
    }
    const exp = subscription.expirationTime ? new Date(subscription.expirationTime) : null;

    await sql`
      INSERT INTO push_subscriptions (endpoint, keys, expiration_time, user_mongo_id)
      VALUES (${subscription.endpoint}, ${sql.json(subscription.keys)}, ${exp}, ${subscription.userId ?? null})
      ON CONFLICT (endpoint) DO UPDATE SET keys = EXCLUDED.keys, expiration_time = EXCLUDED.expiration_time,
        user_mongo_id = COALESCE(EXCLUDED.user_mongo_id, push_subscriptions.user_mongo_id)`;

    return NextResponse.json({ success: true, message: 'Subscribed to push notifications' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
