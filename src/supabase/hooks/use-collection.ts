'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/supabase/client';
import type { Database } from '@/lib/database.types';

type TableName = keyof Database['public']['Tables'];
type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];

interface UseCollectionResult<T> {
  data: T[] | null;
  isLoading: boolean;
  error: Error | null;
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

    run();

    if (!realtime) {
      return () => {
        cancelled = true;
      };
    }

    const channel = supabase
      .channel(`${String(table)}:${realtime.column}:${realtime.value}`)
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

  return { data, isLoading, error };
}
