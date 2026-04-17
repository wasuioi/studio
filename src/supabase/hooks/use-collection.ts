'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/supabase/client';
import type { Database } from '@/lib/database.types';

type TableName = keyof Database['public']['Tables'];
type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];

interface UseCollectionResult<T> {
  data: T[] | null;
  isLoading: boolean;
  error: Error | null;
  /** Manually re-run the query. Useful after a local mutation. */
  refetch: () => void;
}

interface UseCollectionOptions<T extends TableName> {
  table: T;
  /**
   * Callback that receives a base .select('*') query and returns a filtered
   * version. Must be stable — pass stable deps below.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: (q: any) => any;
  /**
   * Optional realtime filter. When set, the hook subscribes to INSERT/UPDATE/
   * DELETE on rows matching that filter and refetches the full query.
   */
  realtime?: { column: string; value: string };
  /**
   * Stability key. When this changes, the hook refetches.
   */
  deps: ReadonlyArray<unknown>;
}

/**
 * React hook to fetch a list of rows from a table, with optional filtering/
 * ordering and optional realtime updates. Drop-in replacement for Firebase
 * useCollection().
 *
 * Usage:
 *   const { data: posts } = useCollection<'posts'>({
 *     table: 'posts',
 *     query: (q) => q.eq('user_id', userId).order('created_at', { ascending: false }),
 *     realtime: { column: 'user_id', value: userId },
 *     deps: [userId],
 *   });
 */
export function useCollection<T extends TableName>(
  options: UseCollectionOptions<T>
): UseCollectionResult<Row<T>> {
  const { table, query, realtime, deps } = options;
  const [data, setData] = useState<Row<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  // Keep a stable ref to the latest run() so refetch() always calls the
  // current version (with the right table/query closure).
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base: any = (supabase as any).from(table).select('*');
      const finalQuery = query ? query(base) : base;

      const { data: rows, error: queryError } = await finalQuery;

      if (cancelled) return;
      if (queryError) {
        setError(new Error(queryError.message));
        setData(null);
      } else {
        setData((rows ?? []) as Row<T>[]);
      }
      setIsLoading(false);
    };

    runRef.current = run;
    run();

    if (!realtime) {
      return () => {
        cancelled = true;
      };
    }

    // Channel name must be unique per mount. If we reused a deterministic
    // name like `table:col:val`, a re-mount (StrictMode, Fast Refresh, or any
    // parent re-render that changes `deps`) would call supabase.channel()
    // with the same name while the previous channel is still in the
    // 'subscribed' state (removeChannel is async). Supabase returns the
    // existing channel, and calling .on() on it throws:
    //   "cannot add 'postgres_changes' callbacks ... after 'subscribed'"
    const channelId = `${String(table)}:${realtime.column}:${realtime.value}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: String(table),
          filter: `${realtime.column}=eq.${realtime.value}`,
        },
        () => {
          if (!cancelled) run();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(() => { runRef.current(); }, []);

  return { data, isLoading, error, refetch };
}
