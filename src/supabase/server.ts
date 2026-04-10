import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

/**
 * Server Supabase client for use in Route Handlers, Server Components,
 * and Server Actions. Reads the user's session from cookies so RLS runs
 * as THAT user — not as service-role.
 *
 * Use this for any server code that should act on behalf of the logged-in
 * user. For trusted admin operations, import from `@/lib/supabase-admin`.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll was called from a Server Component. This can be ignored
            // if the middleware is refreshing sessions.
          }
        },
      },
    }
  );
}
