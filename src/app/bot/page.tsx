"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrainCircuit, Send, Sparkles, Loader2 } from 'lucide-react';
import { aiPersonalityInterview } from '@/ai/flows/ai-personality-interview';
import { doc, collection } from 'firebase/firestore';
import { 
  useFirestore, 
  useDoc, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  setDocumentNonBlocking,
  addDocumentNonBlocking
} from '@/firebase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function AIProfileBot() {
  const { user, loading } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const personalityRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(db, 'users', user.uid, 'personality', 'personality_data');
  }, [db, user]);

  const { data: personalityData } = useDoc<any>(personalityRef);

  // Local state for the current session UI
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);

  useEffect(() => {
    if (personalityData?.chatHistory) {
      setSessionMessages(personalityData.chatHistory);
    } else {
      setSessionMessages([{ 
        role: 'model' as const, 
        message: "Hi! I'm HarmonyAI. I'll help you discover your dating personality. Ready to start?" 
      }]);
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

  const handleSend = async () => {
    if (!input.trim() || isAiThinking || !user || !personalityRef) return;

    const currentMsg = input;
    const now = new Date().toISOString();
    setInput('');
    setIsAiThinking(true);

    const newUserMsg = { 
      role: 'user' as const, 
      message: currentMsg, 
      timestamp: now 
    };

    // Log to permanent history
    addDocumentNonBlocking(collection(db, 'bot_chats'), {
      userId: user.uid,
      ...newUserMsg
    });

    const updatedHistory = [...sessionMessages, newUserMsg];
    setSessionMessages(updatedHistory);

    // Update active session doc
    setDocumentNonBlocking(personalityRef, {
      id: 'personality_data',
      userId: user.uid,
      chatHistory: updatedHistory,
      lastAnalysisDate: now
    }, { merge: true });

    try {
      const response = await aiPersonalityInterview({
        chatHistory: sessionMessages.map(m => ({ role: m.role, message: m.message })),
        currentMessage: currentMsg
      });

      const aiMsg = { 
        role: 'model' as const, 
        message: response.response, 
        timestamp: new Date().toISOString() 
      };

      // Log AI response to permanent history
      addDocumentNonBlocking(collection(db, 'bot_chats'), {
        userId: user.uid,
        ...aiMsg
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
          title: "Profile Complete!",
          description: "HarmonyAI has analyzed your personality.",
        });
      }

      updateDocumentNonBlocking(personalityRef, updatePayload);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "AI Error",
        description: "Harmony encountered an issue. Please try again.",
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
    <div className="max-w-2xl mx-auto h-screen flex flex-col p-4 md:pt-24 relative">
      <Navigation />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-2xl">
            <BrainCircuit className="text-primary w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">HarmonyAI Interview</h1>
            <p className="text-xs text-muted-foreground">Discovering the real you</p>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-border overflow-hidden flex flex-col mb-24 md:mb-6">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {sessionMessages.map((m, i) => (
              <div key={i} className={cn(
                "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}>
                <div className={cn(
                  "p-4 rounded-3xl text-sm leading-relaxed",
                  m.role === 'user' 
                    ? "bg-primary text-white rounded-tr-none shadow-sm" 
                    : "bg-muted text-foreground rounded-tl-none border border-border"
                )}>
                  {m.message}
                </div>
              </div>
            ))}
            {isAiThinking && (
              <div className="flex items-center gap-2 text-primary text-xs animate-pulse font-medium ml-2">
                <Sparkles className="w-3 h-3" /> Harmony is thinking...
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background/50">
          <div className="relative flex items-center gap-2">
            <Input 
              placeholder="Type your answer..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="rounded-2xl h-12 bg-white border-none shadow-inner"
              disabled={isAiThinking}
            />
            <Button 
              size="icon" 
              className="shrink-0 rounded-xl bg-primary hover:bg-primary/90 transition-transform active:scale-95"
              onClick={handleSend}
              disabled={isAiThinking || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}