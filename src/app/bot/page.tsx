"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Zap, Loader2, Star } from 'lucide-react';
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
        message: "Hi! I'm Vera, your TrueVibe relationship companion. I'm here to understand your unique energy and help find your perfect match. Ready to vibe?" 
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
      </div>

      <div className="flex-1 bg-white rounded-[3rem] shadow-2xl shadow-primary/5 border border-border/50 overflow-hidden flex flex-col mb-24 md:mb-8">
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
                <Star className="w-3 h-3 fill-current" /> Vera is sensing...
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-6 border-t bg-background/30 backdrop-blur-sm">
          <div className="relative flex items-center gap-3">
            <Input 
              placeholder="Tell Vera about yourself..." 
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
      </div>
    </div>
  );
}