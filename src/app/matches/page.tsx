"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Sparkles, BrainCircuit, Check, Crown, MessageCircle, Loader2, Info, Zap, Heart, RefreshCw, Star, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { 
  useFirestore, 
  updateDocumentNonBlocking,
  useCollection,
  useMemoFirebase,
  setDocumentNonBlocking
} from '@/firebase';
import { cn } from '@/lib/utils';
import { findMatches } from '@/ai/flows/find-matches-flow';
import { useToast } from '@/hooks/use-toast';
import { UpgradeModal } from '@/components/UpgradeModal';
import { doc, collection, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { ChatRequest } from '@/types';
import Link from 'next/link';

const SIMULATED_PROFILES = [
  {
    id: 'sim_1',
    name: 'Jason',
    gender: 'Male',
    age: 35,
    photoURL: 'https://picsum.photos/seed/jason1/600/800',
    summary: "Jason is a 35-year-old professional in Bangkok seeking a serious, long-term partnership built on trust and communication."
  },
  {
    id: 'sim_2',
    name: 'Leo',
    gender: 'Male',
    age: 28,
    photoURL: 'https://picsum.photos/seed/leo2/600/800',
    summary: "Leo is a 28-year-old from Bangkok with high emotional intelligence and a secure attachment pattern."
  },
  {
    id: 'sim_3',
    name: 'Tim',
    gender: 'Male',
    age: 39,
    photoURL: 'https://picsum.photos/seed/tim3/600/800',
    summary: "Tim is a 39-year-old in Bangkok seeking marriage and children. Secure orientation with avoidant tendencies."
  },
  {
    id: 'sim_4',
    name: 'Mary',
    gender: 'Female',
    age: 30,
    photoURL: 'https://picsum.photos/seed/mary4/600/800',
    summary: "Mary is a 30-year-old female from Bangkok seeking marriage. Secure attachment style, high self-worth."
  },
  {
    id: 'sim_5',
    name: 'Tania',
    gender: 'Female',
    age: 28,
    photoURL: 'https://picsum.photos/seed/tania5/600/800',
    summary: "Tania is a 28-year-old female in Bangkok, highly relationship-ready (9/10 emotional readiness)."
  },
  {
    id: 'sim_6',
    name: 'Su',
    gender: 'Female',
    age: 36,
    photoURL: 'https://picsum.photos/seed/su6/600/800',
    summary: "Su is a 36-year-old female from Bangkok seeking marriage for companionship and mutual growth."
  }
];

export default function MatchesPage() {
  const { profile, user, loading } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [lockedFeature, setLockedFeature] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [requestConfirmation, setRequestConfirmation] = useState<any>(null);
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // Track outgoing requests
  const outgoingQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(db, 'chat_requests'),
      where('senderId', '==', user.uid)
    );
  }, [db, user]);

  const { data: outgoingRequests } = useCollection<ChatRequest>(outgoingQuery);

  // Track active conversations
  const conversationsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid)
    );
  }, [db, user]);

  const { data: activeConversations } = useCollection<any>(conversationsQuery);

  useEffect(() => {
    if (profile?.topMatches) {
      setMatches(profile.topMatches);
    }
  }, [profile?.topMatches]);

  // Robust Simulated Acceptance Logic
  useEffect(() => {
    if (!user || !outgoingRequests) return;

    const pendingSimRequests = outgoingRequests.filter(
      r => r.status === 'pending' && r.receiverId.startsWith('sim_')
    );

    pendingSimRequests.forEach(req => {
      const timer = setTimeout(() => {
        updateDocumentNonBlocking(doc(db, 'chat_requests', req.id), { status: 'accepted' });
        
        const convId = `conv_${user.uid}_${req.receiverId}`;
        setDocumentNonBlocking(doc(db, 'conversations', convId), {
          id: convId,
          participantIds: [user.uid, req.receiverId],
          lastMessage: "Vibe check passed! You can now chat.",
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }, { merge: true });

        const matchName = SIMULATED_PROFILES.find(p => p.id === req.receiverId)?.name || 'Match';
        toast({ title: "Request Accepted!", description: `${matchName} is ready to chat!` });
      }, 2000);

      return () => clearTimeout(timer);
    });
  }, [outgoingRequests, user, db, toast]);

  const handleScanForMatches = async () => {
    if (!user || !profile?.personalityProfile || isScanning) return;
    setIsScanning(true);
    try {
      const results = await findMatches({
        currentUser: {
          id: user.uid,
          name: profile.displayName || profile.name,
          persona: profile.personalityProfile.user_persona,
          ideal_partner: profile.personalityProfile.ideal_partner,
          weights: profile.personalityProfile.weights
        },
        potentialMatches: SIMULATED_PROFILES.map(p => ({
          id: p.id,
          name: p.name,
          summary: p.summary
        }))
      });

      const processedMatches = results.matches
        .map(m => {
          const fullProfile = SIMULATED_PROFILES.find(p => p.id === m.targetUserId);
          return {
            ...fullProfile,
            score: m.score,
            reason: m.reason
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const userRef = doc(db, 'users', user.uid);
      updateDocumentNonBlocking(userRef, {
        topMatches: processedMatches,
        updatedAt: new Date().toISOString()
      });

      setMatches(processedMatches);
      toast({ title: "Vibe Analysis Complete!", description: "We've saved your top 3 high-energy connections." });
    } catch (err) {
      toast({ variant: "destructive", title: "Scan Failed", description: "Vera is having trouble sensing right now." });
    } finally {
      setIsScanning(false);
    }
  };

  const handleMessageClick = (match: any) => {
    if (!profile || !user) return;
    
    const hasActiveConv = activeConversations?.some(conv => conv.participantIds.includes(match.id));
    
    if (hasActiveConv) {
      router.push('/messages');
      return;
    }

    if (profile.tier !== 'premium') {
      setLockedFeature('Unlimited Messaging');
      setShowUpgradeModal(true);
      return;
    }

    const pending = outgoingRequests?.find(r => r.receiverId === match.id && r.status === 'pending');
    if (pending) {
      toast({ description: `Request to ${match.name} is already pending.` });
      return;
    }

    setRequestConfirmation(match);
  };

  const handleAnalysisClick = (match: any) => {
    if (!profile) return;
    if (profile.tier === 'free') {
      setLockedFeature('Detailed Vibe Analysis');
      setShowUpgradeModal(true);
      return;
    }
    setSelectedAnalysis(match);
  };

  const sendChatRequest = () => {
    if (!user || !profile || !requestConfirmation) return;
    setIsSendingRequest(true);

    const requestId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);

    const requestData: ChatRequest = {
      id: requestId,
      senderId: user.uid,
      senderName: profile.displayName || profile.name,
      senderPhotoURL: profile.photoURL,
      receiverId: requestConfirmation.id,
      matchScore: requestConfirmation.score,
      status: 'pending',
      reason: requestConfirmation.reason,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    setDocumentNonBlocking(doc(db, 'chat_requests', requestId), requestData, { merge: true });
    
    toast({ title: "Request Sent", description: `We've sent your vibe check to ${requestConfirmation.name}.` });
    setRequestConfirmation(null);
    setIsSendingRequest(false);
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 pt-8 md:pt-28 mb-24 min-h-screen">
      <Navigation />
      
      <header className="mb-8 md:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-2">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-3">
            Top 3 Vibe Matches <Sparkles className="text-primary fill-current w-6 h-6 md:w-10 md:h-10" />
          </h1>
          <p className="text-muted-foreground font-medium max-w-lg text-sm md:text-base">
            Vera has analyzed your unique energy to find your most compatible connections.
          </p>
        </div>
        
        {profile?.personalityProfile && (
          <Button 
            onClick={handleScanForMatches} 
            disabled={isScanning} 
            className="w-full sm:w-auto rounded-2xl h-14 px-8 font-black truevibe-gradient border-none shadow-xl shadow-primary/20 transition-all active:scale-95"
          >
            {isScanning ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing...</>
            ) : (
              <>{matches.length > 0 ? <RefreshCw className="mr-2 h-5 w-5" /> : <Zap className="mr-2 h-5 w-5 fill-current" />} {matches.length > 0 ? 'Refresh' : 'Find Matches'}</>
            )}
          </Button>
        )}
      </header>

      {!profile?.personalityProfile ? (
        <Card className="p-10 md:p-20 text-center rounded-[2.5rem] md:rounded-[4rem] border-none shadow-2xl bg-white animate-in zoom-in-95 mx-2">
          <BrainCircuit className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 text-primary opacity-20" />
          <h3 className="text-2xl md:text-4xl font-black mb-3">Vibe Profile Missing</h3>
          <p className="text-muted-foreground font-medium mb-8 max-w-sm mx-auto text-sm md:text-lg">Complete your vibe-check with Vera to unlock weighted matching.</p>
          <Link href="/bot">
            <Button className="w-full sm:w-auto rounded-2xl h-16 px-12 text-lg md:text-xl font-black truevibe-gradient border-none shadow-xl">Start Vibe Check</Button>
          </Link>
        </Card>
      ) : matches.length === 0 ? (
        <div className="text-center py-20 md:py-32 bg-muted/20 rounded-[3rem] md:rounded-[4rem] border-4 border-dashed border-muted/30 mx-2">
          <Heart className="w-12 h-12 md:w-20 md:h-20 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-lg md:text-2xl font-bold text-muted-foreground">Ready to find your vibes? Click above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 px-2">
          {matches.map((match) => {
            const hasSentRequest = outgoingRequests?.some(r => r.receiverId === match.id && r.status === 'pending');
            const hasAcceptedRequest = outgoingRequests?.some(r => r.receiverId === match.id && r.status === 'accepted');
            const hasActiveConv = activeConversations?.some(conv => conv.participantIds.includes(match.id));

            return (
              <Card key={match.id} className="group relative rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden border-none shadow-2xl transition-all duration-500 hover:translate-y-[-8px]">
                <div className="relative aspect-[4/5] w-full">
                  <Image 
                    src={match.photoURL} 
                    alt={match.name} 
                    fill 
                    className={cn(
                      "object-cover transition-all duration-700 group-hover:scale-105",
                      profile.tier === 'free' && "blur-2xl scale-110"
                    )}
                  />
                  
                  {profile.tier === 'free' && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center p-6 text-white z-20 backdrop-blur-md">
                      <Crown className="w-10 h-10 mb-4 text-primary fill-current" />
                      <h4 className="text-xl md:text-2xl font-black mb-2">Member Only</h4>
                      <Button 
                        className="bg-white text-primary rounded-2xl h-12 px-6 font-black text-sm"
                        onClick={() => { setLockedFeature('Profile Reveals'); setShowUpgradeModal(true); }}
                      >
                        Reveal Profile
                      </Button>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent pointer-events-none" />
                  
                  <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-xl md:rounded-2xl flex items-center gap-2 border border-white/30 z-10">
                    <span className="text-white font-black text-base md:text-lg">{match.score}%</span>
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-verified animate-pulse" />
                  </div>

                  <div className="absolute bottom-0 p-6 md:p-8 text-white w-full z-30">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-2xl md:text-3xl font-black">{profile.tier === 'free' ? 'TrueVibe User' : match.name}</h3>
                      <Check className="w-4 h-4 md:w-5 md:h-5 bg-verified rounded-full p-1" />
                    </div>
                    
                    <p className="text-white/80 text-xs md:text-sm font-medium leading-relaxed mb-6 line-clamp-2 md:line-clamp-3">
                      {match.reason}
                    </p>
                    
                    <div className="flex gap-2 md:gap-3">
                      <Button 
                        className={cn(
                          "flex-1 rounded-xl md:rounded-2xl h-12 md:h-14 font-black text-xs md:text-sm transition-all",
                          (hasActiveConv || hasAcceptedRequest) ? "bg-verified text-white" : "bg-white text-black hover:bg-white/90"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMessageClick(match);
                        }}
                        disabled={isScanning}
                      >
                        {hasActiveConv || hasAcceptedRequest ? (
                          <><MessageCircle className="w-4 h-4 mr-1.5" /> Chat Now</>
                        ) : hasSentRequest ? (
                          <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Pending...</>
                        ) : (
                          <><UserPlus className="w-4 h-4 mr-1.5" /> Message</>
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-12 w-12 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-white/10 border-white/20 hover:bg-white/20 text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnalysisClick(match);
                        }}
                      >
                        <Info className="w-5 h-5 md:w-6 md:h-6" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Send Request Confirmation */}
      <Dialog open={!!requestConfirmation} onOpenChange={() => setRequestConfirmation(null)}>
        <DialogContent className="rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl max-w-[90vw] md:max-w-sm bg-white p-8 md:p-10">
          <DialogHeader className="items-center text-center space-y-4">
            <div className="truevibe-gradient p-3 md:p-4 rounded-full">
              <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-white fill-current" />
            </div>
            <div>
              <DialogTitle className="text-xl md:text-2xl font-black">Request to Chat?</DialogTitle>
              <DialogDescription className="font-medium text-sm md:text-base">
                You and {requestConfirmation?.name} have a <strong>{requestConfirmation?.score}%</strong> compatibility match. Send a vibe check to start chatting!
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 mt-4 sm:flex-col sm:space-x-0">
            <Button 
              className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl font-black truevibe-gradient border-none shadow-lg"
              onClick={sendChatRequest}
              disabled={isSendingRequest}
            >
              {isSendingRequest ? <Loader2 className="animate-spin" /> : "Send Vibe Check"}
            </Button>
            <Button variant="ghost" onClick={() => setRequestConfirmation(null)} className="font-bold h-12">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vibe Analysis Detail Dialog */}
      <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
        <DialogContent className="rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl max-w-[90vw] md:max-w-lg bg-white p-6 md:p-10">
          <DialogHeader className="items-center text-center space-y-4">
            <div className="bg-primary/10 p-3 md:p-4 rounded-full">
              <Star className="w-8 h-8 md:w-10 md:h-10 text-primary fill-current" />
            </div>
            <div>
              <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight">Vibe Analysis</DialogTitle>
              <DialogDescription className="font-medium text-sm md:text-base">
                Why you and {selectedAnalysis?.name} are a high-energy match.
              </DialogDescription>
            </div>
          </DialogHeader>
          
          <div className="py-4 md:py-8 space-y-4 md:space-y-6 max-h-[40vh] overflow-y-auto pr-2">
            <div className="bg-muted/30 p-5 md:p-8 rounded-2xl md:rounded-[2rem] border-l-4 border-primary">
              <p className="text-sm md:text-base text-foreground leading-relaxed font-medium">
                {selectedAnalysis?.reason}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button 
              className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl font-black truevibe-gradient border-none"
              onClick={() => setSelectedAnalysis(null)}
            >
              Back to Matches
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {profile && (
        <UpgradeModal 
          isOpen={showUpgradeModal} 
          onClose={() => setShowUpgradeModal(false)} 
          userId={profile.uid}
          featureName={lockedFeature}
        />
      )}
    </div>
  );
}
