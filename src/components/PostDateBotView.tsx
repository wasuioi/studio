'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PostDateCheckInCard } from '@/components/PostDateCheckInCard';
import { supabase } from '@/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { submitCheckInTurn, dismissCheckIn } from '@/app/post-date/actions';
import type { ConvoTurn } from '@/lib/post-date';

interface FeedbackRow {
  id: string;
  chat_request_id: string;
  conversation: ConvoTurn[];
  status: 'nudged' | 'in_progress' | 'completed' | 'dismissed';
  nudge_count: number | null;
}

interface ChatRequestRow {
  sender_id: string;
  receiver_id: string;
  sender_name: string | null;
  receiver_name: string | null;
}

interface Props {
  feedbackId: string;
}

export function PostDateBotView({ feedbackId }: Props) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [row, setRow] = useState<FeedbackRow | null>(null);
  const [request, setRequest] = useState<ChatRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [authLoading, user, router]);

  // Load feedback row + chat_request join.
  useEffect(() => {
    if (!user) return;
    let alive = true;

    (async () => {
      const { data: fb, error: fbErr } = await supabase
        .from('date_feedback')
        .select('id, chat_request_id, conversation, status, nudge_count')
        .eq('id', feedbackId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!alive) return;
      if (fbErr || !fb) {
        setLoading(false);
        return;
      }
      setRow(fb as FeedbackRow);

      const { data: cr } = await supabase
        .from('chat_requests')
        .select('sender_id, receiver_id, sender_name, receiver_name')
        .eq('id', fb.chat_request_id)
        .maybeSingle();
      if (alive && cr) setRequest(cr as ChatRequestRow);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [feedbackId, user]);

  // Realtime subscription so an incoming second nudge from the cron shows up live.
  useEffect(() => {
    if (!feedbackId || !user) return;
    const channel = supabase
      .channel(`date_feedback:${feedbackId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'date_feedback',
          filter: `id=eq.${feedbackId}`,
        },
        (payload) => {
          const next = payload.new as FeedbackRow;
          setRow((prev) => (prev ? { ...prev, ...next } : (next as FeedbackRow)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [feedbackId, user]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!row || !request) {
    return (
      <div className="max-w-2xl mx-auto p-6 pt-20">
        <Navigation />
        <p className="text-white/70">This check-in could not be found.</p>
      </div>
    );
  }

  const matchName =
    user && request.sender_id === user.id
      ? request.receiver_name ?? 'them'
      : request.sender_name ?? 'them';

  const isClosed = row.status === 'completed' || row.status === 'dismissed';
  const showDismiss = row.nudge_count === 2 && !isClosed;

  const handleSubmit = async (text: string, pill?: 'positive' | 'neutral' | 'negative') => {
    setSubmitting(true);
    try {
      const result = await submitCheckInTurn(feedbackId, text, pill);
      // Realtime will update `row` shortly; optimistic append for instant feedback.
      setRow((prev) =>
        prev
          ? {
              ...prev,
              status: result.isClosingTurn ? 'completed' : 'in_progress',
              conversation: [
                ...prev.conversation,
                { role: 'user', text, ts: new Date().toISOString() },
                { role: 'vera', text: result.veraResponse, ts: new Date().toISOString() },
              ],
            }
          : prev,
      );
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not send',
        description: (e as Error).message ?? 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    setSubmitting(true);
    try {
      await dismissCheckIn(feedbackId);
      setRow((prev) =>
        prev
          ? {
              ...prev,
              status: 'dismissed',
              conversation: [
                ...prev.conversation,
                {
                  role: 'vera',
                  text: "Completely understood. I won't ask again about this one.",
                  ts: new Date().toISOString(),
                },
              ],
            }
          : prev,
      );
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not dismiss',
        description: (e as Error).message ?? 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto min-h-screen flex flex-col p-4 relative pt-20">
      <Navigation />

      <h1 className="text-xl font-black text-white mb-4 px-2">
        After your date with {matchName}
      </h1>

      <div className="flex-1 glass-card rounded-[2.5rem] overflow-hidden flex flex-col mb-4 relative">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4 max-w-xl mx-auto pb-6">
            {row.conversation.map((turn, i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col max-w-[85%]',
                  turn.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start',
                )}
              >
                <div
                  className={cn(
                    'p-4 rounded-[1.5rem] text-sm leading-relaxed font-medium shadow-lg',
                    turn.role === 'user'
                      ? 'truevibe-gradient text-white rounded-tr-none'
                      : 'bg-white/10 text-white rounded-tl-none border border-white/10 backdrop-blur-md',
                  )}
                >
                  {turn.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!isClosed && (
          <div className="p-4 md:p-6 bg-black/20 border-t border-white/10">
            <div className="max-w-xl mx-auto">
              <PostDateCheckInCard
                matchName={matchName}
                onSubmit={handleSubmit}
                onDismiss={handleDismiss}
                showDismiss={showDismiss}
                disabled={submitting}
              />
            </div>
          </div>
        )}

        {isClosed && (
          <div className="p-6 bg-black/20 border-t border-white/10 text-center text-white/60 text-sm">
            This check-in is complete. Thanks for sharing 💜
          </div>
        )}
      </div>
    </div>
  );
}
