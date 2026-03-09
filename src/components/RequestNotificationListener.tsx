"use client";

import { useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { ChatRequest } from '@/types';

/**
 * Global listener that watches for new incoming chat requests
 * and triggers a toast notification.
 */
export function RequestNotificationListener() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const lastRequestCount = useRef<number | null>(null);

  const requestsQuery = useMemoFirebase(() => {
    // Guard against unverified users querying protected collections
    if (!user || !user.emailVerified) return null;
    return query(
      collection(db, 'chat_requests'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'pending')
    );
  }, [db, user]);

  const { data: incomingRequests } = useCollection<ChatRequest>(requestsQuery);

  useEffect(() => {
    if (!incomingRequests) return;

    // Initialize the ref on the first load so we don't toast existing requests
    if (lastRequestCount.current === null) {
      lastRequestCount.current = incomingRequests.length;
      return;
    }

    // If the number of requests increased, it means a new one arrived
    if (incomingRequests.length > lastRequestCount.current) {
      const newRequest = incomingRequests[incomingRequests.length - 1];
      
      toast({
        title: "New Vibe Check!",
        description: `${newRequest.senderName} wants to connect with you. Check your Requests tab!`,
      });
    }

    lastRequestCount.current = incomingRequests.length;
  }, [incomingRequests, toast]);

  return null;
}