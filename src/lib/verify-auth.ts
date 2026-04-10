import { createSupabaseServerClient } from '@/supabase/server';

/**
 * Verify that the request comes from an authenticated user and return
 * their user object. Throws if unauthenticated.
 *
 * Replaces firebaseAdmin.verifyIdToken(request).
 *
 * Use this from Route Handlers when you need to know who is calling.
 * For actions that need to BYPASS RLS, import supabaseAdmin from
 * @/lib/supabase-admin instead (after verifying auth here first).
 */
export async function verifyAuth() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Unauthenticated');
  }
  return user;
}
