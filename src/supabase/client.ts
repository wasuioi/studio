'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Uses @supabase/ssr so sessions are stored in
 * cookies and shared with server code.
 *
 * Note: The Database generic is intentionally omitted. Supabase v2.103 has
 * strict Database type inference that produces `never`-typed Insert/Update
 * shapes when the hand-written schema doesn't match every internal
 * detail. After regenerating types with `supabase gen types` against the
 * live project, you can add `<Database>` back for full type safety.
 *
 * IMPORTANT: singleton per browser session — import `supabase` from here,
 * do not call createBrowserClient() from components.
 */
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
