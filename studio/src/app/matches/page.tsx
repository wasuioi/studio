
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useUser } from '@/firebase';
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
import { Sparkles, BrainCircuit, Check, CalendarHeart, Loader2, Info, Zap, Heart, RefreshCw, Star, UserPlus, Bell, Clock, MapPin, ShieldCheck } from 'lucide-react';
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
import { doc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { ChatRequest } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SenderDatePlannerModal } from '@/components/SenderDatePlannerModal';

export default function MatchesPage() {
  const { isUserLoading, user: authUser } = useUser();
  const { profile, user } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [showVerifyGate, setShowVerifyGate] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [activeMatchForPayment, setActiveMatchForPayment] = useState<any>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [senderPlanningRequest, setSenderPlanningRequest] = useState<ChatRequest | null>(null);
  const [viewingPlan, setViewingPlan] = useState<ChatRequest | null>(null);

  const outgoingQuery = useMemoFirebase(() => {
    if (!authUser?.emailVerified) return null;
    return query(
      collection(db, 'chat_requests'),
      where('senderId', '==', authUser.uid)
    );
  }, [db, authUser]);

  const { data: outgoingRequests } = useCollection<ChatRequest>(outgoingQuery);

  const pendingSenderRequests = outgoingRequests?.filter(r => r.dateStatus === 'waiting_sender') ?? [];

  useEffect(() => {
    if (profile?.topMatches) {
      setMatches(profile.topMatches);
    }
  }, [profile?.topMatches]);

  const handleScanForMatches = async () => {
    if (!user || !profile?.personalityProfile || isScanning) return;
    setIsScanning(true);
    try {
      // Query real users who have completed their profile, excluding self
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef, 
        where('profileCompleted', '==', true),
        limit(20)
      );
      
      const querySnapshot = await getDocs(q);
      const potentialMatches = querySnapshot.docs
        .filter(doc => doc.id !== user.uid)
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.displayName || data.name,
            photoURL: data.photoURL,
            summary: data.personalityProfile?.user_persona?.summary || "No summary available."
          };
        });

      if (potentialMatches.length === 0) {
        toast({ title: "Sync Failed", description: "No other active vibes found in the universe yet." });
        setMatches([]);
        setIsScanning(false);
        return;
      }

      const results = await findMatches({
        currentUser: {
          id: user.uid,
          name: profile.displayName || profile.name,
          persona: profile.personalityProfile.user_persona,
          ideal_partner: profile.personalityProfile.ideal_partner,
          weights: profile.personalityProfile.weights
        },
        potentialMatches: potentialMatches.map(p => ({
          id: p.id,
          name: p.name,
          summary: p.summary
        }))
      });

      const processedMatches = results.matches
        .map(m => {
          const fullProfile = potentialMatches.find(p => p.id === m.targetUserId);
          return {
            ...fullProfile,
            score: m.score,
            reason: m.reason
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

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

  const isVerified = profile?.identityVerified || profile?.verificationStatus === 'verified';

  const requireVerification = () => {
    setShowVerifyGate(true);
    return false;
  };

  const handleActionInitiated = (match: any) => {
    if (!profile || !user) return;
    if (!isVerified) { requireVerification(); return; }
    setActiveMatchForPayment(match);
    setShowUpgradeModal(true);
  };

  const executeActionAfterPayment = (type: 'insight' | 'connection', paymentIntentId: string) => {
    if (!activeMatchForPayment || !user || !profile) return;

    if (type === 'insight') {
      setSelectedAnalysis(activeMatchForPayment);
    } else if (type === 'connection') {
      sendDateInvite(activeMatchForPayment, paymentIntentId);
    }
  };

  const sendDateInvite = (match: any, paymentIntentId?: string) => {
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
      receiverName: match.name,
      matchScore: match.score,
      status: 'pending',
      dateStatus: 'pending',
      reason: match.reason,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      ...(paymentIntentId && { paymentIntentId }),
    };
    setDocumentNonBlocking(doc(db, 'chat_requests', requestId), requestData, { merge: true });
    toast({ title: "Date Invite Sent! 🌹", description: "Sending your energy to " + match.name });
  };

  // Only block on Firebase auth state — much faster than waiting for Firestore profile too
  if (isUserLoading || (authUser && !authUser.emailVerified)) return (
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

      {/* Sender notification banners */}
      {pendingSenderRequests.length > 0 && (
        <div className="px-2 mb-6 space-y-3">
          {pendingSenderRequests.map(req => (
            <div key={req.id} className="glass-card rounded-[1.5rem] p-5 border border-primary/30 bg-primary/5 flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 rounded-full p-2.5 shrink-0">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-white font-black text-sm">{req.receiverName || 'Your match'} accepted your invite! 🎉</p>
                  <p className="text-white/50 text-xs font-medium">Share your preferences so Vera can plan the perfect date</p>
                </div>
              </div>
              <Button
                size="sm"
                className="truevibe-pill-button shrink-0"
                onClick={() => setSenderPlanningRequest(req)}
              >
                Plan Date
              </Button>
            </div>
          ))}
        </div>
      )}

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
            const hasSentRequest = outgoingRequests?.some(r => r.receiverId === match.id && r.status === 'pending' && r.dateStatus !== 'waiting_sender');
            const hasPlannedDate = outgoingRequests?.some(r => r.receiverId === match.id && r.dateStatus === 'planned');
            const waitingForSender = outgoingRequests?.some(r => r.receiverId === match.id && r.dateStatus === 'waiting_sender');

            return (
              <Card key={match.id} className="glass-card glass-card-hover group relative rounded-[2rem] overflow-hidden flex flex-col h-full shadow-lg bg-white/5 border-white/10">
                <div className="relative aspect-[4/5] w-full">
                  {match.photoURL ? (
                    <Image 
                      src={match.photoURL} 
                      alt={match.name} 
                      fill 
                      data-ai-hint="portrait person"
                      className="object-cover transition-all duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      <Sparkles className="w-10 h-10 text-white/20" />
                    </div>
                  )}
                  
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
                          hasPlannedDate ? "bg-verified" : "bg-white/20 hover:bg-white/30 backdrop-blur-md"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          const plannedReq = outgoingRequests?.find(r => r.receiverId === match.id && r.dateStatus === 'planned');
                          const waitingReq = outgoingRequests?.find(r => r.receiverId === match.id && r.dateStatus === 'waiting_sender');
                          if (plannedReq) {
                            setViewingPlan(plannedReq);
                          } else if (waitingReq) {
                            setSenderPlanningRequest(waitingReq);
                          } else if (!hasSentRequest) {
                            handleActionInitiated(match);
                          }
                        }}
                        disabled={isScanning || hasSentRequest}
                      >
                        {hasPlannedDate ? (
                          <><CalendarHeart className="w-4 h-4 mr-1.5" /> Date Planned</>
                        ) : waitingForSender ? (
                          <><Bell className="w-4 h-4 mr-1.5" /> Your Turn!</>
                        ) : hasSentRequest ? (
                          <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Pending...</>
                        ) : (
                          <><UserPlus className="w-4 h-4 mr-1.5" /> Date Invite</>
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

      {/* Verification Gate Dialog */}
      <Dialog open={showVerifyGate} onOpenChange={setShowVerifyGate}>
        <DialogContent className="glass-card rounded-[2.5rem] border-white/10 max-w-md p-8 bg-[#0F0819]/90">
          <DialogHeader className="items-center text-center space-y-4">
            <div className="bg-primary/20 p-4 rounded-full">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight text-white">Verify First</DialogTitle>
              <DialogDescription className="text-white/60 mt-2 leading-relaxed">
                {profile?.verificationStatus === 'pending'
                  ? "Your identity verification is under review. You'll be able to connect with matches once approved."
                  : "TrueVibe requires identity verification before you can view match reports or send date invites. It only takes a minute!"}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 mt-2">
            {profile?.verificationStatus !== 'pending' && (
              <Link href="/verification" className="w-full">
                <Button className="truevibe-pill-button w-full" onClick={() => setShowVerifyGate(false)}>
                  <ShieldCheck className="w-4 h-4 mr-2" /> Verify My Identity
                </Button>
              </Link>
            )}
            <Button variant="ghost" className="w-full rounded-full text-white/40 font-bold" onClick={() => setShowVerifyGate(false)}>
              Maybe Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analysis Details */}
      <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
        <DialogContent className="glass-card rounded-[2.5rem] border-white/10 max-w-md p-8 bg-[#0F0819]/90">
          <DialogHeader className="items-center text-center space-y-4">
            <div className="bg-primary/20 p-4 rounded-full">
              <Star className="w-8 h-8 text-primary fill-current" />
            </div>
            <div>
              <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight text-white">Soul Insight</DialogTitle>
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

      {/* View Planned Date Dialog */}
      <Dialog open={!!viewingPlan} onOpenChange={() => setViewingPlan(null)}>
        <DialogContent className="glass-card rounded-[2.5rem] border-white/10 max-w-md p-8 bg-[#0F0819]/90">
          <DialogHeader className="items-center text-center space-y-4">
            <div className="bg-green-500/20 p-4 rounded-full">
              <CalendarHeart className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight text-white">Your Date Plan</DialogTitle>
              <DialogDescription className="text-white/50 mt-1">
                With {viewingPlan?.receiverName}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="bg-white/5 rounded-2xl p-5 space-y-3 border border-white/10">
              <div className="flex items-center gap-3 text-white">
                <div className="bg-primary/20 p-2 rounded-full shrink-0">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-wider">When</p>
                  <p className="font-black">{viewingPlan?.suggestedDateTime}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-white">
                <div className="bg-primary/20 p-2 rounded-full shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Where</p>
                  <p className="font-black leading-snug">{viewingPlan?.suggestedLocation}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button className="truevibe-pill-button w-full" onClick={() => setViewingPlan(null)}>
              Got it! 💕
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
          targetMatchId={activeMatchForPayment?.id}
          onPaymentSuccess={executeActionAfterPayment}
        />
      )}

      {senderPlanningRequest && profile && (
        <SenderDatePlannerModal
          isOpen={!!senderPlanningRequest}
          onClose={() => setSenderPlanningRequest(null)}
          request={senderPlanningRequest}
          senderName={profile.displayName || profile.name}
          senderLocation={profile.location}
        />
      )}
    </div>
  );
}
