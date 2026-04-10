'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/supabase/client';
import { SupabaseErrorListener } from '@/supabase/error-listener';

/**
 * React context that exposes the current authenticated Supabase user and
 * a loading flag. Mirrors the shape of the old FirebaseProvider so feature
 * pages can migrate with minimal changes.
 */

interface SupabaseAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

const SupabaseContext = createContext<SupabaseAuthState | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SupabaseAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });

  useEffect(() => {
    let mounted = true;

    // 1. Initial session fetch
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setState({
        user: data.session?.user ?? null,
        isUserLoading: false,
        userError: error ? new Error(error.message) : null,
      });
    });

    // 2. Subscribe to subsequent auth changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({
        user: session?.user ?? null,
        isUserLoading: false,
        userError: null,
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SupabaseContext.Provider value={state}>
      <SupabaseErrorListener />
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabaseAuth(): SupabaseAuthState {
  const ctx = useContext(SupabaseContext);
  if (ctx === undefined) {
    throw new Error('useSupabaseAuth must be used within SupabaseProvider');
  }
  return ctx;
}

// Back-compat alias: old code imported { useUser } from '@/firebase'.
// Feature pages now import from '@/supabase/hooks/use-user' but we also
// export it here for convenience.
export function useUser() {
  const { user, isUserLoading, userError } = useSupabaseAuth();
  return { user, isUserLoading, userError };
}
