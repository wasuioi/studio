"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Sparkles, Send, Zap, Loader2, Star, Globe, RotateCcw } from 'lucide-react';
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
import { useRouter } from 'next/navigation';
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
  const { user, loading } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'th' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const personalityRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(db, 'users', user.uid, 'personality', 'personality_data');
  }, [db, user]);

  const { data: personalityData } = useDoc<any>(personalityRef);

  const [sessionMessages, setSessionMessages] = useState<any[]>([]);

  useEffect(() => {
    if (personalityData?.chatHistory && personalityData.chatHistory.length > 0) {
      setSessionMessages(personalityData.chatHistory);
      setSelectedLanguage(personalityData.preferredLanguage === 'Thai' ? 'th' : 'en');
    }
  }, [personalityData]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [sessionMessages, isAiThinking]);

  const handleLanguageSelect = (lang: 'en' | 'th') => {
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

    if (personalityRef && user) {
      setDocumentNonBlocking(personalityRef, {
        id: 'personality_data',
        userId: user.uid,
        preferredLanguage: lang === 'th' ? 'Thai' : 'English',
        chatHistory: [firstMsg],
        lastAnalysisDate: new Date().toISOString()
      }, { merge: true });
    }
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

      setSessionMessages([]);
      setSelectedLanguage(null);
      setInput('');

      toast({
        title: "Profile Reset",
        description: "Your vibes have been cleared.",
      });
    } catch (e) {
      console.error("Reset failed", e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isAiThinking || !user || !personalityRef || !selectedLanguage) return;

    const currentMsg = input;
    const now = new Date().toISOString();
    setInput('');
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
    } catch (error) {
      toast({
        variant: "destructive",
        title: "AI Error",
        description: "Vera encountered a technical issue.",
      });
    } finally {
      setIsAiThinking(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto min-h-screen flex flex-col p-4 relative">
      <Navigation />
      
      <div className="flex items-center justify-between mb-6 px-2 mt-8">
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

      <div className="flex-1 glass-card rounded-[2.5rem] overflow-hidden flex flex-col mb-20 md:mb-8 relative h-[600px] md:h-[700px]">
        {!selectedLanguage ? (
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
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-6 max-w-xl mx-auto pb-10">
                {sessionMessages.map((m, i) => (
                  <div key={i} className={cn(
                    "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-4 duration-500",
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
              </div>
            </ScrollArea>

            <div className="p-4 md:p-6 bg-black/20 border-t border-white/10">
              <div className="relative flex items-center gap-3 max-w-xl mx-auto">
                <Input 
                  placeholder="Message Vera..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="rounded-full h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-primary/40 px-6"
                  disabled={isAiThinking}
                />
                <Button 
                  size="icon" 
                  className="shrink-0 w-12 h-12 rounded-full truevibe-pill-button px-0"
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
