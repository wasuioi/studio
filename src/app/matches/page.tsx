"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, BrainCircuit, Check, Crown, MessageCircle, Loader2, Info, Zap, Heart, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  useFirestore, 
  updateDocumentNonBlocking
} from '@/firebase';
import { cn } from '@/lib/utils';
import { findMatches } from '@/ai/flows/find-matches-flow';
import { useToast } from '@/hooks/use-toast';
import { UpgradeModal } from '@/components/UpgradeModal';
import { doc } from 'firebase/firestore';

const SIMULATED_PROFILES = [
  {
    id: 'sim_1',
    name: 'Jason',
    gender: 'Male',
    age: 35,
    photoURL: 'https://picsum.photos/seed/jason1/600/800',
    summary: "Jason is a 35-year-old professional in Bangkok seeking a serious, long-term partnership built on trust and communication. High emotional maturity, secure attachment, values reciprocal support and active listening. Introverted yet adaptable. Deal-breakers: self-centeredness and tattoos. Preference for Chinese/Buddhist/Teochew heritage. Goal: Marriage."
  },
  {
    id: 'sim_2',
    name: 'Leo',
    gender: 'Male',
    age: 28,
    photoURL: 'https://picsum.photos/seed/leo2/600/800',
    summary: "Leo is a 28-year-old from Bangkok with high emotional intelligence and a secure attachment pattern. Values integrity, honesty, and intellectual alignment. Love languages: words of affirmation and quality time. Has a dry, observational humor. Seeks a partner who invites vulnerability. Deal-breakers: cheating, disrespect, unwilling to communicate."
  },
  {
    id: 'sim_3',
    name: 'Tim',
    gender: 'Male',
    age: 39,
    photoURL: 'https://picsum.photos/seed/tim3/600/800',
    summary: "Tim is a 39-year-old in Bangkok seeking marriage and children. Secure orientation with avoidant tendencies in conflict (needs space to cool down). Values deep communication, trust, and intellectual compatibility. Seeks a 'peaceful relationship' and respects independence. Deal-breaker: cheating."
  },
  {
    id: 'sim_4',
    name: 'Mary',
    gender: 'Female',
    age: 30,
    photoURL: 'https://picsum.photos/seed/mary4/600/800',
    summary: "Mary is a 30-year-old female in Bangkok seeking marriage. Secure attachment style, high self-worth, clear boundaries. Values emotional intelligence, kindness, and decisiveness. Prefers a partner who is a third-culture kid with broad shoulders (173-180cm). Chinese descent, requires eloquent English."
  },
  {
    id: 'sim_5',
    name: 'Tania',
    gender: 'Female',
    age: 28,
    photoURL: 'https://picsum.photos/seed/tania5/600/800',
    summary: "Tania is a 28-year-old female in Bangkok, highly relationship-ready (9/10 emotional readiness). Values 'comfortable silence' and emotional safety. Seeks commitment through active listening. Prefers marriage before 30 and two children. Deal-breakers: smoking, cheating, gambling. Needs 3-4 days of alone time per week."
  },
  {
    id: 'sim_6',
    name: 'Su',
    gender: 'Female',
    age: 36,
    photoURL: 'https://picsum.photos/seed/su6/600/800',
    summary: "Su is a 36-year-old female in Bangkok seeking marriage for companionship and mutual growth. Anxious-preoccupied tendencies (needs assurance). Values proactive, honest partners with financial stability. Rejects arrogance and low EQ. Specific preferences: no Muslims, Christians, or Indians; Thai/Chinese preferred."
  }
];

