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
  const displayName = profile?.displayName || simData?.name || 'Viber';
  const photoURL = profile?.photoURL || simData?.photo || '';

  return (
    <button 
      onClick={onClick} 
      className={cn(
        "w-full flex items-center gap-4 p-5 rounded-[2rem] transition-all duration-300", 
        isActive ? "bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.05)] text-white" : "text-white/60 hover:bg-white/5"
      )}
    >
      <Avatar className="w-14 h-14 rounded-2xl border-2 border-white/10 shadow-lg">
        <AvatarImage src={photoURL} className="object-cover" />
        <AvatarFallback className="bg-primary/20 text-primary font-black">{displayName[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 text-left overflow-hidden">
        <div className="flex justify-between items-center mb-1">
          <p className="font-black text-sm md:text-base truncate">{displayName}</p>
          {otherParticipantId?.startsWith('sim_') && (
            <Sparkles className="w-3 h-3 text-accent animate-pulse" />
          )}
        </div>
        <p className="text-xs truncate text-white/40 font-medium">{conversation.lastMessage || "Awaiting frequency..."}</p>
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

  const convQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(db, 'conversations'), 
      where('participantIds', 'array-contains', user.uid), 
      orderBy('updatedAt', 'desc')
    );
  }, [db, user?.uid]);

  const { data: conversations, isLoading: convLoading } = useCollection(convQuery);

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
  const activeDisplayName = activeChatProfile?.displayName || simData?.name || 'Viber';
  const activePhotoURL = activeChatProfile?.photoURL || simData?.photo || '';

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
      console.error("Cleanup failed", e);
    }
    deleteDocumentNonBlocking(doc(db, 'conversations', activeConversation.id));
    setActiveConversation(null);
    toast({ title: "Frequency Severed", description: "Chat removed from history." });
  };

  if (loading || convLoading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-primary w-10 h-10" />
    </div>
  );

  if (profile && !isVerified) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center">
        <Navigation />
        <Card className="glass-card p-12 md:p-16 rounded-[3.5rem] space-y-8 max-w-md animate-in zoom-in-95 mx-4">
          <div className="bg-unverified/10 p-8 rounded-full inline-block animate-bounce shadow-[0_0_30px_rgba(234,179,8,0.2)]">
            <Lock className="w-12 h-12 md:w-16 md:h-16 text-unverified" />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">Trust Only</h1>
            <p className="text-white/60 font-medium text-base">To maintain cosmic harmony, verify your soul identity before connecting with others.</p>
          </div>
          <Link href="/verification" className="block w-full">
            <Button className="w-full h-16 rounded-[1.5rem] text-xl font-black truevibe-button-gradient border-none">Verify My Soul</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background md:pt-20 pb-16 md:pb-0 overflow-hidden relative max-w-[1920px] mx-auto">
      <Navigation />
      
      <div className={cn(
        "w-full md:w-[380px] lg:w-[450px] border-r border-white/10 flex flex-col bg-black/20 backdrop-blur-2xl transition-all duration-300", 
        activeConversation && "hidden md:flex"
      )}>
        <div className="p-8 pb-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">Vibes</h1>
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest mt-2">Active Frequencies</p>
        </div>
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 pb-10 mt-4">
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
              <div className="text-center py-32 px-10 space-y-6">
                <div className="bg-white/5 p-8 rounded-full inline-block">
                  <MessageCircle className="w-12 h-12 text-white/10" />
                </div>
                <p className="text-base font-bold text-white/40 leading-relaxed italic">No active connections. <br/><Link href="/matches" className="text-primary hover:underline">Find your vibe!</Link></p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className={cn(
        "flex-1 flex flex-col bg-black/10 backdrop-blur-3xl h-full relative", 
        !activeConversation && "hidden md:flex items-center justify-center text-center"
      )}>
        {!activeConversation ? (
          <div className="p-16 animate-in fade-in duration-1000">
            <div className="truevibe-button-gradient p-8 rounded-[3rem] inline-block shadow-[0_0_50px_rgba(123,77,255,0.2)] mb-8">
              <MessageCircle className="w-20 h-20 text-white" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">Select a Soul</h2>
            <p className="text-white/40 font-medium mt-3 text-lg">Pick a frequency to start vibing.</p>
          </div>
        ) : (
          <>
            <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-3xl sticky top-0 z-20">
              <div className="flex items-center gap-4 overflow-hidden">
                <Button variant="ghost" size="icon" onClick={() => setActiveConversation(null)} className="md:hidden text-white/60">
                  <ArrowLeft className="w-6 h-6" />
                </Button>
                <Avatar className="w-12 h-12 md:w-16 md:h-16 rounded-2xl shadow-xl border-2 border-white/10 flex-shrink-0">
                  <AvatarImage src={activePhotoURL} className="object-cover" />
                  <AvatarFallback className="font-black bg-primary/20">{activeDisplayName[0]}</AvatarFallback>
                </Avatar>
                <div className="truncate">
                  <p className="font-black text-lg md:text-2xl text-white tracking-tight truncate">{activeDisplayName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 bg-verified rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/40">In Harmony</span>
                  </div>
                </div>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-2xl hover:bg-destructive/10 text-white/40 hover:text-destructive h-12 w-12">
                    <Trash2 className="w-6 h-6" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass-card rounded-[3rem] border-white/10 max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-black text-white">Sever Connection?</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/60 text-base">
                      This will permanently delete your chat history with {activeDisplayName}. You will need a new vibe check to reconnect.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold bg-white/5 border-white/10 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConversation} className="rounded-xl font-bold bg-destructive text-white hover:bg-destructive/90">
                      Delete Forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-6 max-w-3xl mx-auto pb-10">
                {messages?.map((m, idx) => {
                  const isMe = m.senderId === user?.uid;
                  return (
                    <div 
                      key={m.id || idx} 
                      className={cn(
                        "flex flex-col max-w-[85%] md:max-w-[80%] animate-in slide-in-from-bottom-2 duration-300", 
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className={cn(
                        "p-4 md:p-5 px-6 rounded-[2rem] text-sm md:text-base font-medium shadow-xl", 
                        isMe 
                          ? "truevibe-button-gradient text-white rounded-tr-none" 
                          : "bg-white/10 text-white rounded-tl-none border border-white/10 backdrop-blur-md"
                      )}>
                        {m.text}
                      </div>
                      <span className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-2 px-3">
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {!isPremium ? (
              <div className="p-10 border-t border-white/10 bg-accent/10 backdrop-blur-3xl text-center space-y-6">
                <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-[0_0_15px_rgba(255,122,107,0.2)]">
                  <Crown className="w-4 h-4 fill-current" /> Premium Dimension Required
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-white">Deepen the Connection</h3>
                <p className="text-sm md:text-base text-white/60 max-w-sm mx-auto font-medium">Upgrade to Premium to send unlimited messages and unblur your vibe future.</p>
                <Button 
                  onClick={() => setShowUpgradeModal(true)} 
                  className="w-full sm:w-auto rounded-2xl h-16 px-12 text-lg font-black truevibe-button-gradient border-none"
                >
                  Unlock Unlimited Viber
                </Button>
              </div>
            ) : (
              <div className="p-4 md:p-8 bg-black/40 border-t border-white/10">
                <div className="max-w-4xl mx-auto relative flex items-center gap-3">
                  <Input 
                    placeholder="Share your thoughts..." 
                    value={messageText} 
                    onChange={e => setMessageText(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                    className="rounded-2xl h-14 md:h-16 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-primary/40 px-6 text-base" 
                  />
                  <Button 
                    size="icon" 
                    onClick={handleSendMessage} 
                    disabled={!messageText.trim()}
                    className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl truevibe-button-gradient shadow-2xl"
                  >
                    <Send className="w-6 h-6 text-white" />
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
        featureName="Direct Messaging" 
      />
    </div>
  );
}
