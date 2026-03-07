"use client";

import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  useFirestore, 
  updateDocumentNonBlocking,
  useCollection,
  useMemoFirebase,
  setDocumentNonBlocking
} from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { UserPlus, CheckCircle, XCircle, Loader2, Inbox, Heart, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { ChatRequest } from '@/types';
import Link from 'next/link';

export default function RequestsPage() {
  const { user, profile, loading } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const requestsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(db, 'chat_requests'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'pending')
    );
  }, [db, user]);

  const { data: incomingRequests, isLoading } = useCollection<ChatRequest>(requestsQuery);

  const handleAcceptRequest = async (request: ChatRequest) => {
    if (!user) return;
    
    const convId = `conv_${request.senderId}_${user.uid}`;
    updateDocumentNonBlocking(doc(db, 'chat_requests', request.id), { status: 'accepted' });
    
    setDocumentNonBlocking(doc(db, 'conversations', convId), {
      id: convId,
      participantIds: [request.senderId, user.uid],
      lastMessage: "Vibe check passed!",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }, { merge: true });

    toast({ title: "Request Accepted", description: "Conversation unlocked!" });
    router.push('/messages');
  };

  const handleDeclineRequest = (request: ChatRequest) => {
    updateDocumentNonBlocking(doc(db, 'chat_requests', request.id), { status: 'rejected' });
    toast({ description: "Request declined." });
  };

  if (loading || isLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 mb-24 min-h-screen">
      <Navigation />
      
      <header className="mb-10 space-y-1 px-2 mt-8">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-3 text-white">
          Vibe Requests <UserPlus className="text-primary w-6 h-6 md:w-10 md:h-10" />
        </h1>
        <p className="text-white/60 font-medium max-w-lg text-sm md:text-base">
          Who's sensing your frequency?
        </p>
      </header>

      <div className="space-y-6 px-2">
        {incomingRequests && incomingRequests.length > 0 ? (
          incomingRequests.map((req) => (
            <Card key={req.id} className="glass-card rounded-[2rem] overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="flex flex-col md:flex-row p-6 md:p-8 gap-6 items-center">
                <Avatar className="w-20 h-20 rounded-2xl shadow-xl border-2 border-white/10 flex-shrink-0">
                  <AvatarImage src={req.senderPhotoURL} className="object-cover" />
                  <AvatarFallback className="text-xl font-black bg-primary/20 text-primary">
                    {req.senderName[0]}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-center md:text-left space-y-2">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <h4 className="text-xl font-black text-white">{req.senderName}</h4>
                    <Badge className="bg-primary/20 text-primary border-none px-3 py-1 text-xs font-black rounded-full">
                      {req.matchScore}% Harmony
                    </Badge>
                  </div>
                  <p className="text-sm text-white/70 font-medium leading-relaxed italic line-clamp-2">
                    "{req.reason}"
                  </p>
                </div>

                <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex-1 rounded-full text-white/40 hover:text-destructive font-black uppercase text-[10px] tracking-widest" 
                    onClick={() => handleDeclineRequest(req)}
                  >
                    Decline
                  </Button>
                  <Button 
                    size="sm"
                    className="truevibe-pill-button flex-1" 
                    onClick={() => handleAcceptRequest(req)}
                  >
                    Accept
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="flex justify-center items-center py-20 relative">
             {/* Glow behind the card */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <div className="w-64 h-64 bg-primary blur-[80px] rounded-full" />
            </div>
            
            <Card className="glass-card p-10 text-center rounded-[2.5rem] w-full max-w-[500px] relative z-10">
              <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Inbox className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white mb-2">No Requests Yet</h3>
              <p className="text-white/40 font-medium mb-8 text-sm md:text-base px-4">
                The universe is still syncing. Try exploring new profiles!
              </p>
              <Link href="/matches">
                <Button className="truevibe-pill-button h-10 px-8">
                  Explore Matches <Heart className="ml-2 w-4 h-4 fill-current" />
                </Button>
              </Link>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
