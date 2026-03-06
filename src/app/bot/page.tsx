
"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrainCircuit, Send, Sparkles, RefreshCw, Trash2 } from 'lucide-react';
import { aiPersonalityInterview } from '@/ai/flows/ai-personality-interview';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AIProfileBot() {
  const { profile, user } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Memoize the personality data path
  const personalityRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(db, 'user_profiles', user.uid, 'personality', 'personality_data');
  }, [db, user]);

  const { data: personalityData, isLoading: isDataLoading } = useDoc<any>(personalityRef);

  // Derived messages from Firestore state
  const messages = useMemo(() => {
    if (!personalityData?.chatHistory || personalityData.chatHistory.length === 0) {
      return [{ role: 'model' as const, message: "Hi! I'm HarmonyAI. I'll help you discover your dating personality. Ready to start?" }];
    }
    return personalityData.chatHistory;
  }, [personalityData]);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || !user || !personalityRef) return;

    const currentMsg = input;
    setInput('');
    setLoading(true);

    // 1. Prepare history for AI
    const chatHistoryForAI = messages.map(m => ({ role: m.role, message: m.message }));
    
    // 2. Optimistically update Firestore with user message
    const updatedHistory = [...messages, { 
      role: 'user' as const, 
      message: currentMsg, 
      timestamp: new Date().toISOString() 
    }];

    try {
      // Update Firestore immediately (Optimistic UI)
      await setDoc(personalityRef, {
        id: 'personality_data',
        userId: user.uid,
        chatHistory: updatedHistory,
        lastAnalysisDate: new Date().toISOString()
      }, { merge: true });

      // 3. Get AI response
      const response = await aiPersonalityInterview({
        chatHistory: chatHistoryForAI,
        currentMessage: currentMsg
      });

      // 4. Update Firestore with AI response
      const finalHistory = [...updatedHistory, { 
        role: 'model' as const, 
        message: response.response, 
        timestamp: new Date().toISOString() 
      }];

      const updatePayload: any = {
        chatHistory: finalHistory,
        lastAnalysisDate: new Date().toISOString()
      };

      if (response.interviewComplete && response.personalityProfile) {
        Object.assign(updatePayload, response.personalityProfile);
        
        // Also update the main profile status
        const userRef = doc(db, 'user_profiles', user.uid);
        updateDoc(userRef, {
          personalityProfile: response.personalityProfile,
          updatedAt: new Date().toISOString()
        });
      }

      await updateDoc(personalityRef, updatePayload);

      if (response.interviewComplete) {
        setTimeout(() => {
          router.push('/matches');
        }, 3000);
      }
    } catch (error) {
      const permissionError = new FirestorePermissionError({
        path: personalityRef.path,
        operation: 'write',
        requestResourceData: { chatHistory: updatedHistory }
      });
      errorEmitter.emit('permission-error', permissionError);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!user || !personalityRef) return;
    if (!confirm("Are you sure you want to restart your personality interview? This will clear your current progress.")) return;

    try {
      await deleteDoc(personalityRef);
      // Main profile update to reflect reset
      const userRef = doc(db, 'user_profiles', user.uid);
      await updateDoc(userRef, {
        personalityProfile: null,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
       const permissionError = new FirestorePermissionError({
        path: personalityRef.path,
        operation: 'delete'
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-screen flex flex-col p-4 md:pt-24 relative">
      <Navigation />
      
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-2xl">
            <BrainCircuit className="text-primary w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">HarmonyAI Interview</h1>
            <p className="text-xs text-muted-foreground">Discovering the real you</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-xl text-muted-foreground hover:text-destructive gap-2"
          onClick={handleReset}
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Reset Interview</span>
        </Button>
      </div>

      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-border overflow-hidden flex flex-col mb-24 md:mb-6">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={cn(
                "flex flex-col max-w-[85%]",
                m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}>
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed",
                  m.role === 'user' 
                    ? "bg-primary text-white rounded-tr-none shadow-sm" 
                    : "bg-muted text-foreground rounded-tl-none border border-border"
                )}>
                  {m.message}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-primary text-xs animate-pulse font-medium ml-2">
                <Sparkles className="w-3 h-3" /> Harmony is mirroring your style...
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background/50">
          <div className="relative flex items-center">
            <Input 
              placeholder="Type your answer..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="pr-12 rounded-2xl h-12 bg-white"
              disabled={loading}
            />
            <Button 
              size="icon" 
              className="absolute right-1 rounded-xl bg-primary"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
