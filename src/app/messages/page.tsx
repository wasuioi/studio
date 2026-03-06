"use client";

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Lock, Send, ShieldAlert, CheckCircle2, Search, Info } from 'lucide-react';
import Link from 'next/link';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function MessagesPage() {
  const { profile } = useAuth();
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [message, setMessage] = useState('');

  // Mock conversation history
  const matches = [
    { id: 'm1', name: 'Elena', lastMsg: 'I love that place too!', time: '2m', unread: true, photo: PlaceHolderImages[0].imageUrl, verified: true },
    { id: 'm2', name: 'Marcus', lastMsg: 'Are you free this weekend?', time: '1h', unread: false, photo: PlaceHolderImages[1].imageUrl, verified: true },
    { id: 'm4', name: 'David', lastMsg: 'Great match scores!', time: '1d', unread: false, photo: PlaceHolderImages[3].imageUrl, verified: true },
  ];

  const chatMessages = [
    { id: 1, senderId: 'm1', text: "Hey! Harmony says we're a 98% match! That's insane.", time: '10:05 AM' },
    { id: 2, senderId: 'me', text: "I know! I was surprised too. I see you're into hiking?", time: '10:07 AM' },
    { id: 3, senderId: 'm1', text: "Yes! Every weekend. I love that place too!", time: '10:10 AM' },
  ];

  if (profile && !profile.isVerified) {
    return (
      <div className="flex flex-col h-screen max-w-2xl mx-auto items-center justify-center p-8 text-center bg-background">
        <Navigation />
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border-none space-y-6">
          <div className="relative mx-auto w-24 h-24 bg-unverified/10 rounded-full flex items-center justify-center">
            <Lock className="w-12 h-12 text-unverified" />
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-md">
              <ShieldAlert className="w-8 h-8 text-unverified" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Secure Zone</h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
              For safety reasons, messaging is only available for verified users. This helps us maintain a real community of genuine connections.
            </p>
          </div>
          <Link href="/verification" className="block">
            <Button className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg">
              Verify My Identity
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-w-6xl mx-auto bg-background md:pt-16 pb-20 md:pb-0 overflow-hidden">
      <Navigation />

      {/* List - hidden on mobile if chat is active */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r flex flex-col bg-white",
        activeMatch && "hidden md:flex"
      )}>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-10 rounded-xl bg-muted/30 border-none" placeholder="Search conversations" />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="px-3 pb-6 space-y-1">
            {matches.map((m) => (
              <button 
                key={m.id} 
                onClick={() => setActiveMatch(m)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-3xl transition-all",
                  activeMatch?.id === m.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-14 h-14 rounded-2xl">
                    <AvatarImage src={m.photo} className="object-cover" />
                    <AvatarFallback>{m.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-verified" />
                  </div>
                </div>
                <div className="flex-1 text-left overflow-hidden">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground">{m.time}</span>
                  </div>
                  <p className={cn(
                    "text-xs truncate",
                    m.unread ? "font-bold text-foreground" : "text-muted-foreground"
                  )}>
                    {m.lastMsg}
                  </p>
                </div>
                {m.unread && <div className="w-2.5 h-2.5 bg-primary rounded-full shrink-0" />}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-white",
        !activeMatch && "hidden md:flex items-center justify-center text-center p-12"
      )}>
        {!activeMatch ? (
          <div className="max-w-xs">
            <div className="bg-primary/5 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-12 h-12 text-primary/40" />
            </div>
            <h2 className="text-xl font-bold mb-2">Your Conversations</h2>
            <p className="text-muted-foreground text-sm">Select a match from the left to start chatting and explore your compatibility.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden rounded-full" 
                  onClick={() => setActiveMatch(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-10 h-10 rounded-xl">
                  <AvatarImage src={activeMatch.photo} className="object-cover" />
                  <AvatarFallback>{activeMatch.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-sm leading-tight flex items-center gap-1">
                    {activeMatch.name}
                    <CheckCircle2 className="w-3 h-3 text-verified" />
                  </h3>
                  <span className="text-[10px] text-verified font-medium">Online</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Info className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                <div className="text-center">
                  <span className="text-[10px] bg-muted px-3 py-1 rounded-full text-muted-foreground uppercase tracking-wider font-semibold">Today</span>
                </div>
                {chatMessages.map((m) => (
                  <div key={m.id} className={cn(
                    "flex flex-col max-w-[80%]",
                    m.senderId === 'me' ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "p-4 rounded-3xl text-sm",
                      m.senderId === 'me' 
                        ? "bg-primary text-white rounded-tr-none shadow-md shadow-primary/20" 
                        : "bg-muted/50 text-foreground rounded-tl-none border border-border"
                    )}>
                      {m.text}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1 px-1">{m.time}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-6 pt-0">
              <div className="relative flex items-center">
                <Input 
                  placeholder="Say something nice..." 
                  className="pr-12 rounded-2xl h-14 bg-muted/30 border-none"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <Button 
                  size="icon" 
                  className="absolute right-2 rounded-xl bg-primary w-10 h-10 shadow-lg"
                  onClick={() => {
                    if (message) {
                      // Logic would go here for Firestore
                      setMessage('');
                    }
                  }}
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

import { MessageCircle, ArrowLeft } from 'lucide-react';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}