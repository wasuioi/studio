import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // 1. Verify the caller is authenticated
  let uid: string;
  try {
    const token = await verifyIdToken(request);
    uid = token.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let paymentIntentId: string;
  try {
    const body = await request.json();
    paymentIntentId = body.paymentIntentId;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    return NextResponse.json({ error: 'Missing paymentIntentId' }, { status: 400 });
  }

  try {
    // 2. Fetch the payment intent and verify the authenticated user is the receiver
    //    (only the receiver triggers a refund when they decline)
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const receiverId = intent.metadata?.receiverId;
    const senderId = intent.metadata?.userId; // userId = sender, stored at creation

    if (receiverId !== uid && senderId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Issue the refund
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    return NextResponse.json({ success: true, refundId: refund.id });
  } catch (err: any) {
    // Return a generic message — do not expose Stripe internals
    console.error('[refund]', err?.message);
    return NextResponse.json({ error: 'Refund failed' }, { status: 500 });
  }
}
