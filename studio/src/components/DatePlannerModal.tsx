"use client";

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ChatRequest } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'vera' | 'user';
  text: string;
}

interface DatePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ChatRequest;
  receiverName: string;
  receiverLocation?: string;
}

type Step = 'ask-location' | 'ask-time' | 'waiting';

export function DatePlannerModal({ isOpen, onClose, request, receiverName, receiverLocation }: DatePlannerModalProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('ask-location');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'vera',
      text: `Yes! 🎉 ${request.senderName} wants to go on a date with you! To plan the perfect one, I need a little info from both of you. First — what kind of place do you love for a first date? (e.g., cozy café, rooftop bar, park, beach, art gallery...)`,
    },
  ]);
  const [input, setInput] = useState('');
  const [locationPref, setLocationPref] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setStep('ask-location');
      setMessages([
        {
          role: 'vera',
          text: `Yes! 🎉 ${request.senderName} wants to go on a date with you! To plan the perfect one, I need a little info from both of you. First — what kind of place do you love for a first date? (e.g., cozy café, rooftop bar, park, beach, art gallery...)`,
        },
      ]);
      setInput('');
      setLocationPref('');
    }
  }, [isOpen, request.senderName]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');

    if (step === 'ask-location') {
      setLocationPref(userMessage);
      setMessages(prev => [
        ...prev,
        { role: 'user', text: userMessage },
        { role: 'vera', text: `Love that! And when are you usually free? Weekdays or weekends? Morning, afternoon, or evening? (e.g., "weekend mornings", "Saturday afternoons", "any weekday after 6 PM")` },
      ]);
      setStep('ask-time');
    } else if (step === 'ask-time') {
      const timePref = userMessage;
      setMessages(prev => [
        ...prev,
        { role: 'user', text: userMessage },
        { role: 'vera', text: `Perfect! I'll now ask ${request.senderName} the same questions. Once they respond, I'll brew up 3 amazing date ideas that work for both of you! 💕` },
      ]);
      setStep('waiting');

      updateDocumentNonBlocking(doc(db, 'chat_requests', request.id), {
        status: 'accepted',
        dateStatus: 'waiting_sender',
        receiverLocationPref: locationPref,
        receiverTimePref: timePref,
        ...(receiverLocation && { receiverActualLocation: receiverLocation }),
      });

      toast({
        title: "Preferences Saved! 🎉",
        description: `Waiting for ${request.senderName} to share their preferences too.`,
      });

      setTimeout(() => onClose(), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-lg border-none shadow-2xl p-0 bg-[#0F0819]/95 backdrop-blur-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary fill-current" />
            Plan Your Date with Vera
          </DialogTitle>
          <p className="text-white/40 text-xs font-bold mt-1">AI-powered date planning</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 animate-in slide-in-from-bottom-2",
                msg.role === 'user' && "flex-row-reverse"
              )}
            >
              {msg.role === 'vera' && (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-primary fill-current" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-medium max-w-[80%] leading-relaxed",
                  msg.role === 'vera'
                    ? "bg-white/10 text-white rounded-tl-none"
                    : "bg-primary/30 text-white rounded-tr-none ml-auto"
                )}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {step === 'waiting' && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-primary font-black text-sm">
                <Clock className="w-5 h-5 animate-pulse" />
                Waiting for {request.senderName}...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-white/10 shrink-0">
          {(step === 'ask-location' || step === 'ask-time') && (
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={step === 'ask-location' ? "Your favorite date spot type..." : "Your available times..."}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-full h-11"
                autoFocus
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim()}
                className="truevibe-pill-button h-11 w-11 p-0 shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
          {step === 'waiting' && (
            <div className="h-11 flex items-center justify-center gap-2 text-white/40 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>Your preferences saved!</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
