"use client";

import { useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ChatRequest } from '@/types';

/**
 * Global listener that checks for planned dates happening in the next 24 hours
 * and sends a reminder toast notification.
 */
export function DateReminderListener() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const notifiedIds = useRef<Set<string>>(new Set());

  const sentQuery = useMemoFirebase(() => {
    if (!user || !user.emailVerified) return null;
    return query(
      collection(db, 'chat_requests'),
      where('senderId', '==', user.uid),
      where('dateStatus', '==', 'planned')
    );
  }, [db, user]);

  const receivedQuery = useMemoFirebase(() => {
    if (!user || !user.emailVerified) return null;
    return query(
      collection(db, 'chat_requests'),
      where('receiverId', '==', user.uid),
      where('dateStatus', '==', 'planned')
    );
  }, [db, user]);

  const { data: sentDates } = useCollection<ChatRequest>(sentQuery);
  const { data: receivedDates } = useCollection<ChatRequest>(receivedQuery);

  useEffect(() => {
    const allDates = [...(sentDates || []), ...(receivedDates || [])];
    if (allDates.length === 0) return;

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in22h = new Date(now.getTime() + 22 * 60 * 60 * 1000);

    for (const date of allDates) {
      if (!date.scheduledFor || notifiedIds.current.has(date.id)) continue;

      const scheduledDate = new Date(date.scheduledFor);
      // Notify if the date is between 22-24 hours away
      if (scheduledDate >= in22h && scheduledDate <= in24h) {
        const otherName = date.senderId === user?.uid ? date.receiverName : date.senderName;
        notifiedIds.current.add(date.id);
        toast({
          title: "📅 Date Reminder!",
          description: `Your date with ${otherName} is tomorrow — ${date.suggestedDateTime} at ${date.suggestedLocation}`,
        });
      }
    }
  }, [sentDates, receivedDates, toast, user]);

  return null;
}
