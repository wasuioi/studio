'use client';

/**
 * Placeholder error listener, slot-in replacement for FirebaseErrorListener.
 * Supabase errors are returned directly from .from(...).select(...) calls
 * so most errors are handled at the call site via toasts. This component
 * exists as a mount point in case we add a global event bus later.
 */
export function SupabaseErrorListener() {
  return null;
}
