"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/supabase/client';
import { useSupabaseAuth } from '@/supabase/provider';
import { rowToUserProfile } from '@/supabase/adapters';
import type { UserProfile } from '@/types';
import type { Tables } from '@/supabase/types';

/**
 * Merged profile type: exposes BOTH the legacy camelCase UserProfile fields
 * (what most components read) AND the raw snake_case columns (what code
 * written during the Supabase migration reads). This avoids a sweeping
 * rename across the entire codebase in a single PR — call sites can migrate
 * to camelCase or snake_case at their own pace.
 */
export type MergedProfile = UserProfile & Tables<'profiles'>;

const PROFILE_CACHE_KEY = (uid: string) => `profile_cache_${uid}`;

/**
 * useAuth — Supabase version. Reads the auth user from SupabaseProvider,
 * fetches the profiles row from Postgres, and returns a merged profile that
 * exposes both the legacy camelCase fields AND the raw snake_case columns.
 *
 * Return shape matches the old Firebase hook so call sites don't break:
 *   { user, profile, loading }
 */
export function useAuth() {
  const { user, isUserLoading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<MergedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    const publicPaths = ['/', '/auth/login', '/auth/signup'];
    const isPublicPath = publicPaths.includes(pathname ?? '');

    if (!user) {
      setProfile(null);
      setLoading(false);
      if (!isPublicPath && pathname !== '/auth/verify') {
        router.push('/auth/login');
      }
      return;
    }

    const emailVerified = Boolean(user.email_confirmed_at);
    if (!emailVerified) {
      setProfile(null);
      setLoading(false);
      if (!isPublicPath && pathname !== '/auth/verify') {
        router.push('/auth/verify');
      }
      return;
    }

    const isProfilePage = pathname === '/profile';
    if (!isProfilePage) {
      try {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY(user.id));
        if (cached) {
          setProfile(JSON.parse(cached) as UserProfile);
          setLoading(false);
        } else {
          setLoading(true);
        }
      } catch {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }

    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[useAuth] failed to load profile', error);
          setLoading(false);
          return;
        }
        if (data) {
          // Merge: camelCase legacy fields + raw snake_case columns
          const merged: MergedProfile = { ...rowToUserProfile(data), ...data };
          setProfile(merged);
          try {
            localStorage.setItem(PROFILE_CACHE_KEY(user.id), JSON.stringify(merged));
          } catch {
            // Ignore localStorage quota / private-mode errors
          }
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, pathname, router]);

  return { user, profile, loading: authLoading || loading };
}
