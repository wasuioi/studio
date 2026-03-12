import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebaseAdmin';

const PRICES: Record<string, number> = {
  insight: 299,     // $2.99
  connection: 2999, // $29.99
};

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // 1. Verify the caller is authenticated — uid comes from the token, never the body
  let uid: string;
  try {
    const token = await verifyIdToken(request);
    uid = token.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let type: string, targetMatchId: string, targetMatchName: string, receiverId: string;
  try {
    const body = await request.json();
    type = body.type;
    targetMatchId = body.targetMatchId;
    targetMatchName = body.targetMatchName ?? '';
    receiverId = body.receiverId ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!type || !targetMatchId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!(type in PRICES)) {
    return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: PRICES[type],
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type,
        userId: uid,           // verified sender UID from token
        receiverId,            // stored so refund can verify ownership
        targetMatchId,
        targetMatchName,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err: any) {
    console.error('[create-payment-intent]', err?.message);
    return NextResponse.json({ error: 'Payment setup failed' }, { status: 500 });
  }
}
