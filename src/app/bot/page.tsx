
"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Sparkles, Send, Zap, Loader2, Star, Globe, RotateCcw, Trash2 } from 'lucide-react';
import { aiPersonalityInterview } from '@/ai/flows/ai-personality-interview';
import { doc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
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

  // Local state for the current session UI
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
      ? "Hi! I'm Vera, your TrueVibe relationship companion. I'm here to understand your unique energy and help find your perfect match. Ready to vibe?" 
      : "สวัสดีค่ะ! ฉันคือ Vera เพื่อนคู่คิดด้านความสัมพันธ์ของคุณ ฉันอยู่ที่นี่เพื่อทำความเข้าใจพลังงานที่เป็นเอกลักษณ์ของคุณและช่วยหาคู่ที่เหมาะสมที่สุดสำหรับคุณ พร้อมจะทำความรู้จักกันหรือยังคะ?";
    
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
      // 1. Delete personality data
      deleteDocumentNonBlocking(personalityRef);

      // 2. Reset the user's profile status and top matches
      const userRef = doc(db, 'users', user.uid);
      updateDocumentNonBlocking(userRef, {
        profileCompleted: false,
        personalityProfile: null,
        topMatches: null,
        updatedAt: new Date().toISOString()
      });

      // 3. AGGRESSIVE CLEANUP: Delete all chat requests and conversations
      // We do this to ensure simulated profiles like Tania reset to the "Message" state.
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

      // 4. Clear local state
      setSessionMessages([]);
      setSelectedLanguage(null);
      setInput('');

      toast({
        title: "Profile Deep Reset",
        description: "Your vibes and connections have been cleared. Start fresh with Vera!",
      });
    } catch (e) {
      console.error("Reset failed", e);
      toast({
        variant: "destructive",
        title: "Reset Error",
        description: "Could not fully clear connections. Some data may persist.",
      });
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
          description: "Vera has analyzed your personality profile.",
        });
      }

      updateDocumentNonBlocking(personalityRef, updatePayload);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "AI Connection Error",
        description: "Vera encountered a technical issue. Please try again.",
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
    <div className="max-w-2xl mx-auto h-screen flex flex-col p-4 md:pt-28 relative">
      <Navigation />
      
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-4">
          <div className="truevibe-gradient p-3 rounded-2xl shadow-lg">
            <Zap className="text-white w-6 h-6 fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Vera AI</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-verified rounded-full animate-pulse" />
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Active Analysis</p>
            </div>
          </div>
        </div>

        {selectedLanguage && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-destructive/10 hover:text-destructive transition-colors h-12 w-12 border border-border/50">
                <RotateCcw className="w-5 h-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-black tracking-tight">Reset Everything?</AlertDialogTitle>
                <AlertDialogDescription className="font-medium">
                  This will clear your current chat history, personality profile, AND all existing chat requests or matches. Vera will need to start from scratch.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetConversation} className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, Reset All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="flex-1 bg-white rounded-[3rem] shadow-2xl shadow-primary/5 border border-border/50 overflow-hidden flex flex-col mb-24 md:mb-8">
        {!selectedLanguage && sessionMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-8">
            <div className="bg-primary/10 p-6 rounded-full">
              <Globe className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight">Choose Your Language</h2>
              <p className="text-muted-foreground font-medium">Please select your preferred language to start chatting with Vera.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full max-sm:grid-cols-1 max-w-sm">
              <Button 
                onClick={() => handleLanguageSelect('en')}
                className="h-20 rounded-3xl text-lg font-black bg-white border-2 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-md"
              >
                🇺🇸 English
              </Button>
              <Button 
                onClick={() => handleLanguageSelect('th')}
                className="h-20 rounded-3xl text-lg font-black bg-white border-2 border-secondary/20 text-secondary hover:bg-secondary hover:text-white transition-all shadow-md"
              >
                🇹🇭 ภาษาไทย
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-6">
                {sessionMessages.map((m, i) => (
                  <div key={i} className={cn(
                    "flex flex-col max-w-[90%] animate-in fade-in slide-in-from-bottom-2 duration-500",
                    m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "p-5 rounded-[2rem] text-sm leading-relaxed font-medium",
                      m.role === 'user' 
                        ? "truevibe-gradient text-white rounded-tr-none shadow-md" 
                        : "bg-muted/50 text-foreground rounded-tl-none border border-border/50"
                    )}>
                      {m.message}
                    </div>
                  </div>
                ))}
                {isAiThinking && (
                  <div className="flex items-center gap-2 text-primary text-xs animate-pulse font-black uppercase tracking-widest ml-4">
                    <Star className="w-3 h-3 fill-current" /> {selectedLanguage === 'th' ? 'Vera กำลังประมวลผล...' : 'Vera is sensing...'}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-6 border-t bg-background/30 backdrop-blur-sm">
              <div className="relative flex items-center gap-3">
                <Input 
                  placeholder={selectedLanguage === 'th' ? "คุยกับ Vera เกี่ยวกับตัวคุณ..." : "Tell Vera about yourself..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="rounded-2xl h-14 bg-white border-none shadow-inner px-6 text-base focus-visible:ring-primary/20"
                  disabled={isAiThinking}
                />
                <Button 
                  size="icon" 
                  className="shrink-0 w-14 h-14 rounded-2xl truevibe-gradient hover:scale-105 transition-all duration-300 active:scale-95 shadow-lg border-none"
                  onClick={handleSend}
                  disabled={isAiThinking || !input.trim()}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
