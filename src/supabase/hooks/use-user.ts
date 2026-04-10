'use client';

import { useSupabaseAuth } from '@/supabase/provider';

/**
 * Returns the current authenticated Supabase user + loading state.
 * Drop-in replacement for the Firebase useUser() hook.
 *
 * Usage:
 *   const { user, isUserLoading } = useUser();
 */
export function useUser() {
  const { user, isUserLoading, userError } = useSupabaseAuth();
  return { user, isUserLoading, userError };
}
