"use client";

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Lock, Send, ShieldAlert, CheckCircle2, Search, Info, MessageCircle, ArrowLeft } from 'lucide-react';
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

/**
 * Component to display a single conversation in the sidebar.
 * Fetches the other participant's profile for a personalized look.
 */
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
        "w-full flex items-center gap-3 p-4 rounded-3xl transition-all",
        isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted"
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="w-14 h-14 rounded-2xl">
          <AvatarImage src={profile?.photoURL} />
          <AvatarFallback>{profile?.displayName?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        {profile?.isVerified && (
          <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-verified" />
          </div>
        )}
      </div>
      <div className="flex-1 text-left overflow-hidden">
        <div className="flex justify-between items-center mb-0.5">
          <span className="font-bold text-sm truncate">{profile?.displayName || 'Harmony User'}</span>
          <span className="text-[10px] text-muted-foreground">
            {conversation.updatedAt ? new Date(conversation.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <p className="text-xs truncate text-muted-foreground">
          {conversation.lastMessage || "No messages yet"}
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

  // Robust check for verification status
  const isVerified = useMemo(() => {
    return profile?.isVerified || profile?.verificationStatus === 'verified';
  }, [profile?.isVerified, profile?.verificationStatus]);

  // Fetch conversations where current user is a participant
  // We use user?.uid and isVerified as dependencies to avoid flickering
  const convQuery = useMemoFirebase(() => {
    if (!user?.uid || !isVerified) return null;
    return query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );
  }, [db, user?.uid, isVerified]);

  const { data: conversations, isLoading: convLoading } = useCollection(convQuery);

  // Fetch messages for active conversation
  const messagesQuery = useMemoFirebase(() => {
    if (!activeConversation?.id || !isVerified) return null;
    return query(
      collection(db, 'conversations', activeConversation.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );
  }, [db, activeConversation?.id, isVerified]);

  const { data: messages } = useCollection(messagesQuery);

  // Fetch profile for the active chat header
  const otherParticipantId = activeConversation?.participantIds.find((id: string) => id !== user?.uid);
  const activeChatProfileRef = useMemoFirebase(() => {
    if (!otherParticipantId) return null;
    return doc(db, 'user_profiles', otherParticipantId);
  }, [db, otherParticipantId]);
  const { data: activeChatProfile } = useDoc<any>(activeChatProfileRef);

  const handleSendMessage = () => {
    if (!messageText.trim() || !user || !activeConversation) return;

    const messageData = {
      senderId: user.uid,
      text: messageText,
      createdAt: new Date().toISOString(),
    };

    // Add message to subcollection
    addDocumentNonBlocking(
      collection(db, 'conversations', activeConversation.id, 'messages'),
      messageData
    );

    // Update conversation last message and timestamp
    updateDocumentNonBlocking(doc(db, 'conversations', activeConversation.id), {
      lastMessage: messageText,
      updatedAt: new Date().toISOString(),
    });

    setMessageText('');
  };

  if (loading || (user && !profile && !loading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If profile exists but is not verified, show the lock screen
  if (profile && !isVerified) {
    return (
      <div className="flex flex-col h-screen max-w-2xl mx-auto items-center justify-center p-8 text-center bg-background">
        <Navigation />
        <Card className="p-10 rounded-[3rem] shadow-xl border-none space-y-6 bg-white">
          <div className="relative mx-auto w-24 h-24 bg-unverified/10 rounded-full flex items-center justify-center">
            <Lock className="w-12 h-12 text-unverified" />
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-md">
              <ShieldAlert className="w-8 h-8 text-unverified" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Verified Members Only</h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
              For safety, messaging is only available for verified users. This ensures a real community of genuine connections.
            </p>
          </div>
          <Link href="/verification" className="block w-full">
            <Button className="w-full h-14 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg">
              Verify My Identity
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-w-6xl mx-auto bg-background md:pt-16 pb-20 md:pb-0 overflow-hidden relative">
      <Navigation />

      {/* Conversations List */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r flex flex-col bg-white transition-all duration-300",
        activeConversation && "hidden md:flex"
      )}>
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-10 rounded-xl bg-muted/30 border-none" placeholder="Search" />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="px-3 pb-6 space-y-1">
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
              <div className="text-center py-12 text-muted-foreground px-6">
                <p className="text-sm">No conversations yet. Match with someone to start chatting!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-white",
        !activeConversation && "hidden md:flex items-center justify-center text-center p-12"
      )}>
        {!activeConversation ? (
          <div className="max-w-xs animate-in fade-in zoom-in duration-500">
            <div className="bg-primary/5 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-12 h-12 text-primary/40" />
            </div>
            <h2 className="text-xl font-bold mb-2">Select a Chat</h2>
            <p className="text-muted-foreground text-sm">Pick a match to start exploring your compatibility and building a connection.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden rounded-full" 
                  onClick={() => setActiveConversation(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-10 h-10 rounded-xl">
                  <AvatarImage src={activeChatProfile?.photoURL} />
                  <AvatarFallback>{activeChatProfile?.displayName?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-sm leading-tight flex items-center gap-1">
                    {activeChatProfile?.displayName || 'Harmony User'}
                    {activeChatProfile?.isVerified && <CheckCircle2 className="w-3 h-3 text-verified" />}
                  </h3>
                  {activeChatProfile?.isVerified && <span className="text-[10px] text-verified font-medium">Verified Match</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Info className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {messages?.map((m) => (
                  <div key={m.id} className={cn(
                    "flex flex-col max-w-[80%] animate-in slide-in-from-bottom-2 duration-300",
                    m.senderId === user?.uid ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "p-4 rounded-3xl text-sm leading-relaxed",
                      m.senderId === user?.uid 
                        ? "bg-primary text-white rounded-tr-none shadow-md shadow-primary/10" 
                        : "bg-muted/50 text-foreground rounded-tl-none border border-border"
                    )}>
                      {m.text}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-1 px-1">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                {(!messages || messages.length === 0) && (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground italic">Start of your conversation</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-6 pt-0">
              <div className="relative flex items-center gap-2">
                <Input 
                  placeholder="Say something nice..." 
                  className="rounded-2xl h-14 bg-muted/30 border-none shadow-inner pr-14"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button 
                  size="icon" 
                  className="absolute right-2 rounded-xl bg-primary w-10 h-10 shadow-lg active:scale-95 transition-transform"
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
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
