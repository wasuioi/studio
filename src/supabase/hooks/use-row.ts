'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/supabase/client';
import type { Database } from '@/lib/database.types';

type TableName = keyof Database['public']['Tables'];
type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];

interface UseRowResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseRowOptions<T extends TableName> {
  table: T;
  column?: string;
  value: string | number | null | undefined;
  realtime?: boolean;
}

/**
 * React hook to fetch and optionally subscribe to a single row by column+value.
 * Drop-in replacement for Firebase useDoc().
 *
 * Usage:
 *   const { data: profile } = useRow<'profiles'>({
 *     table: 'profiles',
 *     value: userId,
 *   });
 */
export function useRow<T extends TableName>(
  options: UseRowOptions<T>
): UseRowResult<Row<T>> {
  const { table, column = 'id', value, realtime = false } = options;
  const [data, setData] = useState<Row<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (value === null || value === undefined) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const fetchInitial = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row, error: fetchError } = await (supabase as any)
        .from(table)
        .select('*')
        .eq(column, value)
        .maybeSingle();

      if (cancelled) return;
      if (fetchError) {
        setError(new Error(fetchError.message));
        setData(null);
      } else {
        setData(row as Row<T> | null);
      }
      setIsLoading(false);
    };

    fetchInitial();

    if (!realtime) {
      return () => {
        cancelled = true;
      };
    }

    const channel = supabase
      .channel(`${String(table)}:${column}:${value}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: String(table),
          filter: `${column}=eq.${value}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (cancelled) return;
          if (payload.eventType === 'DELETE') {
            setData(null);
          } else {
            setData(payload.new as Row<T>);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [table, column, value, realtime]);

  return { data, isLoading, error };
}
