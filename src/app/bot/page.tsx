"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrainCircuit, Send, Sparkles } from 'lucide-react';
import { aiPersonalityInterview, type AiPersonalityInterviewOutput } from '@/ai/flows/ai-personality-interview';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useRouter } from 'next/navigation';

export default function AIProfileBot() {
  const { profile } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'model', message: string }>>([
    { role: 'model', message: "Hi! I'm HarmonyAI. I'll help you discover your dating personality. Ready to start?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const currentMsg = input;
    setInput('');
    setLoading(true);

    const newMessages = [...messages, { role: 'user' as const, message: currentMsg }];
    setMessages(newMessages);

    try {
      const response = await aiPersonalityInterview({
        chatHistory: messages,
        currentMessage: currentMsg
      });

      setMessages(prev => [...prev, { role: 'model', message: response.response }]);

      if (response.interviewComplete && response.personalityProfile && profile) {
        // Save the profile to Firestore
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, {
          personalityProfile: response.personalityProfile
        });
        
        setMessages(prev => [...prev, { 
          role: 'model', 
          message: "Amazing! I've built your profile. You can now see matched profiles that fit your values." 
        }]);

        setTimeout(() => {
          router.push('/matches');
        }, 2000);
      }
    } catch (error) {
      console.error("AI Bot Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-screen flex flex-col p-4 md:pt-24 relative">
      <Navigation />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/20 p-2 rounded-2xl">
          <BrainCircuit className="text-primary w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">HarmonyAI Interview</h1>
          <p className="text-xs text-muted-foreground">Discovering the real you</p>
        </div>
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
                    ? "bg-primary text-white rounded-tr-none" 
                    : "bg-muted text-foreground rounded-tl-none border border-border"
                )}>
                  {m.message}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-primary text-xs animate-pulse font-medium ml-2">
                <Sparkles className="w-3 h-3" /> Harmony is thinking...
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
            />
            <Button 
              size="icon" 
              className="absolute right-1 rounded-xl bg-primary"
              onClick={handleSend}
              disabled={loading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}