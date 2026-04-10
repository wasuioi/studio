"use client";

import { useEffect, useRef } from 'react';
import { useUser } from '@/supabase/hooks/use-user';
import { useCollection } from '@/supabase/hooks/use-collection';
import { rowToChatRequest } from '@/supabase/adapters';
import { useToast } from '@/hooks/use-toast';

/**
 * Global listener that checks for planned dates happening in the next 24 hours
 * and sends a reminder toast notification.
 *
 * Note: `scheduledFor` is not a dedicated column yet — we use suggested_date_time
 * as a best-effort marker. Future work: add a proper timestamptz column.
 */
export function DateReminderListener() {
  const { user } = useUser();
  const { toast } = useToast();
  const notifiedIds = useRef<Set<string>>(new Set());
  const emailVerified = Boolean(user?.email_confirmed_at);

  const { data: sentRows } = useCollection<'chat_requests'>({
    table: 'chat_requests',
    query: (q) => (emailVerified && user ? q.eq('sender_id', user.id).eq('date_status', 'planned') : q),
    deps: [user?.id, emailVerified],
  });

  const { data: receivedRows } = useCollection<'chat_requests'>({
    table: 'chat_requests',
    query: (q) => (emailVerified && user ? q.eq('receiver_id', user.id).eq('date_status', 'planned') : q),
    deps: [user?.id, emailVerified],
  });

  useEffect(() => {
    const sentDates = (sentRows ?? []).map(rowToChatRequest);
    const receivedDates = (receivedRows ?? []).map(rowToChatRequest);
    const allDates = [...sentDates, ...receivedDates];
    if (allDates.length === 0) return;

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in22h = new Date(now.getTime() + 22 * 60 * 60 * 1000);

    for (const date of allDates) {
      // Use suggestedDateTime as a rough indicator — it's a free-form string,
      // so parsing may fail. Skip silently in that case.
      if (!date.suggestedDateTime || notifiedIds.current.has(date.id)) continue;

      const scheduledDate = new Date(date.suggestedDateTime);
      if (isNaN(scheduledDate.getTime())) continue;

      if (scheduledDate >= in22h && scheduledDate <= in24h) {
        const otherName = date.senderId === user?.id ? date.receiverName : date.senderName;
        notifiedIds.current.add(date.id);
        toast({
          title: "📅 Date Reminder!",
          description: `Your date with ${otherName} is tomorrow — ${date.suggestedDateTime} at ${date.suggestedLocation}`,
        });
      }
    }
  }, [sentRows, receivedRows, toast, user]);

  return null;
}
