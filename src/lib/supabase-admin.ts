import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. BYPASSES RLS.
 *
 * NEVER import this from any file under src/app/, src/components/, or
 * src/hooks/ that isn't explicitly a server-only module (Route Handler,
 * Server Action with 'use server', or an AI flow in src/ai/flows/).
 *
 * Use this ONLY for:
 *   - Trusted admin operations (setting verification_status after AI review)
 *   - Genkit flows that need to read/write data across users
 *
 * For anything that should act "as the user," use createSupabaseServerClient
 * from @/supabase/server instead.
 */

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!serviceRoleKey || !url) {
  // At import time in a missing-env setup we throw. Route Handlers that use
  // this client will fail fast rather than leaking a misconfigured instance.
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL must be set for admin client'
  );
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
