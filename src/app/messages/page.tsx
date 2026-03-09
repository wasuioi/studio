
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
    return doc(db, 'users', otherParticipantId);
  }, [db, otherParticipantId]);
  
  const { data: profile } = useDoc<any>(profileRef);
  const displayName = profile?.displayName || profile?.name || 'Viber';
  const photoURL = profile?.photoURL || '';

  return (
    <button 
      onClick={onClick} 
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-[1.5rem] transition-all duration-300", 
        isActive ? "bg-white/10 text-white" : "text-white/40 hover:bg-white/5"
      )}
    >
      <Avatar className="w-12 h-12 rounded-full border border-white/10">
        <AvatarImage src={photoURL} className="object-cover" />
        <AvatarFallback className="bg-primary/20 text-primary font-black">{displayName[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 text-left overflow-hidden">
        <p className="font-black text-sm truncate">{displayName}</p>
        <p className="text-[10px] truncate text-white/30 font-medium">{conversation.lastMessage || "Syncing frequency..."}</p>
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
    if (!user?.uid || !user.emailVerified || !profile?.identityVerified) return null;
    return query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );
  }, [db, user?.uid, user?.emailVerified, profile?.identityVerified]);

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
    if (!otherParticipantId) return null;
    return doc(db, 'users', otherParticipantId);
  }, [db, otherParticipantId]);
  
  const { data: activeChatProfile } = useDoc<any>(activeChatProfileRef);
  const activeDisplayName = activeChatProfile?.displayName || activeChatProfile?.name || 'Viber';
  const activePhotoURL = activeChatProfile?.photoURL || '';

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
    toast({ title: "Frequency Severed", description: "Chat removed." });
  };

  if (loading || convLoading || (user && !user.emailVerified)) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-primary w-10 h-10" />
    </div>
  );

  if (profile && !isVerified) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-6 text-center pt-20">
        <Navigation />
        <Card className="glass-card p-12 rounded-[3rem] space-y-8 max-w-md mx-4 mt-8">
          <div className="bg-unverified/10 p-8 rounded-full inline-block animate-bounce shadow-[0_0_30px_rgba(234,179,8,0.1)]">
            <Lock className="w-12 h-12 text-unverified" />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black tracking-tight text-white">Trust Only</h1>
            <p className="text-white/60 font-medium">Please verify your identity.</p>
          </div>
          <Link href="/verification" className="block w-full">
            <Button className="truevibe-pill-button h-14 w-full">Verify</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden relative max-w-[1920px] mx-auto pt-16">
      <Navigation />
      
      <div className="flex flex-1 overflow-hidden h-full">
        <div className={cn(
          "w-full md:w-[320px] lg:w-[400px] border-r border-white/5 flex flex-col bg-black/10 backdrop-blur-2xl transition-all duration-300", 
          activeConversation && "hidden md:flex"
        )}>
          <div className="p-6 pb-4">
            <h1 className="text-3xl font-black text-white">Vibes</h1>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mt-1">Active Syncs</p>
          </div>
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-2 pb-10 mt-2">
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
                <div className="text-center py-20 px-8">
                  <MessageCircle className="w-10 h-10 text-white/10 mx-auto mb-4" />
                  <p className="text-sm font-bold text-white/30 italic">Find your vibe!</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className={cn(
          "flex-1 flex flex-col bg-black/5 backdrop-blur-3xl h-full relative", 
          !activeConversation && "hidden md:flex items-center justify-center text-center"
        )}>
          {!activeConversation ? (
            <div className="p-12 animate-in fade-in duration-700">
              <div className="truevibe-gradient p-8 rounded-full inline-block shadow-2xl mb-6">
                <MessageCircle className="w-16 h-16 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white">Select a Soul</h2>
              <p className="text-white/30 font-medium mt-2">Pick a frequency to start vibing.</p>
            </div>
          ) : (
            <>
              <div className="p-4 md:p-5 border-b border-white/5 flex items-center justify-between bg-black/20 backdrop-blur-3xl sticky top-0 z-20">
                <div className="flex items-center gap-4 overflow-hidden">
                  <Button variant="ghost" size="icon" onClick={() => setActiveConversation(null)} className="md:hidden text-white/40">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <Avatar className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10">
                    <AvatarImage src={activePhotoURL} className="object-cover" />
                    <AvatarFallback className="font-black bg-primary/20">{activeDisplayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="truncate">
                    <p className="font-black text-lg text-white truncate leading-tight">{activeDisplayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 bg-verified rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/30">In Harmony</span>
                    </div>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-destructive/10 text-white/20 hover:text-destructive h-10 w-10">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="glass-card rounded-[2rem] border-white/10 max-sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black text-white">Sever Connection?</AlertDialogTitle>
                      <AlertDialogDescription className="text-white/60">
                        Delete your chat with {activeDisplayName}. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-full font-bold bg-white/5 border-white/10 text-white">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteConversation} className="rounded-full font-bold bg-destructive text-white">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                <div className="space-y-6 max-w-2xl mx-auto pb-10">
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
                          "p-4 px-5 rounded-[1.75rem] text-sm font-medium shadow-md", 
                          isMe 
                            ? "truevibe-gradient text-white rounded-tr-none" 
                            : "bg-white/10 text-white rounded-tl-none border border-white/5 backdrop-blur-md"
                        )}>
                          {m.text}
                        </div>
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mt-1.5 px-2">
                          {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {!isPremium ? (
                <div className="p-8 border-t border-white/5 bg-accent/5 backdrop-blur-3xl text-center space-y-4">
                  <div className="inline-flex items-center gap-1.5 bg-accent/20 text-accent px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                    <Crown className="w-3 h-3 fill-current" /> Premium Required
                  </div>
                  <h3 className="text-xl font-black text-white">Deepen the Connection</h3>
                  <p className="text-xs text-white/50 max-w-xs mx-auto font-medium">Upgrade to send unlimited messages and unblur your vibe future.</p>
                  <Button 
                    onClick={() => setShowUpgradeModal(true)} 
                    className="truevibe-pill-button h-10 px-10 text-xs"
                  >
                    Unlock Viber
                  </Button>
                </div>
              ) : (
                <div className="p-4 md:p-6 bg-black/20 border-t border-white/5">
                  <div className="max-w-2xl mx-auto relative flex items-center gap-3">
                    <Input 
                      placeholder="Share your frequency..." 
                      value={messageText} 
                      onChange={e => setMessageText(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                      className="rounded-full h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-primary/40 px-6" 
                    />
                    <Button 
                      size="icon" 
                      onClick={handleSendMessage} 
                      disabled={!messageText.trim()}
                      className="shrink-0 w-12 h-12 rounded-full truevibe-pill-button px-0 shadow-lg"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
