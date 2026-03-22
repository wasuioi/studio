"use client";

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Calendar, MapPin, Clock, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiDatePlanner } from '@/ai/flows/ai-date-planner';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { ChatRequest } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'vera' | 'user';
  text: string;
}

interface DateOption {
  location: string;
  dateTime: string;
  scheduledFor: string;
  description: string;
}

interface SenderDatePlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ChatRequest;
  senderName: string;
  senderLocation?: string;
}

type Step = 'ask-location' | 'ask-time' | 'suggesting' | 'options' | 'confirmed';

export function SenderDatePlannerModal({ isOpen, onClose, request, senderName, senderLocation }: SenderDatePlannerModalProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('ask-location');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'vera',
      text: `Great news! 🎉 ${request.receiverName || 'Your match'} accepted your date invite and shared their preferences. Now I need yours to brew up the perfect date plan! What kind of place do you love for a first date? (e.g., cozy café, rooftop bar, park, beach, art gallery...)`,
    },
  ]);
  const [input, setInput] = useState('');
  const [locationPref, setLocationPref] = useState('');
  const [options, setOptions] = useState<DateOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<DateOption | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, options]);

  useEffect(() => {
    if (isOpen) {
      setStep('ask-location');
      setMessages([
        {
          role: 'vera',
          text: `Great news! 🎉 ${request.receiverName || 'Your match'} accepted your date invite and shared their preferences. Now I need yours to brew up the perfect date plan! What kind of place do you love for a first date? (e.g., cozy café, rooftop bar, park, beach, art gallery...)`,
        },
      ]);
      setInput('');
      setLocationPref('');
      setOptions([]);
      setSelectedOption(null);
    }
  }, [isOpen, request.receiverName]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');

    if (step === 'ask-location') {
      setLocationPref(userMessage);
      setMessages(prev => [
        ...prev,
        { role: 'user', text: userMessage },
        { role: 'vera', text: `Love it! And when are you usually free? Weekdays or weekends? Morning, afternoon, or evening? (e.g., "weekend mornings", "Saturday afternoons", "any weekday after 6 PM")` },
      ]);
      setStep('ask-time');
    } else if (step === 'ask-time') {
      const timePref = userMessage;
      setMessages(prev => [
        ...prev,
        { role: 'user', text: userMessage },
        { role: 'vera', text: `Perfect! Let me combine both your preferences and find 3 amazing date ideas... ✨` },
      ]);
      setStep('suggesting');

      try {
        const result = await aiDatePlanner({
          senderName,
          receiverName: request.receiverName || 'your match',
          senderLocationPref: locationPref,
          senderTimePref: timePref,
          receiverLocationPref: request.receiverLocationPref || '',
          receiverTimePref: request.receiverTimePref || '',
          senderActualLocation: senderLocation,
          receiverActualLocation: request.receiverActualLocation,
          currentDateISO: new Date().toISOString().split('T')[0],
        });

        setOptions(result.options);
        setMessages(prev => [
          ...prev,
          { role: 'vera', text: result.message },
        ]);

        // Save sender prefs + actual location
        updateDocumentNonBlocking(doc(db, 'chat_requests', request.id), {
          senderLocationPref: locationPref,
          senderTimePref: timePref,
          ...(senderLocation && { senderActualLocation: senderLocation }),
        });

        setStep('options');
      } catch {
        setMessages(prev => [
          ...prev,
          { role: 'vera', text: `Oops, something went wrong! Please try again.` },
        ]);
        setStep('ask-location');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectOption = (option: DateOption) => {
    setSelectedOption(option);
  };

  const handleConfirm = () => {
    if (!selectedOption) return;

    updateDocumentNonBlocking(doc(db, 'chat_requests', request.id), {
      dateStatus: 'planned',
      suggestedLocation: selectedOption.location,
      suggestedDateTime: selectedOption.dateTime,
      scheduledFor: selectedOption.scheduledFor,
    });

    setMessages(prev => [
      ...prev,
      { role: 'vera', text: `Your date is set! 🎉 Both of you will get a reminder 1 day before. Can't wait! 💕` },
    ]);
    setStep('confirmed');

    toast({
      title: "Date Confirmed! 🎉",
      description: `${selectedOption.dateTime} at ${selectedOption.location}`,
    });

    setTimeout(() => onClose(), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-lg border-none shadow-2xl p-0 bg-[#0F0819]/95 backdrop-blur-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary fill-current" />
            Complete Your Date Plan
          </DialogTitle>
          <p className="text-white/40 text-xs font-bold mt-1">Vera is combining both your preferences</p>
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

          {step === 'suggesting' && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              </div>
              <div className="bg-white/10 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-white/60">
                Vera is planning...
              </div>
            </div>
          )}

          {(step === 'options' || step === 'confirmed') && options.length > 0 && (
            <div className="space-y-3 mt-2">
              {options.map((opt, idx) => {
                const isSelected = selectedOption?.scheduledFor === opt.scheduledFor;
                return (
                  <button
                    key={idx}
                    onClick={() => step === 'options' && handleSelectOption(opt)}
                    className={cn(
                      "w-full text-left rounded-2xl p-4 border transition-all",
                      isSelected
                        ? "bg-primary/20 border-primary shadow-lg shadow-primary/20"
                        : "bg-white/5 border-white/10 hover:border-primary/40 hover:bg-white/10",
                      step === 'confirmed' && "cursor-default"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-primary font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Option {idx + 1}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2 text-white text-sm font-semibold">
                        <Clock className="w-3.5 h-3.5 mt-0.5 text-primary/70 shrink-0" />
                        <span>{opt.dateTime}</span>
                      </div>
                      <div className="flex items-start gap-2 text-white/80 text-sm">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 text-primary/70 shrink-0" />
                        <span>{opt.location}</span>
                      </div>
                      <p className="text-white/50 text-xs leading-relaxed pl-5">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 'confirmed' && (
            <div className="flex justify-center py-2">
              <div className="flex items-center gap-2 text-green-400 font-black">
                <CheckCircle2 className="w-5 h-5" /> Date Confirmed!
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
          {step === 'options' && (
            <Button
              onClick={handleConfirm}
              disabled={!selectedOption}
              className="truevibe-pill-button w-full h-12 font-black text-base"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {selectedOption ? 'Confirm This Date!' : 'Pick a date above'}
            </Button>
          )}
          {(step === 'suggesting' || step === 'confirmed') && (
            <div className="h-11 flex items-center justify-center">
              {step === 'suggesting' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
