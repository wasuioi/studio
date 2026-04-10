"use client";

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/supabase/client';
import { useSupabaseAuth } from '@/supabase/provider';
import type { Tables } from '@/supabase/types';

type Profile = Tables<'profiles'>;

const PROFILE_CACHE_KEY = (uid: string) => `profile_cache_${uid}`;

/**
 * useAuth — Supabase version. Reads the auth user from SupabaseProvider,
 * fetches the profiles row from Postgres, gates on email verification, and
 * redirects unauthenticated users as before.
 *
 * Return shape matches the old Firebase hook so call sites don't break:
 *   { user, profile, loading }
 */
export function useAuth() {
  const { user, isUserLoading: authLoading } = useSupabaseAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    const publicPaths = ['/', '/auth/login', '/auth/signup'];
    const isPublicPath = publicPaths.includes(pathname ?? '');

    // 1. Unauthenticated
    if (!user) {
      setProfile(null);
      setLoading(false);
      if (!isPublicPath && pathname !== '/auth/verify') {
        router.push('/auth/login');
      }
      return;
    }

    // 2. Email verification gate — Supabase sets email_confirmed_at when
    //    the user clicks the confirmation link.
    const emailVerified = Boolean(user.email_confirmed_at);
    if (!emailVerified) {
      setProfile(null);
      setLoading(false);
      if (!isPublicPath && pathname !== '/auth/verify') {
        router.push('/auth/verify');
      }
      return;
    }

    // 3. Load cached profile instantly (except on /profile where we want fresh data)
    const isProfilePage = pathname === '/profile';
    if (!isProfilePage) {
      try {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY(user.id));
        if (cached) {
          setProfile(JSON.parse(cached) as Profile);
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

    // 4. Fetch fresh profile from Postgres
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
          setProfile(data);
          try {
            localStorage.setItem(PROFILE_CACHE_KEY(user.id), JSON.stringify(data));
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
