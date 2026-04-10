import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Redis-backed rate limiter: max 3 emails per IP per 10 minutes
// Works correctly across all serverless instances and survives restarts
let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null; // fallback: skip rate limiting if Redis not configured
  }
  ratelimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(3, '10 m'), // 3 requests per 10 minutes
    prefix: 'truevibe:send-verification',
  });
  return ratelimit;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // Rate limit by IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const limiter = getRatelimit();
  if (limiter) {
    const { success, reset } = await limiter.limit(ip);
    if (!success) {
      const retryAfterSec = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Too many requests. Please wait before requesting another verification email.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      );
    }
  }

  let email: string, code: string, displayName: string;
  try {
    const body = await request.json();
    email = body.email;
    code = body.code;
    displayName = body.displayName ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Validate inputs
  if (!email || !code) {
    return NextResponse.json({ error: 'Missing email or code' }, { status: 400 });
  }

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  if (typeof code !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
  }

  // Sanitize displayName — strip tags, truncate
  const safeName = String(displayName)
    .replace(/[<>"'&]/g, '')
    .slice(0, 50) || 'there';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
  // Only allow the code — never the raw URL from the body
  const verificationUrl = `${appUrl}/auth/verify?code=${encodeURIComponent(code)}`;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: 'TrueVibe <noreply@truevibe.ai>',
      to: [email],
      subject: 'Verify your email to activate your TrueVibe account',
      html: `
        <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #f0f0f0; rounded-radius: 24px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #9066CC; font-size: 32px; font-weight: 900; margin: 0;">TrueVibe</h1>
            <p style="color: #666; font-size: 16px; margin-top: 8px;">Real Vibes Only</p>
          </div>

          <h2 style="color: #1a1a1a; font-size: 24px; font-weight: 700; margin-bottom: 16px;">Hello ${safeName},</h2>

          <p style="color: #444; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Welcome to TrueVibe! We're excited to have you join our community of authentic connections.
            To get started and unlock matching features, please verify your email address.
          </p>

          <div style="text-align: center; margin: 40px 0;">
            <a href="${verificationUrl}" style="background: linear-gradient(135deg, #939AEB 0%, #9066CC 100%); color: white; padding: 18px 36px; border-radius: 16px; text-decoration: none; font-weight: 700; font-size: 18px; display: inline-block; box-shadow: 0 10px 20px rgba(144, 102, 204, 0.2);">
              Verify Email Address
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 32px; line-height: 1.6;">
            Your verification code is: <strong>${code}</strong>
          </p>

          <p style="color: #888; font-size: 14px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 24px;">
            If you did not create an account on TrueVibe, you can safely ignore this email.
          </p>

          <div style="margin-top: 24px; text-align: center;">
            <p style="color: #aaa; font-size: 12px;">
              © ${new Date().getFullYear()} TrueVibe Team. All rights reserved.<br/>
              Building authentic connections with AI.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[send-verification]', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[send-verification]', err?.message);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
