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
import { UserPlus, CheckCircle, XCircle, Loader2, Inbox, Heart } from 'lucide-react';
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
      lastMessage: "Vibe check passed! You can now chat.",
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
    <div className="max-w-4xl mx-auto p-4 pt-8 md:pt-28 mb-24 min-h-screen">
      <Navigation />
      
      <header className="mb-8 md:mb-10 space-y-2 px-2">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-3">
          Vibe Requests <UserPlus className="text-primary w-6 h-6 md:w-10 md:h-10" />
        </h1>
        <p className="text-muted-foreground font-medium max-w-lg text-sm md:text-base">
          Manage your incoming chat requests and decide who you want to vibe with.
        </p>
      </header>

      <div className="space-y-4 md:space-y-6 px-2">
        {incomingRequests && incomingRequests.length > 0 ? (
          incomingRequests.map((req) => (
            <Card key={req.id} className="rounded-[2rem] md:rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="flex flex-col md:flex-row p-6 md:p-8 gap-4 md:gap-6 items-center">
                <Avatar className="w-20 h-20 md:w-24 md:h-24 rounded-2xl md:rounded-3xl shadow-lg border-4 border-accent flex-shrink-0">
                  <AvatarImage src={req.senderPhotoURL} className="object-cover" />
                  <AvatarFallback className="text-xl font-black bg-primary/10 text-primary">
                    {req.senderName[0]}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-center md:text-left space-y-2">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <h4 className="text-xl md:text-2xl font-black">{req.senderName}</h4>
                    <Badge className="bg-primary/10 text-primary border-none px-2 py-0.5 text-[10px] md:text-xs font-black">
                      {req.matchScore}% Match
                    </Badge>
                  </div>
                  <p className="text-sm md:text-base text-foreground/80 font-medium leading-relaxed italic line-clamp-3">
                    "{req.reason}"
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 md:gap-3 w-full md:w-auto mt-4 md:mt-0">
                  <Button 
                    variant="ghost" 
                    className="flex-1 sm:flex-none rounded-xl md:rounded-2xl h-12 md:h-14 px-4 md:px-6 gap-2 text-destructive hover:bg-destructive/10 font-black uppercase text-[10px] tracking-widest" 
                    onClick={() => handleDeclineRequest(req)}
                  >
                    <XCircle className="w-4 h-4 md:w-5 md:h-5" /> Decline
                  </Button>
                  <Button 
                    className="flex-1 sm:flex-none rounded-xl md:rounded-2xl h-12 md:h-14 px-6 md:px-8 gap-2 bg-verified hover:bg-verified/90 text-white font-black shadow-lg shadow-verified/20" 
                    onClick={() => handleAcceptRequest(req)}
                  >
                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5" /> Accept Vibe
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-10 md:p-20 text-center rounded-[2.5rem] md:rounded-[4rem] border-none shadow-2xl bg-white/50 backdrop-blur-sm animate-in zoom-in-95">
            <Inbox className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 text-muted-foreground/20" />
            <h3 className="text-xl md:text-3xl font-black mb-2">No Requests Yet</h3>
            <p className="text-muted-foreground font-medium mb-8 max-w-sm mx-auto text-sm md:text-base">
              When someone sees your profile and wants to connect, their request will appear here.
            </p>
            <Link href="/matches">
              <Button className="w-full sm:w-auto rounded-xl md:rounded-2xl h-14 px-8 font-black truevibe-gradient border-none shadow-xl shadow-primary/20">
                Explore Matches <Heart className="ml-2 w-4 h-4 fill-current" />
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
