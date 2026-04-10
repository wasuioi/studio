"use client";

import { useEffect, useRef } from 'react';
import { supabase } from '@/supabase/client';
import { useSupabaseAuth } from '@/supabase/provider';
import { useToast } from '@/hooks/use-toast';

/**
 * Global listener that watches for new incoming chat requests via Supabase
 * Realtime and triggers a toast notification.
 */
export function RequestNotificationListener() {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user?.email_confirmed_at) return;

    // On first mount, don't toast for existing rows — only for new INSERTs
    // that arrive via the realtime channel.
    initialized.current = true;

    const channel = supabase
      .channel(`chat_requests:receiver:${user.id}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_requests',
          filter: `receiver_id=eq.${user.id}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (!initialized.current) return;
          const senderName = payload?.new?.sender_name ?? 'Someone';
          toast({
            title: "🌹 New Date Invite!",
            description: `${senderName} wants to go on a date with you. Check your Dates tab!`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  return null;
}
