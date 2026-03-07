
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Lock, Send, MessageCircle, ArrowLeft, Loader2, Crown, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { 
  useFirestore, 
  useCollection, 
  useDoc,
  useMemoFirebase, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, query, where, orderBy, doc, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { UpgradeModal } from '@/components/UpgradeModal';
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

// Static lookup for simulated profiles to ensure they display correctly in the chat list
const SIM_PROFILES: Record<string, { name: string; photo: string }> = {
  'sim_1': { name: 'Jason', photo: 'https://picsum.photos/seed/jason1/600/800' },
  'sim_2': { name: 'Leo', photo: 'https://picsum.photos/seed/leo2/600/800' },
  'sim_3': { name: 'Tim', photo: 'https://picsum.photos/seed/tim3/600/800' },
  'sim_4': { name: 'Mary', photo: 'https://picsum.photos/seed/mary4/600/800' },
  'sim_5': { name: 'Tania', photo: 'https://picsum.photos/seed/tania5/600/800' },
  'sim_6': { name: 'Su', photo: 'https://picsum.photos/seed/su6/600/800' },
};

function ConversationListItem({ conversation, currentUserId, isActive, onClick }: { 
  conversation: any, 
  currentUserId: string, 
  isActive: boolean,
  onClick: () => void 
}) {
  const db = useFirestore();
  const otherParticipantId = conversation.participantIds.find((id: string) => id !== currentUserId);
  
  // Try to fetch real user profile
  const profileRef = useMemoFirebase(() => {
    if (!otherParticipantId || otherParticipantId.startsWith('sim_')) return null;
    return doc(db, 'users', otherParticipantId);
  }, [db, otherParticipantId]);
  
  const { data: profile } = useDoc<any>(profileRef);

  // Fallback to simulated data if it's a sim account
  const simData = otherParticipantId ? SIM_PROFILES[otherParticipantId] : null;
  const displayName = profile?.displayName || simData?.name || 'TrueVibe User';
  const photoURL = profile?.photoURL || simData?.photo || '';

  return (
    <button 
      onClick={onClick} 
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-[2rem] transition-all duration-300", 
        isActive ? "bg-primary/10 text-primary shadow-inner" : "hover:bg-muted/50"
      )}
    >
      <Avatar className="w-14 h-14 rounded-2xl border-2 border-background shadow-sm">
        <AvatarImage src={photoURL} className="object-cover" />
        <AvatarFallback className="bg-primary/5 text-primary font-black">{displayName[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 text-left overflow-hidden">
        <div className="flex justify-between items-center mb-0.5">
          <p className="font-black text-sm truncate">{displayName}</p>
          {otherParticipantId?.startsWith('sim_') && (
            <Sparkles className="w-3 h-3 text-primary/40" />
          )}
        </div>
        <p className="text-xs truncate text-muted-foreground font-medium">{conversation.lastMessage || "Start vibing..."}</p>
      </div>
    </button>
  );
}

export default function MessagesPage() {
  const { profile, user, loading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isVerified = profile?.identityVerified;
  const isSubscriber = profile?.tier === 'premium' || profile?.tier === 'lite';

  // Fetch all conversations for the user
  const convQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(db, 'conversations'), 
      where('participantIds', 'array-contains', user.uid), 
      orderBy('updatedAt', 'desc')
    );
  }, [db, user?.uid]);

  const { data: conversations, isLoading: convLoading } = useCollection(convQuery);

  // Fetch messages for active chat
  const messagesQuery = useMemoFirebase(() => {
    if (!activeConversation?.id) return null;
    return query(
      collection(db, 'conversations', activeConversation.id, 'messages'), 
      orderBy('createdAt', 'asc'), 
      limit(100)
    );
  }, [db, activeConversation?.id]);

  const { data: messages } = useCollection(messagesQuery);

  const otherParticipantId = activeConversation?.participantIds.find((id: string) => id !== user?.uid);
  
  const activeChatProfileRef = useMemoFirebase(() => {
    if (!otherParticipantId || otherParticipantId.startsWith('sim_')) return null;
    return doc(db, 'users', otherParticipantId);
  }, [db, otherParticipantId]);
  
  const { data: activeChatProfile } = useDoc<any>(activeChatProfileRef);
  
  const simData = otherParticipantId ? SIM_PROFILES[otherParticipantId] : null;
  const activeDisplayName = activeChatProfile?.displayName || simData?.name || 'TrueVibe User';
  const activePhotoURL = activeChatProfile?.photoURL || simData?.photo || '';

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !user || !activeConversation || !isVerified || !isSubscriber) return;
    
    const msgData = { 
      senderId: user.uid, 
      text: messageText, 
      createdAt: new Date().toISOString() 
    };

    addDocumentNonBlocking(collection(db, 'conversations', activeConversation.id, 'messages'), msgData);
    updateDocumentNonBlocking(doc(db, 'conversations', activeConversation.id), { 
      lastMessage: messageText, 
      updatedAt: new Date().toISOString() 
    });
    
    setMessageText('');
  };

  const handleDeleteConversation = () => {
    if (!activeConversation || !user) return;
    
    deleteDocumentNonBlocking(doc(db, 'conversations', activeConversation.id));
    
    setActiveConversation(null);
    toast({
      title: "Conversation Deleted",
      description: "You've removed this chat from your list.",
    });
  };

  if (loading || convLoading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-primary w-10 h-10" />
    </div>
  );

  // Security Gate: Face match required to even access the messages tab
  if (profile && !isVerified) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center bg-background">
        <Navigation />
        <Card className="p-12 rounded-[3.5rem] shadow-2xl border-none space-y-8 bg-white max-w-md animate-in zoom-in-95">
          <div className="bg-unverified/10 p-8 rounded-full inline-block animate-bounce">
            <Lock className="w-16 h-16 text-unverified" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight">Vibe Security</h1>
            <p className="text-muted-foreground font-medium">To keep TrueVibe safe, you must complete identity verification before chatting with matches.</p>
          </div>
          <Link href="/verification" className="block w-full">
            <Button className="w-full h-16 rounded-[1.5rem] text-xl font-black truevibe-gradient border-none shadow-xl shadow-primary/20">Verify Now</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-w-7xl mx-auto bg-background md:pt-20 pb-20 md:pb-0 overflow-hidden relative">
      <Navigation />
      
      {/* Sidebar - Conversation List */}
      <div className={cn(
        "w-full md:w-96 border-r flex flex-col bg-white/50 backdrop-blur-xl transition-all duration-500", 
        activeConversation && "hidden md:flex"
      )}>
        <div className="p-8 pb-4">
          <h1 className="text-4xl font-black tracking-tight">Messages</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Your Vibe Connections</p>
        </div>
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-2 pb-10">
            {conversations?.map(conv => (
              <ConversationListItem 
                key={conv.id} 
                conversation={conv} 
                currentUserId={user?.uid || ''} 
                isActive={activeConversation?.id === conv.id} 
                onClick={() => setActiveConversation(conv)} 
              />
            ))}
            {conversations?.length === 0 && (
              <div className="text-center py-32 px-10 space-y-4">
                <div className="bg-muted/50 p-6 rounded-full inline-block">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">No connections yet.<br/><Link href="/matches" className="text-primary hover:underline">Find matches now!</Link></p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-white", 
        !activeConversation && "hidden md:flex items-center justify-center text-center bg-muted/10"
      )}>
        {!activeConversation ? (
          <div className="p-12 animate-in fade-in duration-700">
            <div className="truevibe-gradient p-6 rounded-[2rem] inline-block shadow-2xl shadow-primary/20 mb-6">
              <MessageCircle className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">Select a Connection</h2>
            <p className="text-muted-foreground font-medium mt-2">Pick a chat to start sharing your vibes.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 md:p-6 border-b flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setActiveConversation(null)} className="md:hidden rounded-xl">
                  <ArrowLeft className="w-6 h-6" />
                </Button>
                <Avatar className="w-12 h-12 rounded-2xl shadow-sm border-2 border-background">
                  <AvatarImage src={activePhotoURL} className="object-cover" />
                  <AvatarFallback className="font-black bg-primary/5">{activeDisplayName[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-black text-lg tracking-tight">{activeDisplayName}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-verified rounded-full" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Connected</span>
                  </div>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-black">Delete Conversation?</AlertDialogTitle>
                    <AlertDialogDescription className="font-medium">
                      This will remove the chat from your list for good. You'll need to send a new vibe check to connect with {activeDisplayName} again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConversation} className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Chat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Messages List */}
            <ScrollArea className="flex-1 p-6 bg-muted/5" ref={scrollRef}>
              <div className="space-y-6 max-w-3xl mx-auto">
                {messages?.map((m, idx) => {
                  const isMe = m.senderId === user?.uid;
                  return (
                    <div 
                      key={m.id || idx} 
                      className={cn(
                        "flex flex-col max-w-[85%] animate-in slide-in-from-bottom-2 duration-300", 
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className={cn(
                        "p-4 px-6 rounded-[2rem] text-sm leading-relaxed font-medium shadow-sm", 
                        isMe 
                          ? "truevibe-gradient text-white rounded-tr-none" 
                          : "bg-white text-foreground rounded-tl-none border border-border/50"
                      )}>
                        {m.text}
                      </div>
                      <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mt-1.5 px-2">
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Input Area / Upgrade Gate */}
            {!isSubscriber ? (
              <div className="p-8 border-t bg-accent/50 text-center space-y-4">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  <Crown className="w-3 h-3 fill-current" /> Premium Feature
                </div>
                <h3 className="text-xl font-black">Ready to reply?</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">Upgrade your vibe plan to send unlimited messages and build deeper connections.</p>
                <Button 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="rounded-2xl h-14 px-10 font-black truevibe-gradient border-none shadow-xl shadow-primary/20"
                >
                  Unlock Messaging
                </Button>
              </div>
            ) : (
              <div className="p-6 border-t bg-white">
                <div className="max-w-3xl mx-auto relative flex items-center gap-3">
                  <Input 
                    placeholder="Type your message..." 
                    value={messageText} 
                    onChange={e => setMessageText(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                    className="rounded-2xl h-14 bg-muted/30 border-none shadow-inner px-6 text-base focus-visible:ring-primary/20" 
                  />
                  <Button 
                    size="icon" 
                    onClick={handleSendMessage} 
                    disabled={!messageText.trim()}
                    className="shrink-0 w-14 h-14 rounded-2xl truevibe-gradient hover:scale-105 transition-all shadow-lg border-none"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
        userId={user?.uid || ''} 
        featureName="Messaging" 
      />
    </div>
  );
}