export default function MatchesPage() {
  const { profile, user, loading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [matches, setMatches] = useState<any[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [lockedFeature, setLockedFeature] = useState('');

  // Synchronize local matches state with persisted profile matches
  useEffect(() => {
    if (profile?.topMatches) {
      setMatches(profile.topMatches);
    }
  }, [profile?.topMatches]);

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

      // Map results back to full profile data, sort by score, and take only TOP 3
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
        .slice(0, 3); // ONLY TOP 3

      // Persist the top 3 matches to the user's profile
      const userRef = doc(db, 'users', user.uid);
      updateDocumentNonBlocking(userRef, {
        topMatches: processedMatches,
        updatedAt: new Date().toISOString()
      });

      setMatches(processedMatches);
      toast({ title: "Vibe Analysis Complete!", description: "We've saved your top 3 high-energy connections." });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Scan Failed", description: "Vera is having trouble sensing right now." });
    } finally {
      setIsScanning(false);
    }
  };

  const handleFeatureClick = (feature: string) => {
    if (profile?.tier === 'free') {
      setLockedFeature(feature === 'messaging' ? 'Unlimited Messaging' : 'Vibe Analysis');
      setShowUpgradeModal(true);
    } else {
      toast({ title: "Feature coming soon!", description: "Messaging with matches will be available in the next update." });
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="font-bold text-muted-foreground animate-pulse">Loading Vibes...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 pt-8 md:pt-24 mb-20 min-h-screen">
      <Navigation />
      
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
            Top 3 Vibe Matches <Sparkles className="text-primary fill-current w-8 h-8" />
          </h1>
          <p className="text-muted-foreground font-medium max-w-lg">
            Vera has analyzed thousands of signals to find the 3 people who best match your current energy.
          </p>
        </div>
        
        {profile?.personalityProfile && (
          <Button 
            onClick={handleScanForMatches} 
            disabled={isScanning} 
            className="rounded-2xl h-14 px-8 font-black truevibe-gradient border-none shadow-xl shadow-primary/20 active:scale-95 transition-all"
          >
            {isScanning ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Calculating Vibes...</>
            ) : (
              <>{matches.length > 0 ? <RefreshCw className="mr-2 h-5 w-5" /> : <Zap className="mr-2 h-5 w-5 fill-current" />} {matches.length > 0 ? 'Refresh Matches' : 'Find My Top 3'}</>
            )}
          </Button>
        )}
      </header>

      {!profile?.personalityProfile ? (
        <Card className="p-16 text-center rounded-[3rem] border-none shadow-2xl bg-white animate-in zoom-in-95">
          <BrainCircuit className="w-20 h-20 mx-auto mb-6 text-primary opacity-20" />
          <h3 className="text-3xl font-black mb-3">Vibe Profile Missing</h3>
          <p className="text-muted-foreground font-medium mb-8 max-w-sm mx-auto">Complete your vibe-check with Vera to unlock weighted matching.</p>
          <Link href="/bot">
            <Button className="rounded-2xl h-16 px-12 text-xl font-black truevibe-gradient border-none shadow-lg">Start Vibe Check</Button>
          </Link>
        </Card>
      ) : matches.length === 0 ? (
        <div className="text-center py-24 bg-muted/20 rounded-[4rem] border-4 border-dashed border-muted/30">
          <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-xl font-bold text-muted-foreground">Ready to find your top 3? Click "Find My Top 3" above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          {matches.map((match) => (
            <Card key={match.id} className="group relative rounded-[3rem] overflow-hidden border-none shadow-2xl transition-all duration-500 hover:translate-y-[-8px]">
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
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center p-8 text-white z-20 backdrop-blur-sm">
                    <Crown className="w-12 h-12 mb-4 text-primary fill-current" />
                    <h4 className="text-2xl font-black mb-2">Member Only</h4>
                    <p className="text-sm font-medium opacity-80 mb-6">Upgrade to reveal photos and chat with matches.</p>
                    <Button 
                      className="bg-white text-primary hover:bg-white/90 rounded-2xl h-12 px-6 font-black"
                      onClick={() => { setLockedFeature('Profile Reveals'); setShowUpgradeModal(true); }}
                    >
                      Reveal Matches
                    </Button>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                
                <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-2 border border-white/30">
                  <span className="text-white font-black text-lg">{match.score}%</span>
                  <div className="w-2 h-2 rounded-full bg-verified animate-pulse" />
                </div>

                <div className="absolute bottom-0 p-8 text-white w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-3xl font-black">{profile.tier === 'free' ? 'TrueVibe Member' : match.name}</h3>
                    <Check className="w-5 h-5 bg-verified rounded-full p-1" />
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="bg-primary/30 border border-primary/40 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {match.age} • {match.gender}
                    </span>
                  </div>

                  <p className="text-white/80 text-sm font-medium leading-relaxed mb-6 line-clamp-3">
                    {match.reason}
                  </p>
                  
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 rounded-2xl h-14 bg-white text-black hover:bg-white/90 font-black text-sm"
                      onClick={() => handleFeatureClick('messaging')}
                    >
                      <MessageCircle className="w-4 h-4 mr-2 fill-current" /> Message
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-14 w-14 rounded-2xl bg-white/10 border-white/20 hover:bg-white/20 text-white"
                      onClick={() => handleFeatureClick('analysis')}
                    >
                      <Info className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

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