
"use client";

// Allow up to 60s for Vercel serverless functions (AI flow can be slow)
export const maxDuration = 60;

import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Send, Zap, Loader2, Star, Globe, RotateCcw } from 'lucide-react';
import { aiPersonalityInterview } from '@/ai/flows/ai-personality-interview';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import {
  useFirestore,
  useDoc,
  useMemoFirebase,
  updateDocumentNonBlocking,
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
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

export default function AIProfileBot() {
  // Use useUser() instead of useAuth() — bot page doesn't need the Firestore profile,
  // so we only wait for the fast Firebase auth state check (not the extra Firestore round-trip).
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();

  // Redirect unauthenticated users
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track whether we've already loaded history from Firestore (avoid race condition overwrite)
  const initializedRef = useRef(false);

  const personalityRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(db, 'users', user.uid, 'personality', 'personality_data');
  }, [db, user]);

  const { data: personalityData, isLoading: personalityLoading } = useDoc<any>(personalityRef);

  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  // isRestoring: true while we haven't yet confirmed whether local cache or Firestore has data.
  // Prevents the language-selection screen from flashing (and being accidentally clicked)
  // before we know whether the user already has a chat history.
  const [isRestoring, setIsRestoring] = useState(true);

  // --- localStorage cache: restore instantly on remount/tab-switch/browser-close ---
  // Runs once on mount. localStorage survives browser close (unlike sessionStorage).
  // Keys are namespaced by userId to prevent cross-user leaks on shared devices.
  useEffect(() => {
    if (initializedRef.current) return;
    if (!user) return; // wait until auth is ready so we have the uid
    try {
      const key = `vera_chat_${user.uid}`;
      const cached = localStorage.getItem(key);
      const cachedLang = localStorage.getItem(`${key}_lang`) as 'en' | 'th' | null;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessionMessages(parsed);
          if (cachedLang) setSelectedLanguage(cachedLang);
          initializedRef.current = true;
          setIsRestoring(false);
          return;
        }
      }
    } catch {}
    // No local cache — let Firestore effect handle it (don't setIsRestoring yet)
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist messages to localStorage on every change
  useEffect(() => {
    if (!user || sessionMessages.length === 0) return;
    try {
      localStorage.setItem(`vera_chat_${user.uid}`, JSON.stringify(sessionMessages));
    } catch {}
  }, [sessionMessages, user]);

  // Persist selected language to localStorage
  useEffect(() => {
    if (!user || !selectedLanguage) return;
    try {
      localStorage.setItem(`vera_chat_${user.uid}_lang`, selectedLanguage);
    } catch {}
  }, [selectedLanguage, user]);

  // Load chat history from Firestore (fallback when localStorage has no cache).
  // IMPORTANT: must check personalityRef !== null — when user=null, useDoc returns
  // isLoading=false immediately, which would falsely trigger initialized=true before
  // the real Firestore subscription even starts.
  useEffect(() => {
    if (initializedRef.current) return;
    if (!personalityRef) return;      // user not ready, subscription not started
    if (personalityLoading) return;   // subscription started but hasn't responded yet
    if (personalityData?.chatHistory && personalityData.chatHistory.length > 0) {
      setSessionMessages(personalityData.chatHistory);
      setSelectedLanguage(personalityData.preferredLanguage === 'Thai' ? 'th' : 'en');
    }
    initializedRef.current = true;
    setIsRestoring(false); // Firestore has confirmed state — safe to show UI
  }, [personalityData, personalityLoading, personalityRef]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessionMessages, isAiThinking]);

  // Auto-resize textarea
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

  const handleLanguageSelect = (lang: 'en' | 'th') => {
    if (!user || !personalityRef) return;

    setSelectedLanguage(lang);
    const initialMsg = lang === 'en'
      ? "Hi! I'm Vera, your TrueVibe companion. I'm here to understand your unique energy. Ready to begin our vibe check?"
      : "สวัสดีค่ะ! ฉันคือ Vera เพื่อนคู่คิดของคุณ ฉันอยู่ที่นี่เพื่อทำความรู้จักพลังงานของคุณ พร้อมจะเริ่มกันหรือยังคะ?";

    const firstMsg = {
      role: 'model' as const,
      message: initialMsg,
      timestamp: new Date().toISOString()
    };

    setSessionMessages([firstMsg]);

    setDocumentNonBlocking(personalityRef, {
      id: 'personality_data',
      userId: user.uid,
      preferredLanguage: lang === 'th' ? 'Thai' : 'English',
      chatHistory: [firstMsg],
      lastAnalysisDate: new Date().toISOString()
    }, { merge: true });
  };

  const handleResetConversation = async () => {
    if (!user || !personalityRef) return;

    try {
      deleteDocumentNonBlocking(personalityRef);
      const userRef = doc(db, 'users', user.uid);
      updateDocumentNonBlocking(userRef, {
        profileCompleted: false,
        personalityProfile: null,
        topMatches: null,
        updatedAt: new Date().toISOString()
      });

      const requestsRef = collection(db, 'chat_requests');
      const qSender = query(requestsRef, where('senderId', '==', user.uid));
      const qReceiver = query(requestsRef, where('receiverId', '==', user.uid));
      const convsRef = collection(db, 'conversations');
      const qConvs = query(convsRef, where('participantIds', 'array-contains', user.uid));

      const [snap1, snap2, snap3] = await Promise.all([
        getDocs(qSender),
        getDocs(qReceiver),
        getDocs(qConvs)
      ]);

      snap1.forEach(d => deleteDocumentNonBlocking(doc(db, 'chat_requests', d.id)));
      snap2.forEach(d => deleteDocumentNonBlocking(doc(db, 'chat_requests', d.id)));
      snap3.forEach(d => deleteDocumentNonBlocking(doc(db, 'conversations', d.id)));

      initializedRef.current = false;
      setSessionMessages([]);
      setSelectedLanguage(null);
      setInput('');
      setIsRestoring(false);
      try {
        if (user) {
          localStorage.removeItem(`vera_chat_${user.uid}`);
          localStorage.removeItem(`vera_chat_${user.uid}_lang`);
        }
      } catch {}

      toast({
        title: "Profile Reset",
        description: "Your vibes have been cleared.",
      });
    } catch (e) {
      console.error("Reset failed", e);
    }
  };

  const handleRetry = () => {
    // Remove the last user message (which was added before the failed AI call)
    setSessionMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'user') return prev.slice(0, -1);
      return prev;
    });
    setAiError(null);
    if (lastMessage) {
      setInput(lastMessage);
      // Restore textarea height
      setTimeout(resizeTextarea, 0);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isAiThinking || !user || !personalityRef || !selectedLanguage) return;

    const currentMsg = input;
    const now = new Date().toISOString();
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setLastMessage(currentMsg);
    setAiError(null);
    setIsAiThinking(true);

    const newUserMsg = {
      role: 'user' as const,
      message: currentMsg,
      timestamp: now
    };

    addDocumentNonBlocking(collection(db, 'bot_chats'), {
      userId: user.uid,
      ...newUserMsg,
      timestamp: now
    });

    const updatedHistory = [...sessionMessages, newUserMsg];
    setSessionMessages(updatedHistory);

    updateDocumentNonBlocking(personalityRef, {
      chatHistory: updatedHistory,
      lastAnalysisDate: now
    });

    try {
      const response = await aiPersonalityInterview({
        chatHistory: sessionMessages.map(m => ({ role: m.role, message: m.message })),
        currentMessage: currentMsg,
        preferredLanguage: selectedLanguage === 'th' ? 'Thai' : 'English'
      });

      const aiMsg = {
        role: 'model' as const,
        message: response.response,
        timestamp: new Date().toISOString()
      };

      addDocumentNonBlocking(collection(db, 'bot_chats'), {
        userId: user.uid,
        ...aiMsg,
        timestamp: new Date().toISOString()
      });

      const finalHistory = [...updatedHistory, aiMsg];
      setSessionMessages(finalHistory);

      const updatePayload: any = {
        chatHistory: finalHistory,
        lastAnalysisDate: new Date().toISOString()
      };

      if (response.interviewComplete && response.personalityProfile) {
        updatePayload.personalityProfile = response.personalityProfile;
        const userRef = doc(db, 'users', user.uid);
        updateDocumentNonBlocking(userRef, {
          personalityProfile: response.personalityProfile,
          profileCompleted: true,
          updatedAt: new Date().toISOString()
        });

        toast({
          title: "Vibe Check Complete!",
          description: "Vera has analyzed your unique energy.",
        });
      }

      updateDocumentNonBlocking(personalityRef, updatePayload);
    } catch (error: any) {
      console.error("Vera AI error:", error);
      const msg = String(error?.message || error || '');
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

  // Only block on the fast Firebase auth check, not on Firestore profile
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
        {/* Loading state: show spinner while restoring from cache or waiting for Firestore.
            This prevents the language-selection screen from briefly flashing and being
            accidentally clicked, which would overwrite existing Firestore chat history. */}
        {isRestoring || personalityLoading ? (
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
            {/* Native scroll div — better mobile performance than Radix ScrollArea */}
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
    </div>
  );
}
