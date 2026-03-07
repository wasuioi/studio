
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Lock, Send, ShieldAlert, CheckCircle2, MessageCircle, ArrowLeft, Loader2, Crown } from 'lucide-react';
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
import { UpgradeModal } from '@/components/UpgradeModal';

function ConversationListItem({ conversation, currentUserId, isActive, onClick }: { 
  conversation: any, 
  currentUserId: string, 
  isActive: boolean,
  onClick: () => void 
}) {
  const db = useFirestore();
  const otherParticipantId = conversation.participantIds.find((id: string) => id !== currentUserId);
  const profileRef = useMemoFirebase(() => otherParticipantId ? doc(db, 'users', otherParticipantId) : null, [db, otherParticipantId]);
  const { data: profile } = useDoc<any>(profileRef);

  return (
    <button onClick={onClick} className={cn("w-full flex items-center gap-4 p-4 rounded-3xl transition-all", isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/50")}>
      <Avatar className="w-14 h-14 rounded-2xl border">
        <AvatarImage src={profile?.photoURL} />
        <AvatarFallback>{profile?.displayName?.[0] || 'H'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 text-left overflow-hidden">
        <p className="font-bold text-sm truncate">{profile?.displayName || 'Harmony User'}</p>
        <p className="text-xs truncate text-muted-foreground">{conversation.lastMessage || "Start chat..."}</p>
      </div>
    </button>
  );
}

export default function MessagesPage() {
  const { profile, user, loading } = useAuth();
  const db = useFirestore();
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isVerified = profile?.identityVerified;
  const isPremium = profile?.tier === 'premium';

  const convQuery = useMemoFirebase(() => {
    if (!user?.uid || !isVerified || !isPremium) return null;
    return query(collection(db, 'conversations'), where('participantIds', 'array-contains', user.uid), orderBy('updatedAt', 'desc'));
  }, [db, user?.uid, isVerified, isPremium]);

  const { data: conversations, isLoading: convLoading } = useCollection(convQuery);

  const messagesQuery = useMemoFirebase(() => {
    if (!activeConversation?.id || !isVerified || !isPremium) return null;
    return query(collection(db, 'conversations', activeConversation.id, 'messages'), orderBy('createdAt', 'asc'), limit(50));
  }, [db, activeConversation?.id, isVerified, isPremium]);

  const { data: messages } = useCollection(messagesQuery);

  const otherParticipantId = activeConversation?.participantIds.find((id: string) => id !== user?.uid);
  const { data: activeChatProfile } = useDoc<any>(useMemoFirebase(() => otherParticipantId ? doc(db, 'users', otherParticipantId) : null, [db, otherParticipantId]));

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!messageText.trim() || !user || !activeConversation || !isVerified || !isPremium) return;
    const msgData = { senderId: user.uid, text: messageText, createdAt: new Date().toISOString() };
    addDocumentNonBlocking(collection(db, 'conversations', activeConversation.id, 'messages'), msgData);
    updateDocumentNonBlocking(doc(db, 'conversations', activeConversation.id), { lastMessage: messageText, updatedAt: new Date().toISOString() });
    setMessageText('');
  };

  if (loading || convLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (profile && !isVerified) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center">
        <Navigation />
        <Card className="p-10 rounded-[3.5rem] shadow-2xl border-none space-y-8 bg-white max-w-sm">
          <div className="bg-unverified/10 p-6 rounded-full inline-block animate-pulse"><Lock className="w-12 h-12 text-unverified" /></div>
          <h1 className="text-3xl font-black">Secure Zone</h1>
          <p className="text-muted-foreground text-sm">Identity verification required to chat.</p>
          <Link href="/verification" className="w-full"><Button className="w-full h-14 rounded-2xl">Verify Now</Button></Link>
        </Card>
      </div>
    );
  }

  if (profile && !isPremium) {
    return (
      <div className="flex flex-col h-screen items-center justify-center p-6 text-center">
        <Navigation />
        <Card className="p-10 rounded-[3.5rem] shadow-2xl border-none space-y-8 bg-white max-w-sm">
          <div className="bg-primary/10 p-6 rounded-full inline-block"><Crown className="w-12 h-12 text-primary" /></div>
          <h1 className="text-3xl font-black">Go Premium</h1>
          <p className="text-muted-foreground text-sm">Upgrade to start conversations with your matches.</p>
          <Button className="w-full h-14 rounded-2xl" onClick={() => setShowUpgradeModal(true)}>Upgrade Now</Button>
        </Card>
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} userId={user?.uid || ''} featureName="Messaging" />
      </div>
    );
  }

  return (
    <div className="flex h-screen max-w-7xl mx-auto bg-background md:pt-16 pb-20 md:pb-0 overflow-hidden relative">
      <Navigation />
      <div className={cn("w-full md:w-80 border-r flex flex-col bg-white", activeConversation && "hidden md:flex")}>
        <div className="p-8">
          <h1 className="text-3xl font-black mb-6">Messages</h1>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-4 space-y-1">
            {conversations?.map(conv => <ConversationListItem key={conv.id} conversation={conv} currentUserId={user?.uid || ''} isActive={activeConversation?.id === conv.id} onClick={() => setActiveConversation(conv)} />)}
            {conversations?.length === 0 && (
              <div className="text-center py-20 px-6">
                <p className="text-xs text-muted-foreground">Find some matches to start chatting!</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className={cn("flex-1 flex flex-col bg-white", !activeConversation && "hidden md:flex items-center justify-center text-center")}>
        {!activeConversation ? (
          <div className="p-12">
            <MessageCircle className="w-16 h-16 text-primary/20 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Pick a Connection</h2>
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setActiveConversation(null)} className="md:hidden"><ArrowLeft /></Button>
              <Avatar className="w-10 h-10"><AvatarImage src={activeChatProfile?.photoURL} /><AvatarFallback>U</AvatarFallback></Avatar>
              <p className="font-bold">{activeChatProfile?.displayName}</p>
            </div>
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              <div className="space-y-4">
                {messages?.map(m => (
                  <div key={m.id} className={cn("max-w-[80%] p-4 rounded-3xl text-sm", m.senderId === user?.uid ? "ml-auto bg-primary text-white" : "mr-auto bg-muted")}>
                    {m.text}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-4 border-t flex gap-2">
              <Input placeholder="Type message..." value={messageText} onChange={e => setMessageText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} className="rounded-xl" />
              <Button size="icon" onClick={handleSendMessage} className="rounded-xl"><Send /></Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
