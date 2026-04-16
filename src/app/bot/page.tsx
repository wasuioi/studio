"use client";

// Allow up to 60s for Vercel serverless functions (AI flow can be slow)
export const maxDuration = 60;

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Send, Zap, Loader2, Star, Globe, RotateCcw, Paperclip } from 'lucide-react';
import { aiPersonalityInterview } from '@/ai/flows/ai-personality-interview';
import { supabase } from '@/supabase/client';
import type { Tables } from '@/supabase/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { updateUserStage } from '@/app/bot/actions';
import { BioApprovalModal } from '@/components/BioApprovalModal';
import { DevStagePanel } from '@/components/dev/DevStagePanel';
import { isDevToolsEnabled } from '@/lib/dev-tools/flag';
import { useAuth } from '@/hooks/use-auth';

type BotChat = Tables<'bot_chats'>;

interface ChatMessage {
  role: 'user' | 'model';
  message: string;
  timestamp: string;
}

export default function AIProfileBot() {
  // Using useAuth (one-shot fetch + cache) instead of useRow with realtime.
  // Stage advances are always triggered from this same component (via
  // updateUserStage after Vera responds), and the DevStagePanel reloads
  // the page after devForceStage. So we don't need realtime pushes to
  // reflect stage changes from other sessions.
  const { user, profile, loading: isUserLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [isUserLoading, user, router]);

  const [input, setInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiError, setAiError] = useState<'quota' | 'other' | null>(null);
  const [lastMessage, setLastMessage] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'th' | null>(null);
  const [botChat, setBotChat] = useState<BotChat | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const [stage, setStage] = useState(0);
  const [bioModalOpen, setBioModalOpen] = useState(false);
  const [pendingBioDraft, setPendingBioDraft] = useState('');
  const [awaitingPhoto, setAwaitingPhoto] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  // Sync stage from profile when it loads
  useEffect(() => {
    if (profile?.stage !== undefined && profile.stage !== stage) {
      setStage(profile.stage);
    }
    // stage in deps would cause an infinite loop; intentionally omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.stage]);

  // Load or create a bot_chats row for this user (one active interview at a time)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      // Restore from localStorage first for instant display
      try {
        const cached = localStorage.getItem(`vera_chat_${user.id}`);
        const cachedLang = localStorage.getItem(`vera_chat_${user.id}_lang`) as 'en' | 'th' | null;
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0 && !cancelled) {
            setSessionMessages(parsed);
            if (cachedLang) setSelectedLanguage(cachedLang);
          }
        }
      } catch {
        // ignore
      }

      // Fetch the latest bot_chat for this user
      const { data, error } = await supabase
        .from('bot_chats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('[bot] failed to load bot_chat', error);
        setIsRestoring(false);
        initializedRef.current = true;
        return;
      }

      if (data) {
        setBotChat(data);
        const msgs = (data.messages as unknown as ChatMessage[]) ?? [];
        if (msgs.length > 0) {
          setSessionMessages(prev => (msgs.length > prev.length ? msgs : prev));
        }
      }

      setIsRestoring(false);
      initializedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Persist messages to localStorage on change
  useEffect(() => {
    if (!user || sessionMessages.length === 0) return;
    try {
      localStorage.setItem(`vera_chat_${user.id}`, JSON.stringify(sessionMessages));
    } catch {
      // ignore
    }
  }, [sessionMessages, user]);

  useEffect(() => {
    if (!user || !selectedLanguage) return;
    try {
      localStorage.setItem(`vera_chat_${user.id}_lang`, selectedLanguage);
    } catch {
      // ignore
    }
  }, [selectedLanguage, user]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessionMessages, isAiThinking]);

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    resizeTextarea();
  };

  const handleLanguageSelect = async (lang: 'en' | 'th') => {
    if (!user) return;

    setSelectedLanguage(lang);
    const initialMsg = lang === 'en'
      ? "Hi! I'm Vera, your TrueVibe companion. I'm here to understand your unique energy. Ready to begin our vibe check?"
      : "สวัสดีค่ะ! ฉันคือ Vera เพื่อนคู่คิดของคุณ ฉันอยู่ที่นี่เพื่อทำความรู้จักพลังงานของคุณ พร้อมจะเริ่มกันหรือยังคะ?";

    const firstMsg: ChatMessage = {
      role: 'model',
      message: initialMsg,
      timestamp: new Date().toISOString(),
    };

    setSessionMessages([firstMsg]);

    // Upsert bot_chat
    const { data, error } = await supabase
      .from('bot_chats')
      .insert({
        user_id: user.id,
        phase: 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: [firstMsg] as any,
        completed: false,
      })
      .select()
      .single();

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    setBotChat(data);
  };

  const handleResetConversation = async () => {
    if (!user) return;

    try {
      // Delete all bot_chats for this user
      await supabase.from('bot_chats').delete().eq('user_id', user.id);
      // Delete personality_profile
      await supabase.from('personality_profiles').delete().eq('user_id', user.id);
      // Reset profile fields
      await supabase
        .from('profiles')
        .update({
          profile_completed: false,
          personality_profile: null,
          top_matches: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      // Clean up chat requests and conversations for this user
      await supabase.from('chat_requests').delete().or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      // Note: conversations with this user in participant_ids will also need cleanup
      // but array-based deletes aren't straightforward; RLS + cascade from profile delete
      // would handle this in a full cleanup. For v0, leave conversation records.

      initializedRef.current = false;
      setBotChat(null);
      setSessionMessages([]);
      setSelectedLanguage(null);
      setInput('');
      setIsRestoring(false);

      try {
        localStorage.removeItem(`vera_chat_${user.id}`);
        localStorage.removeItem(`vera_chat_${user.id}_lang`);
      } catch {
        // ignore
      }

      toast({ title: "Profile Reset", description: "Your vibes have been cleared." });
    } catch (e) {
      console.error("Reset failed", e);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !botChat) return;

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('profile-photos')
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      toast({ variant: 'destructive', title: 'Upload failed', description: uploadErr.message });
      return;
    }

    const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(path);
    const photoUrl = urlData.publicUrl;

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ photo_url: photoUrl })
      .eq('id', user.id);
    if (profileErr) {
      toast({ variant: 'destructive', title: 'Photo save failed', description: profileErr.message });
      return;
    }

    // Append a synthetic system line so Vera knows on her next turn.
    const systemMsg: ChatMessage = {
      role: 'user',
      message: '[System: User just uploaded their profile photo.]',
      timestamp: new Date().toISOString(),
    };
    const newHistory = [...sessionMessages, systemMsg];
    setSessionMessages(newHistory);
    await supabase
      .from('bot_chats')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ messages: newHistory as any, updated_at: new Date().toISOString() })
      .eq('id', botChat.id);

    setAwaitingPhoto(false);
    // Reset the file input so uploading the same file twice re-triggers.
    e.target.value = '';
    toast({ title: 'Photo uploaded' });
  };

  const handleRetry = () => {
    setSessionMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'user') return prev.slice(0, -1);
      return prev;
    });
    setAiError(null);
    if (lastMessage) {
      setInput(lastMessage);
      setTimeout(resizeTextarea, 0);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isAiThinking || !user || !botChat || !selectedLanguage) return;

    const currentMsg = input;
    const now = new Date().toISOString();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLastMessage(currentMsg);
    setAiError(null);
    setIsAiThinking(true);

    const newUserMsg: ChatMessage = {
      role: 'user',
      message: currentMsg,
      timestamp: now,
    };

    const updatedHistory = [...sessionMessages, newUserMsg];
    setSessionMessages(updatedHistory);

    // Persist the user's message
    const { error: saveUserMsgErr } = await supabase
      .from('bot_chats')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ messages: updatedHistory as any, updated_at: now })
      .eq('id', botChat.id)
      .select()
      .single();

    if (saveUserMsgErr) {
      console.error('[bot] failed to save user message', saveUserMsgErr);
    }

    try {
      const response = await aiPersonalityInterview({
        chatHistory: sessionMessages.map(m => ({ role: m.role, message: m.message })),
        currentMessage: currentMsg,
        preferredLanguage: selectedLanguage === 'th' ? 'Thai' : 'English',
      });

      const aiMsg: ChatMessage = {
        role: 'model',
        message: response.response,
        timestamp: new Date().toISOString(),
      };

      const finalHistory = [...updatedHistory, aiMsg];
      setSessionMessages(finalHistory);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = {
        messages: finalHistory,
        updated_at: new Date().toISOString(),
      };

      if (response.interviewComplete && response.personalityProfile) {
        updates.completed = true;

        // Save to personality_profiles (normalized table)
        await supabase.from('personality_profiles').upsert({
          user_id: user.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          traits: response.personalityProfile as any,
          partner_vision: response.personalityProfile?.ideal_partner?.summary ?? null,
          summary: response.personalityProfile?.user_persona?.summary ?? null,
          completed_at: new Date().toISOString(),
        });

        // Also save to profiles.personality_profile (legacy JSONB column) so the
        // rest of the app that reads profile.personalityProfile keeps working.
        await supabase
          .from('profiles')
          .update({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            personality_profile: response.personalityProfile as any,
            profile_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        toast({
          title: "Vibe Check Complete!",
          description: "Vera has analyzed your unique energy.",
        });
      }

      // --- Stage progression (runs on every turn) ---
      const stageMap = { none: 0, stage1: 1, stage2: 2, stage3: 3 } as const;
      const veraStage = stageMap[response.stageReached ?? 'none'];
      if (veraStage > stage) {
        const previousStage = stage;
        try {
          await updateUserStage(veraStage);
          setStage(veraStage);
          if (previousStage < 1 && veraStage >= 1 && response.suggestedBio) {
            setPendingBioDraft(response.suggestedBio);
            setBioModalOpen(true);
          }
        } catch (stageErr) {
          console.error('[bot] updateUserStage failed', stageErr);
        }
      }

      // --- Photo upload UI toggle ---
      const hasPhoto = Boolean(profile?.photo_url);
      setAwaitingPhoto(Boolean(response.requestPhotoUpload) && !hasPhoto);

      const { error: saveAiMsgErr } = await supabase
        .from('bot_chats')
        .update(updates)
        .eq('id', botChat.id)
        .select()
        .single();
      if (saveAiMsgErr) {
        console.error('[bot] failed to save AI response', saveAiMsgErr);
      }
    } catch (error: unknown) {
      console.error("Vera AI error:", error);
      const msg = String((error as Error)?.message || error || '');
      const isQuota = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
      const isTemp = msg.includes('503') || msg.toLowerCase().includes('unavailable') || msg.toLowerCase().includes('high demand');
      setAiError(isQuota || isTemp ? 'quota' : 'other');
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isUserLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

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
              <p className="text-[9px] text-white/50 font-black uppercase tracking-widest">Sensing Frequency</p>
            </div>
          </div>
        </div>

        {selectedLanguage && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-white/40 hover:text-white hover:bg-white/5 h-10 w-10 border border-white/5">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass-card rounded-[2rem] border-white/10 mx-4">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black text-white">Reset Vibe Check?</AlertDialogTitle>
                <AlertDialogDescription className="text-white/60">
                  This will clear your interview progress and previous connections. Start a new cosmic journey with Vera.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-full font-bold bg-white/5 border-white/10 text-white">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetConversation} className="rounded-full font-bold bg-destructive text-white">
                  Reset All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="flex-1 glass-card rounded-[2.5rem] overflow-hidden flex flex-col mb-4 relative h-[calc(100vh-200px)] min-h-[500px]">
        {isRestoring ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !selectedLanguage ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-8 animate-in fade-in zoom-in-95">
            <div className="bg-primary/10 p-8 rounded-full shadow-[0_0_40px_rgba(106,92,255,0.1)]">
              <Globe className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight text-white">Connect with Vera</h2>
              <p className="text-white/60 font-medium text-sm">Choose your language to begin the vibe check.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-sm">
              <Button
                onClick={() => handleLanguageSelect('en')}
                className="h-16 rounded-3xl text-lg font-black bg-white/5 border border-white/10 text-white hover:bg-primary/20 transition-all"
              >
                🇺🇸 English
              </Button>
              <Button
                onClick={() => handleLanguageSelect('th')}
                className="h-16 rounded-3xl text-lg font-black bg-white/5 border border-white/10 text-white hover:bg-secondary/20 transition-all"
              >
                🇹🇭 ภาษาไทย
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overscroll-contain p-6"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              <div className="space-y-6 max-w-xl mx-auto pb-10">
                {sessionMessages.map((m, i) => (
                  <div key={`${m.role}-${i}`} className={cn(
                    "flex flex-col max-w-[85%]",
                    m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "p-4 md:p-5 rounded-[1.75rem] text-sm md:text-base leading-relaxed font-medium shadow-lg",
                      m.role === 'user'
                        ? "truevibe-gradient text-white rounded-tr-none"
                        : "bg-white/10 text-white rounded-tl-none border border-white/10 backdrop-blur-md"
                    )}>
                      {m.message}
                    </div>
                  </div>
                ))}
                {isAiThinking && (
                  <div className="flex items-center gap-2 text-primary text-[10px] animate-pulse font-black uppercase tracking-widest ml-2">
                    <Star className="w-3 h-3 fill-current" /> Vera is sensing...
                  </div>
                )}
                {aiError && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-2xl px-4 py-3 text-sm flex items-center justify-between gap-3 max-w-xl">
                    <p className="text-white/80 font-medium">
                      {aiError === 'quota'
                        ? 'Vera is busy right now — Google servers are overloaded. Wait a moment, then retry.'
                        : 'Vera hit a snag. Please try again.'}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary font-black shrink-0 hover:bg-primary/10"
                      onClick={handleRetry}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Retry
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 md:p-6 bg-black/20 border-t border-white/10">
              <div className="relative flex items-end gap-3 max-w-xl mx-auto">
                <textarea
                  ref={textareaRef}
                  placeholder="Message Vera... (Shift+Enter for new line)"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="flex-1 min-h-[48px] max-h-[120px] rounded-[1.5rem] bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/40 px-5 py-3 text-sm resize-none leading-relaxed overflow-y-auto"
                  disabled={isAiThinking}
                />
                {awaitingPhoto && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handlePhotoUpload}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="shrink-0 w-12 h-12 rounded-full"
                      onClick={() => fileInputRef.current?.click()}
                      title="Upload a photo"
                      disabled={isAiThinking}
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                  </>
                )}
                <Button
                  size="icon"
                  className="shrink-0 w-12 h-12 rounded-full truevibe-pill-button px-0 mb-0"
                  onClick={handleSend}
                  disabled={isAiThinking || !input.trim()}
                >
                  <Send className="w-4 h-4 text-white" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <BioApprovalModal
        open={bioModalOpen}
        initialBio={pendingBioDraft}
        onSave={async (finalBio) => {
          if (!user) return;
          await supabase.from('profiles').update({ bio: finalBio }).eq('id', user.id);
          setBioModalOpen(false);
          toast({ title: 'Bio saved' });
        }}
        onSkip={() => setBioModalOpen(false)}
      />

      {isDevToolsEnabled() && <DevStagePanel currentStage={stage} />}
    </div>
  );
}
