
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
import { PlaceHolderImages } from '@/lib/placeholder-images';

const SIMULATED_PROFILES = [
  {
    id: 'sim_1',
    name: 'Jason',
    gender: 'Male',
    age: 35,
    photoURL: PlaceHolderImages.find(img => img.id === 'sim_jason')?.imageUrl || '',
    imageHint: PlaceHolderImages.find(img => img.id === 'sim_jason')?.imageHint || 'man portrait',
    summary: "Jason is a 35-year-old professional in Bangkok seeking a serious, long-term partnership built on trust and communication."
  },
  {
    id: 'sim_2',
    name: 'Leo',
    gender: 'Male',
    age: 28,
    photoURL: PlaceHolderImages.find(img => img.id === 'sim_leo')?.imageUrl || '',
    imageHint: PlaceHolderImages.find(img => img.id === 'sim_leo')?.imageHint || 'man portrait',
    summary: "Leo is a 28-year-old from Bangkok with high emotional intelligence and a secure attachment pattern."
  },
  {
    id: 'sim_3',
    name: 'Tim',
    gender: 'Male',
    age: 39,
    photoURL: PlaceHolderImages.find(img => img.id === 'sim_tim')?.imageUrl || '',
    imageHint: PlaceHolderImages.find(img => img.id === 'sim_tim')?.imageHint || 'man portrait',
    summary: "Tim is a 39-year-old in Bangkok seeking marriage and children. Secure orientation with avoidant tendencies."
  },
  {
    id: 'sim_4',
    name: 'Mary',
    gender: 'Female',
    age: 30,
    photoURL: PlaceHolderImages.find(img => img.id === 'sim_mary')?.imageUrl || '',
    imageHint: PlaceHolderImages.find(img => img.id === 'sim_mary')?.imageHint || 'woman portrait',
    summary: "Mary is a 30-year-old female from Bangkok seeking marriage. Secure attachment style, high self-worth."
  },
  {
    id: 'sim_5',
    name: 'Tania',
    gender: 'Female',
    age: 28,
    photoURL: PlaceHolderImages.find(img => img.id === 'sim_tania')?.imageUrl || '',
    imageHint: PlaceHolderImages.find(img => img.id === 'sim_tania')?.imageHint || 'woman portrait',
    summary: "Tania is a 28-year-old female in Bangkok, highly relationship-ready (9/10 emotional readiness)."
  },
  {
    id: 'sim_6',
    name: 'Su',
    gender: 'Female',
    age: 36,
    photoURL: PlaceHolderImages.find(img => img.id === 'sim_su')?.imageUrl || '',
    imageHint: PlaceHolderImages.find(img => img.id === 'sim_su')?.imageHint || 'woman portrait',
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
  const [activeMatchForPayment, setActiveMatchForPayment] = useState<any>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);

  const outgoingQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(db, 'chat_requests'),
      where('senderId', '==', user.uid)
    );
  }, [db, user]);

  const { data: outgoingRequests } = useCollection<ChatRequest>(outgoingQuery);

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
          lastMessage: "Vibe check passed!",
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }, { merge: true });
        const matchName = SIMULATED_PROFILES.find(p => p.id === req.receiverId)?.name || 'Match';
        toast({ title: "Connection Unlocked", description: `${matchName} is ready to vibe!` });
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
      toast({ title: "Vibe Check Complete", description: "Your cosmic matches are ready." });
    } catch (err) {
      toast({ variant: "destructive", title: "Analysis Failed", description: "Could not sense your frequency." });
    } finally {
      setIsScanning(false);
    }
  };

  const handleActionInitiated = (match: any) => {
    if (!profile || !user) return;
    
    const hasActiveConv = activeConversations?.some(conv => conv.participantIds.includes(match.id));
    if (hasActiveConv) {
      router.push('/messages');
      return;
    }

    setActiveMatchForPayment(match);
    setShowUpgradeModal(true);
  };

  const executeActionAfterPayment = (type: 'insight' | 'connection') => {
    if (!activeMatchForPayment || !user || !profile) return;

    if (type === 'insight') {
      setSelectedAnalysis(activeMatchForPayment);
    } else if (type === 'connection') {
      sendChatRequest(activeMatchForPayment);
    }
  };

  const sendChatRequest = (match: any) => {
    if (!user || !profile || !match) return;
    const requestId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3);
    const requestData: ChatRequest = {
      id: requestId,
      senderId: user.uid,
      senderName: profile.displayName || profile.name,
      senderPhotoURL: profile.photoURL,
      receiverId: match.id,
      matchScore: match.score,
      status: 'pending',
      reason: match.reason,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    setDocumentNonBlocking(doc(db, 'chat_requests', requestId), requestData, { merge: true });
    toast({ title: "Request Sent", description: "Sending your energy to " + match.name });
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 min-h-screen pt-20">
      <Navigation />
      
      <header className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-2">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-3 text-white">
            Your vibes <Sparkles className="text-accent fill-current w-6 h-6 md:w-10 md:h-10" />
          </h1>
          <p className="text-white/60 font-medium max-w-lg text-sm md:text-base">
            Vera has synced with your frequency.
          </p>
        </div>
        
        {profile?.personalityProfile && (
          <Button 
            onClick={handleScanForMatches} 
            disabled={isScanning} 
            className="truevibe-pill-button sm:w-auto"
          >
            {isScanning ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
            ) : (
              <>{matches.length > 0 ? <RefreshCw className="mr-2 h-4 w-4" /> : <Zap className="mr-2 h-4 w-4 fill-current" />} {matches.length > 0 ? 'Sync Frequency' : 'Find Matches'}</>
            )}
          </Button>
        )}
      </header>

      {!profile?.personalityProfile ? (
        <Card className="glass-card p-10 md:p-20 text-center rounded-[2.5rem] animate-in zoom-in-95 bg-white/5 border-white/10">
          <BrainCircuit className="w-12 h-12 md:w-20 md:h-20 mx-auto mb-6 text-primary/40" />
          <h3 className="text-2xl md:text-4xl font-black mb-4 text-white">Vibe Profile Hidden</h3>
          <p className="text-white/60 font-medium mb-8 max-w-xs mx-auto text-sm md:text-lg">Vera needs to know your energy before she can match you.</p>
          <Link href="/bot">
            <Button className="truevibe-pill-button h-12 px-10">Initiate Vibe Check</Button>
          </Link>
        </Card>
      ) : matches.length === 0 ? (
        <div className="text-center py-24 glass-card rounded-[2.5rem] border-dashed border-white/10 mx-2 bg-white/5">
          <Heart className="w-10 h-10 md:w-16 md:h-16 mx-auto mb-4 text-white/10" />
          <p className="text-lg md:text-2xl font-bold text-white/40 italic">Waiting for the stars to align. Click sync above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-2">
          {matches.map((match) => {
            const hasSentRequest = outgoingRequests?.some(r => r.receiverId === match.id && r.status === 'pending');
            const hasAcceptedRequest = outgoingRequests?.some(r => r.receiverId === match.id && r.status === 'accepted');
            const hasActiveConv = activeConversations?.some(conv => conv.participantIds.includes(match.id));

            return (
              <Card key={match.id} className="glass-card glass-card-hover group relative rounded-[2rem] overflow-hidden flex flex-col h-full shadow-lg bg-white/5 border-white/10">
                <div className="relative aspect-[4/5] w-full">
                  <Image 
                    src={match.photoURL} 
                    alt={match.name} 
                    fill 
                    data-ai-hint={match.imageHint || "portrait person"}
                    className="object-cover transition-all duration-700 group-hover:scale-105"
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                  
                  <div className="absolute top-4 right-4 bg-gradient-to-r from-[#FF4DA6] to-[#FF8A8A] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg z-10">
                    <span className="text-white font-black text-xs">{match.score}% Match</span>
                    <Star className="w-3 h-3 text-white fill-current" />
                  </div>

                  <div className="absolute bottom-0 p-6 text-white w-full z-30">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-2xl font-black tracking-tight">{match.name}</h3>
                      <Check className="w-4 h-4 bg-verified text-white rounded-full p-1" />
                    </div>
                    
                    <p className="text-white/70 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-4">
                      Frequency: {match.score >= 90 ? 'Perfect Harmony' : 'High Vibe'}
                    </p>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        className={cn(
                          "flex-1 rounded-full h-10 font-black text-xs transition-all text-white",
                          (hasActiveConv || hasAcceptedRequest) ? "bg-verified" : "bg-white/20 hover:bg-white/30 backdrop-blur-md"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionInitiated(match);
                        }}
                        disabled={isScanning}
                      >
                        {hasActiveConv || hasAcceptedRequest ? (
                          <><MessageCircle className="w-4 h-4 mr-1.5" /> Chat</>
                        ) : hasSentRequest ? (
                          <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sync...</>
                        ) : (
                          <><UserPlus className="w-4 h-4 mr-1.5" /> Connect</>
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionInitiated(match);
                        }}
                      >
                        <Info className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Analysis Details */}
      <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
        <DialogContent className="glass-card rounded-[2.5rem] border-white/10 max-w-md p-8 bg-[#0F0819]/90">
          <DialogHeader className="items-center text-center space-y-4">
            <div className="bg-primary/20 p-4 rounded-full">
              <Star className="w-8 h-8 text-primary fill-current" />
            </div>
            <div>
              <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight text-white">Soul Insight</DialogTitle Reviewing</h3>
            </div>
          </DialogHeader>
          
          <div className="py-6">
            <div className="bg-white/5 p-6 rounded-2xl border-l-4 border-accent italic">
              <p className="text-sm md:text-base text-white/90 leading-relaxed font-medium">
                "{selectedAnalysis?.reason}"
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              className="truevibe-pill-button w-full"
              onClick={() => setSelectedAnalysis(null)}
            >
              Close Insight
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {profile && (
        <UpgradeModal 
          isOpen={showUpgradeModal} 
          onClose={() => setShowUpgradeModal(false)} 
          userId={profile.uid}
          featureName="Exclusive Content"
          targetMatchName={activeMatchForPayment?.name}
          onPaymentSuccess={executeActionAfterPayment}
        />
      )}
    </div>
  );
}
