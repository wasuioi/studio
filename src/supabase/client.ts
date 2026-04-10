'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

/**
 * Browser Supabase client. Uses @supabase/ssr so sessions are stored in
 * cookies and shared with server code (unlike the default localStorage
 * behavior of @supabase/supabase-js).
 *
 * IMPORTANT: this is a singleton per browser session — do not call
 * createBrowserClient() from components; import `supabase` instead.
 */
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
