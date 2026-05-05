// src/app/api/post-date-nudge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runNudgeSweep } from '@/lib/post-date-nudge';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json(await runNudgeSweep());
}
