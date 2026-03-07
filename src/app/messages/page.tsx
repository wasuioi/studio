
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Lock, Send, ShieldAlert, CheckCircle2, Search, Info, MessageCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { 
  useFirestore, 
  useCollection, 
  useDoc,
  useMemoFirebase, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking 
} from '@/firebase';
import { collection, query, where, orderBy, doc, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';

function ConversationListItem({ conversation, currentUserId, isActive, onClick }: { 
  conversation: any, 
  currentUserId: string, 
  isActive: boolean,
  onClick: () => void 
}) {
  const db = useFirestore();
  const otherParticipantId = conversation.participantIds.find((id: string) => id !== currentUserId);
  
  const profileRef = useMemoFirebase(() => {
    if (!otherParticipantId) return null;
    return doc(db, 'user_profiles', otherParticipantId);
  }, [db, otherParticipantId]);

  const { data: profile } = useDoc<any>(profileRef);

  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-3xl transition-all",
        isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="w-14 h-14 rounded-2xl shadow-sm border border-border/50">
          <AvatarImage src={profile?.photoURL} />
          <AvatarFallback className="bg-muted text-muted-foreground font-bold">
            {profile?.displayName?.[0] || profile?.name?.[0] || 'H'}
          </AvatarFallback>
        </Avatar>
        {profile?.isVerified && (
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-md">
            <CheckCircle2 className="w-4 h-4 text-verified fill-verified text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 text-left overflow-hidden">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-sm truncate">{profile?.displayName || profile?.name || 'Harmony User'}</span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <p className="text-xs truncate text-muted-foreground/80 leading-tight">
          {conversation.lastMessage || "Start a connection..."}
        </p>
      </div>
    </button>
  );
}

export default function MessagesPage() {
  const { profile, user, loading } = useAuth();
  const db = useFirestore();
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const isVerified = useMemo(() => {
    return profile?.isVerified || profile?.verificationStatus === 'verified';
  }, [profile?.isVerified, profile?.verificationStatus]);

  const convQuery = useMemoFirebase(() => {
    if (!user?.uid || !isVerified) return null;
    return query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );
  }, [db, user?.uid, isVerified]);

  const { data: conversations, isLoading: convLoading } = useCollection(convQuery);

  const messagesQuery = useMemoFirebase(() => {
    if (!activeConversation?.id || !isVerified) return null;
    return query(
      collection(db, 'conversations', activeConversation.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
  }, [db, activeConversation?.id, isVerified]);

  const { data: messages } = useCollection(messagesQuery);

  const otherParticipantId = activeConversation?.participantIds.find((id: string) => id !== user?.uid);
  const activeChatProfileRef = useMemoFirebase(() => {
    if (!otherParticipantId) return null;
    return doc(db, 'user_profiles', otherParticipantId);
  }, [db, otherParticipantId]);
  const { data: activeChatProfile } = useDoc<any>(activeChatProfileRef);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !user || !activeConversation || !isVerified) return;

    const messageData = {
      senderId: user.uid,
      text: messageText,
      createdAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(
      collection(db, 'conversations', activeConversation.id, 'messages'),
      messageData
    );

    updateDocumentNonBlocking(doc(db, 'conversations', activeConversation.id), {
      lastMessage: messageText,
      updatedAt: new Date().toISOString(),
    });

    setMessageText('');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (profile && !isVerified) {
    return (
      <div className="flex flex-col h-screen max-w-2xl mx-auto items-center justify-center p-6 text-center bg-background">
        <Navigation />
        <Card className="p-10 rounded-[3.5rem] shadow-2xl border-none space-y-8 bg-white">
          <div className="relative mx-auto w-28 h-28 bg-unverified/10 rounded-full flex items-center justify-center animate-pulse">
            <Lock className="w-14 h-14 text-unverified" />
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-lg">
              <ShieldAlert className="w-10 h-10 text-unverified" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black">Secure Zone</h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
              Messaging is exclusive to verified members. This simple step keeps HarmonyAI safe and genuine.
            </p>
          </div>
          <Link href="/verification" className="block w-full">
            <Button className="w-full h-16 rounded-[2rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/30">
              Verify My Identity
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-w-7xl mx-auto bg-background md:pt-16 pb-20 md:pb-0 overflow-hidden relative">
      <Navigation />

      {/* Conversations List */}
      <div className={cn(
        "w-full md:w-80 lg:w-[400px] border-r flex flex-col bg-white transition-all duration-300",
        activeConversation && "hidden md:flex"
      )}>
        <div className="p-8 pb-4">
          <h1 className="text-3xl font-black mb-6">Messages</h1>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input className="pl-12 rounded-2xl bg-muted/40 border-none h-12 focus-visible:ring-primary/20" placeholder="Search conversations" />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="px-4 pb-12 space-y-1">
            {conversations?.map((conv) => (
              <ConversationListItem 
                key={conv.id} 
                conversation={conv} 
                currentUserId={user?.uid || ''}
                isActive={activeConversation?.id === conv.id}
                onClick={() => setActiveConversation(conv)}
              />
            ))}
            {!convLoading && (!conversations || conversations.length === 0) && (
              <div className="text-center py-20 px-8">
                <div className="bg-muted rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                  <MessageCircle className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-lg mb-2">No messages yet</h3>
                <p className="text-sm text-muted-foreground">Matches will appear here once you both connect!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-white",
        !activeConversation && "hidden md:flex items-center justify-center text-center p-12 bg-muted/20"
      )}>
        {!activeConversation ? (
          <div className="max-w-sm animate-in fade-in zoom-in duration-700">
            <div className="bg-primary/10 p-10 rounded-[3rem] w-32 h-32 flex items-center justify-center mx-auto mb-8 shadow-inner">
              <Sparkles className="w-16 h-16 text-primary/40" />
            </div>
            <h2 className="text-3xl font-black mb-4">Your Connections</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Select a conversation to start exploring your harmony. Real connections take time and genuine conversation.
            </p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 md:px-8 border-b flex items-center justify-between bg-white/95 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden rounded-full hover:bg-muted" 
                  onClick={() => setActiveConversation(null)}
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
                <div className="relative">
                  <Avatar className="w-12 h-12 rounded-[1rem] shadow-sm">
                    <AvatarImage src={activeChatProfile?.photoURL} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {activeChatProfile?.displayName?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight flex items-center gap-1.5">
                    {activeChatProfile?.displayName || activeChatProfile?.name || 'Harmony Member'}
                    {activeChatProfile?.isVerified && <CheckCircle2 className="w-4 h-4 text-verified fill-verified text-white" />}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Active Now</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Info className="w-6 h-6 text-muted-foreground" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6 md:px-12" ref={scrollRef}>
              <div className="space-y-8 max-w-4xl mx-auto">
                <div className="flex flex-col items-center justify-center py-10 space-y-4 opacity-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Beginning of your match</p>
                  <div className="h-px w-20 bg-muted" />
                </div>

                {messages?.map((m) => (
                  <div key={m.id} className={cn(
                    "flex flex-col max-w-[85%] md:max-w-[70%] animate-in slide-in-from-bottom-2 duration-400",
                    m.senderId === user?.uid ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "p-5 rounded-[2rem] text-sm leading-relaxed shadow-sm",
                      m.senderId === user?.uid 
                        ? "bg-primary text-white rounded-tr-none shadow-primary/20" 
                        : "bg-muted/40 text-foreground rounded-tl-none border border-border/50"
                    )}>
                      {m.text}
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground/60 mt-2 px-2 uppercase">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-6 md:px-12 md:pb-8 pt-0">
              <div className="relative flex items-center gap-3 bg-muted/30 p-2 rounded-[2.5rem] focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <Input 
                  placeholder="Share your thoughts..." 
                  className="rounded-full h-12 bg-transparent border-none shadow-none text-base pr-14"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button 
                  size="icon" 
                  className="absolute right-3 rounded-full bg-primary w-10 h-10 shadow-lg shadow-primary/20 active:scale-90 transition-all"
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-[9px] text-center mt-3 text-muted-foreground font-medium uppercase tracking-tighter">
                End-to-end encrypted connection
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
