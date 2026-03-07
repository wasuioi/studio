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
import { collection, query, where, orderBy, doc, limit, getDocs } from 'firebase/firestore';
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

// Static lookup for simulated profiles
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
  
  const profileRef = useMemoFirebase(() => {
    if (!otherParticipantId || otherParticipantId.startsWith('sim_')) return null;
    return doc(db, 'users', otherParticipantId);
  }, [db, otherParticipantId]);
  
  const { data: profile } = useDoc<any>(profileRef);

  const simData = otherParticipantId ? SIM_PROFILES[otherParticipantId] : null;
  const displayName = profile?.displayName || simData?.name || 'TrueVibe User';
  const photoURL = profile?.photoURL || simData?.photo || '';

  return (
    <button 
      onClick={onClick} 
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl md:rounded-[2rem] transition-all duration-300", 
        isActive ? "bg-primary/10 text-primary shadow-inner" : "hover:bg-muted/50"
      )}
    >
      <Avatar className="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl border-2 border-background shadow-sm">
        <AvatarImage src={photoURL} className="object-cover" />
        <AvatarFallback className="bg-primary/5 text-primary font-black">{displayName[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 text-left overflow-hidden">
        <div className="flex justify-between items-center mb-0.5">
          <p className="font-black text-xs md:text-sm truncate">{displayName}</p>
          {otherParticipantId?.startsWith('sim_') && (
            <Sparkles className="w-3 h-3 text-primary/40" />
          )}
        </div>
        <p className="text-[10px] md:text-xs truncate text-muted-foreground font-medium">{conversation.lastMessage || "Start vibing..."}</p>
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
  const isPremium = profile?.tier === 'premium' || profile?.tier === 'lite';

  // Fetch all conversations
  const convQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(db, 'conversations'), 
      where('participantIds', 'array-contains', user.uid), 
      orderBy('updatedAt', 'desc')
    );
  }, [db, user?.uid]);

  const { data: conversations, isLoading: convLoading } = useCollection(convQuery);

  // Fetch messages
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

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !user || !activeConversation || !isVerified || !isPremium) return;
    
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

  const handleDeleteConversation = async () => {
    if (!activeConversation || !user || !otherParticipantId) return;
    
    const requestsRef = collection(db, 'chat_requests');
    const qSender = query(requestsRef, where('senderId', '==', user.uid), where('receiverId', '==', otherParticipantId));
    const qReceiver = query(requestsRef, where('senderId', '==', otherParticipantId), where('receiverId', '==', user.uid));
    
    try {
      const [snap1, snap2] = await Promise.all([getDocs(qSender), getDocs(qReceiver)]);
      snap1.forEach(d => deleteDocumentNonBlocking(doc(db, 'chat_requests', d.id)));
      snap2.forEach(d => deleteDocumentNonBlocking(doc(db, 'chat_requests', d.id)));
    } catch (e) {
      console.error("Failed cleanup", e);
    }

    deleteDocumentNonBlocking(doc(db, 'conversations', activeConversation.id));
    setActiveConversation(null);
    toast({ title: "Conversation Deleted", description: "Chat removed." });
  };

  if (loading || convLoading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-primary w-10 h-10" />
    </div>
  );

  if (profile && !isVerified) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center bg-background">
        <Navigation />
        <Card className="p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl border-none space-y-8 bg-white max-w-md animate-in zoom-in-95 mx-4">
          <div className="bg-unverified/10 p-6 md:p-8 rounded-full inline-block animate-bounce">
            <Lock className="w-12 h-12 md:w-16 md:h-16 text-unverified" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Vibe Security</h1>
            <p className="text-muted-foreground font-medium text-sm md:text-base">To keep TrueVibe safe, you must complete identity verification before chatting with matches.</p>
          </div>
          <Link href="/verification" className="block w-full">
            <Button className="w-full h-16 rounded-2xl md:rounded-[1.5rem] text-lg md:text-xl font-black truevibe-gradient border-none shadow-xl shadow-primary/20">Verify Now</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background md:pt-20 pb-16 md:pb-0 overflow-hidden relative max-w-[1920px] mx-auto">
      <Navigation />
      
      {/* Sidebar - Conversation List */}
      <div className={cn(
        "w-full md:w-[350px] lg:w-[400px] border-r flex flex-col bg-white transition-all duration-300", 
        activeConversation && "hidden md:flex"
      )}>
        <div className="p-6 md:p-8 pb-4">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Messages</h1>
          <p className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Your Vibe Connections</p>
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
              <div className="text-center py-20 md:py-32 px-10 space-y-4">
                <div className="bg-muted/50 p-6 rounded-full inline-block">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-bold text-muted-foreground leading-relaxed">No connections yet.<br/><Link href="/matches" className="text-primary hover:underline">Find matches now!</Link></p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-white h-full relative", 
        !activeConversation && "hidden md:flex items-center justify-center text-center bg-muted/5"
      )}>
        {!activeConversation ? (
          <div className="p-12 animate-in fade-in duration-700">
            <div className="truevibe-gradient p-6 rounded-[2rem] inline-block shadow-2xl shadow-primary/20 mb-6">
              <MessageCircle className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Select a Connection</h2>
            <p className="text-muted-foreground font-medium mt-2">Pick a chat to start sharing your vibes.</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-3 md:p-6 border-b flex items-center justify-between bg-white/95 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                <Button variant="ghost" size="icon" onClick={() => setActiveConversation(null)} className="md:hidden rounded-xl h-9 w-9">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl shadow-sm border-2 border-background flex-shrink-0">
                  <AvatarImage src={activePhotoURL} className="object-cover" />
                  <AvatarFallback className="font-black bg-primary/5">{activeDisplayName[0]}</AvatarFallback>
                </Avatar>
                <div className="truncate">
                  <p className="font-black text-base md:text-lg tracking-tight truncate">{activeDisplayName}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-verified rounded-full" />
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground">Connected</span>
                  </div>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-xl hover:bg-destructive/10 hover:text-destructive h-9 w-9">
                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl max-w-[90vw] md:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl md:text-2xl font-black">Delete Conversation?</AlertDialogTitle>
                    <AlertDialogDescription className="font-medium text-sm md:text-base">
                      This will remove the chat from your list for good. You'll need to send a new vibe check to connect with {activeDisplayName} again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConversation} className="rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Chat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Messages List */}
            <ScrollArea className="flex-1 p-4 md:p-6 bg-muted/5" ref={scrollRef}>
              <div className="space-y-4 md:space-y-6 max-w-3xl mx-auto pb-6">
                {messages?.map((m, idx) => {
                  const isMe = m.senderId === user?.uid;
                  return (
                    <div 
                      key={m.id || idx} 
                      className={cn(
                        "flex flex-col max-w-[85%] md:max-w-[80%] animate-in slide-in-from-bottom-1 duration-300", 
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className={cn(
                        "p-3 md:p-4 px-4 md:px-6 rounded-2xl md:rounded-[2rem] text-sm md:text-base leading-relaxed font-medium shadow-sm", 
                        isMe 
                          ? "truevibe-gradient text-white rounded-tr-none" 
                          : "bg-white text-foreground rounded-tl-none border border-border/50"
                      )}>
                        {m.text}
                      </div>
                      <span className="text-[8px] md:text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mt-1 px-2">
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Input Area / Upgrade Gate */}
            {!isPremium ? (
              <div className="p-6 md:p-8 border-t bg-accent/30 text-center space-y-4">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest">
                  <Crown className="w-3 h-3 fill-current" /> Premium Feature
                </div>
                <h3 className="text-lg md:text-xl font-black">Ready to reply?</h3>
                <p className="text-xs md:text-sm text-muted-foreground max-w-sm mx-auto font-medium">Upgrade your vibe plan to send unlimited messages and build deeper connections.</p>
                <Button 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="w-full sm:w-auto rounded-xl md:rounded-2xl h-12 md:h-14 px-8 md:px-10 font-black truevibe-gradient border-none shadow-xl"
                >
                  Unlock Messaging
                </Button>
              </div>
            ) : (
              <div className="p-4 md:p-6 border-t bg-white">
                <div className="max-w-3xl mx-auto relative flex items-center gap-2 md:gap-3">
                  <Input 
                    placeholder="Type your message..." 
                    value={messageText} 
                    onChange={e => setMessageText(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                    className="rounded-xl md:rounded-2xl h-12 md:h-14 bg-muted/30 border-none shadow-inner px-4 md:px-6 text-sm md:text-base focus-visible:ring-primary/20" 
                  />
                  <Button 
                    size="icon" 
                    onClick={handleSendMessage} 
                    disabled={!messageText.trim()}
                    className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl truevibe-gradient hover:scale-105 transition-all shadow-lg border-none"
                  >
                    <Send className="w-4 h-4 md:w-5 md:h-5" />
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
