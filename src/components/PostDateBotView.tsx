'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, Zap } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PostDateCheckInCard } from '@/components/PostDateCheckInCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { submitCheckInTurn, dismissCheckIn } from '@/app/post-date/actions';
import { aiPersonalityInterview } from '@/ai/flows/ai-personality-interview';
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

type ChatMessage = {
  role: 'user' | 'model';
  message: string;
  timestamp?: string;
};

interface Props {
  feedbackId: string;
}

export function PostDateBotView({ feedbackId }: Props) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [row, setRow] = useState<FeedbackRow | null>(null);
  const [request, setRequest] = useState<ChatRequestRow | null>(null);
  const [previousChat, setPreviousChat] = useState<ChatMessage[]>([]);
  const [continuationChat, setContinuationChat] = useState<ChatMessage[]>([]);
  const [botChatId, setBotChatId] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'th'>('en');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    try {
      const cachedLang = localStorage.getItem(`vera_chat_${user.id}_lang`) as 'en' | 'th' | null;
      if (cachedLang) setLanguage(cachedLang);
    } catch {
      // ignore
    }

    (async () => {
      const [{ data: fb, error: fbErr }, { data: prevChat }] = await Promise.all([
        supabase
          .from('date_feedback')
          .select('id, chat_request_id, conversation, status, nudge_count')
          .eq('id', feedbackId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('bot_chats')
          .select('id, messages')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!alive) return;
      if (fbErr || !fb) {
        setLoading(false);
        return;
      }
      setRow(fb as FeedbackRow);

      if (prevChat) {
        setBotChatId(prevChat.id as string);
        const msgs = prevChat.messages as unknown as ChatMessage[];
        if (Array.isArray(msgs)) setPreviousChat(msgs);
      }

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [row?.conversation, continuationChat, submitting, aiThinking, previousChat.length]);

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
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
  const userHasResponded = row.conversation.some((t) => t.role === 'user');
  const showPillsCard = !userHasResponded && !isClosed;
  const cardVariant: 'first' | 'second' = (row.nudge_count ?? 1) >= 2 ? 'second' : 'first';

  const submitTurn = async (text: string, pill?: 'positive' | 'neutral' | 'negative') => {
    // Optimistic: user bubble appears immediately, before the AI runs.
    setRow((prev) =>
      prev
        ? {
            ...prev,
            status: 'in_progress',
            conversation: [
              ...prev.conversation,
              { role: 'user', text, ts: new Date().toISOString() },
            ],
          }
        : prev,
    );
    setSubmitting(true);
    try {
      const result = await submitCheckInTurn(feedbackId, text, pill);
      // Tiny delay so the typing indicator has a moment to breathe.
      await new Promise((r) => setTimeout(r, 250));
      setRow((prev) =>
        prev
          ? {
              ...prev,
              status: result.isClosingTurn ? 'completed' : 'in_progress',
              conversation: [
                ...prev.conversation,
                { role: 'vera', text: result.veraResponse, ts: new Date().toISOString() },
              ],
            }
          : prev,
      );
    } catch (e) {
      // Rollback the optimistic user bubble.
      setRow((prev) =>
        prev
          ? { ...prev, conversation: prev.conversation.slice(0, -1) }
          : prev,
      );
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

  // After feedback closes, the input bar silently switches to "regular Vera"
  // mode — new turns route to aiPersonalityInterview and persist into the
  // user's bot_chats row, exactly like /bot.
  const continueWithVera = async (text: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    const userMsg: ChatMessage = { role: 'user', message: text, timestamp: now };

    // Optimistic: user bubble appears instantly.
    setContinuationChat((prev) => [...prev, userMsg]);
    setAiThinking(true);

    try {
      const history: ChatMessage[] = [...previousChat, ...continuationChat];
      const aiOut = await aiPersonalityInterview({
        chatHistory: history.map((m) => ({ role: m.role, message: m.message })),
        currentMessage: text,
        preferredLanguage: language === 'th' ? 'Thai' : 'English',
      });

      // Brief pause so the typing indicator gets a beat before Vera replies.
      await new Promise((r) => setTimeout(r, 250));

      const veraMsg: ChatMessage = {
        role: 'model',
        message: aiOut.response,
        timestamp: new Date().toISOString(),
      };
      setContinuationChat((prev) => [...prev, veraMsg]);

      const fullMessages = [...previousChat, ...continuationChat, userMsg, veraMsg];

      if (botChatId) {
        await supabase
          .from('bot_chats')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ messages: fullMessages as any, updated_at: new Date().toISOString() })
          .eq('id', botChatId);
      } else {
        const { data, error } = await supabase
          .from('bot_chats')
          .insert({
            user_id: user.id,
            phase: 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: fullMessages as any,
            completed: false,
          })
          .select('id')
          .single();
        if (!error && data) setBotChatId(data.id as string);
      }
    } catch (e) {
      // Rollback the optimistic user bubble on failure.
      setContinuationChat((prev) => prev.slice(0, -1));
      toast({
        variant: 'destructive',
        title: 'Vera hit a snag',
        description: (e as Error).message ?? 'Please try again.',
      });
    } finally {
      setAiThinking(false);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || submitting || aiThinking) return;
    // Clear input immediately so it feels responsive — server work happens after.
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (isClosed) {
      await continueWithVera(text);
    } else {
      await submitTurn(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderBubble = (
    role: 'user' | 'model',
    text: string,
    key: string,
    isNew = false,
  ) => (
    <div
      key={key}
      className={cn(
        'flex flex-col max-w-[85%]',
        role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start',
        isNew && 'animate-in fade-in slide-in-from-bottom-2 duration-300',
      )}
    >
      <div
        className={cn(
          'p-4 md:p-5 rounded-[1.75rem] text-sm md:text-base leading-relaxed font-medium shadow-lg',
          role === 'user'
            ? 'truevibe-gradient text-white rounded-tr-none'
            : 'bg-white/10 text-white rounded-tl-none border border-white/10 backdrop-blur-md',
        )}
      >
        {text}
      </div>
    </div>
  );

  const inputDisabled = submitting || aiThinking;

  return (
    <div className="max-w-2xl mx-auto min-h-screen flex flex-col p-4 relative pt-20">
      <Navigation />

      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-3">
          <div className="truevibe-gradient p-2.5 rounded-2xl shadow-xl">
            <Zap className="text-white w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Vera AI</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-verified rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <p className="text-[9px] text-white/50 font-black uppercase tracking-widest">
                Sensing Frequency
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 glass-card rounded-[2.5rem] overflow-hidden flex flex-col mb-4 relative h-[calc(100vh-200px)] min-h-[500px]">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain p-6"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          <div className="space-y-6 max-w-xl mx-auto pb-10">
            {previousChat.map((m, i) =>
              renderBubble(m.role, m.message, `prev-${i}`, false),
            )}

            {row.conversation.map((turn, i) =>
              renderBubble(
                turn.role === 'vera' ? 'model' : 'user',
                turn.text,
                `fb-${i}`,
                true,
              ),
            )}

            {showPillsCard && (
              <div className="flex flex-col max-w-[85%] mr-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                <PostDateCheckInCard
                  matchName={matchName}
                  variant={cardVariant}
                  onSubmit={submitTurn}
                  onDismiss={handleDismiss}
                  disabled={submitting}
                />
              </div>
            )}

            {continuationChat.map((m, i) =>
              renderBubble(m.role, m.message, `cont-${i}`, true),
            )}

            {(submitting || aiThinking) && (
              <div className="flex flex-col max-w-[85%] mr-auto animate-in fade-in duration-200">
                <div className="bg-white/10 text-white border border-white/10 backdrop-blur-md rounded-[1.75rem] rounded-tl-none p-4 md:p-5 shadow-lg">
                  <div className="flex items-center gap-1.5 h-5">
                    <span
                      className="w-2 h-2 rounded-full bg-white/60 animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-white/60 animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-white/60 animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 md:p-6 bg-black/20 border-t border-white/10">
          <div className="relative flex items-end gap-3 max-w-xl mx-auto">
            <textarea
              ref={textareaRef}
              placeholder="Message Vera..."
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                resizeTextarea();
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              className="flex-1 min-h-[48px] max-h-[120px] rounded-[1.5rem] bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40 px-5 py-3 text-sm resize-none leading-relaxed overflow-y-auto"
              disabled={inputDisabled}
            />
            <Button
              size="icon"
              className="shrink-0 w-12 h-12 rounded-full truevibe-pill-button px-0 mb-0"
              onClick={handleSend}
              disabled={inputDisabled || !draft.trim()}
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
