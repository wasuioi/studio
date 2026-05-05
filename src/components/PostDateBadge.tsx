'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/supabase/client';

interface PostDateBadgeProps {
  chatRequestId: string;
  userId: string;
}

/**
 * Passive reminder shown on a planned-date row when a date_feedback row
 * exists with status in ('nudged', 'in_progress'). Resolves the row id
 * client-side and links to /bot?postDate=<id>.
 */
export function PostDateBadge({ chatRequestId, userId }: PostDateBadgeProps) {
  const [feedbackId, setFeedbackId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('date_feedback')
        .select('id, status')
        .eq('chat_request_id', chatRequestId)
        .eq('user_id', userId)
        .in('status', ['nudged', 'in_progress'])
        .maybeSingle();
      if (alive && data) setFeedbackId(data.id);
    })();
    return () => {
      alive = false;
    };
  }, [chatRequestId, userId]);

  if (!feedbackId) return null;

  return (
    <Link
      href={`/bot?postDate=${feedbackId}`}
      className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-200"
    >
      💬 Vera wants to chat about this
    </Link>
  );
}
