
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Sparkles, BrainCircuit, Check, Lock, MessageCircle, Loader2, X, Info } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  useFirestore, 
  addDocumentNonBlocking, 
  useCollection, 
  useMemoFirebase,
  updateDocumentNonBlocking
} from '@/firebase';
import { collection, query, where, getDocs, doc, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { findMatches } from '@/ai/flows/find-matches-flow';
import { useToast } from '@/hooks/use-toast';

export default function MatchesPage() {
  const { profile, user } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Real matches from Firestore
  const matchesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(db, 'matches'),
      where('participantIds', 'array-contains', user.uid)
    );
  }, [db, user]);

  const { data: dbMatches, isLoading: matchesLoading } = useCollection(matchesQuery);

  // Fetch other participants' profiles for the matches
  const [matchProfiles, setMatchProfiles] = useState<any[]>([]);

  useEffect(() => {
    if (!dbMatches || !user) return;

    const fetchProfiles = async () => {
      const profiles = await Promise.all(
        dbMatches.map(async (m) => {
          const otherId = m.participantIds.find((id: string) => id !== user.uid);
          const pDoc = await getDocs(query(collection(db, 'user_profiles'), where('id', '==', otherId), limit(1)));
          return pDoc.docs.length > 0 ? { ...pDoc.docs[0].data(), matchData: m } : null;
        })
      );
      setMatchProfiles(profiles.filter(p => p !== null));
    };

    fetchProfiles();
  }, [dbMatches, db, user]);

  const handleScanForMatches = async () => {
    if (!user || !profile?.personalityProfile || isScanning) return;

    setIsScanning(true);
    try {
      const usersSnap = await getDocs(query(collection(db, 'user_profiles'), limit(20)));
      const potentialMatches = usersSnap.docs
        .filter(d => d.id !== user.uid && d.data().personalityProfile)
        .map(d => ({
          id: d.id,
          name: d.data().name || d.data().displayName,
          traits: d.data().personalityProfile.traits,
          summary: d.data().personalityProfile.summary
        }));

      if (potentialMatches.length === 0) {
        toast({ title: "Scanning Complete", description: "No new personality profiles found to match with yet." });
        return;
      }

      const results = await findMatches({
        currentUser: {
          id: user.uid,
          name: profile.name || profile.displayName,
          traits: profile.personalityProfile.traits,
          summary: profile.personalityProfile.summary
        },
        potentialMatches
      });

      let newMatchCount = 0;
      for (const result of results.matches) {
        if (result.score >= 70) {
          const existing = dbMatches?.find(m => m.participantIds.includes(result.targetUserId));
          if (!existing) {
            const matchRef = collection(db, 'matches');
            addDocumentNonBlocking(matchRef, {
              participantIds: [user.uid, result.targetUserId],
              score: result.score,
              status: 'pending',
              createdAt: new Date().toISOString()
            });
            newMatchCount++;
          }
        }
      }

      toast({ 
        title: "Scan Complete", 
        description: newMatchCount > 0 ? `Found ${newMatchCount} high-compatibility matches!` : "No new matches found right now." 
      });

    } catch (error) {
      console.error("Match Scan error", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to scan for matches." });
    } finally {
      setIsScanning(false);
    }
  };

  const handleLike = (targetId: string) => {
    toast({ title: "Liked!", description: "We'll let them know you're interested." });
    setCurrentIndex(prev => prev + 1);
  };

  const handleSkip = () => {
    setCurrentIndex(prev => prev + 1);
  };

  const handleStartChat = async (targetUserId: string) => {
    if (!user) return;
    const convRef = collection(db, 'conversations');
    const q = query(convRef, where('participantIds', 'array-contains', user.uid));
    const snapshot = await getDocs(q);
    
    let existingConv = snapshot.docs.find(doc => 
      doc.data().participantIds.includes(targetUserId)
    );

    if (existingConv) {
      router.push('/messages');
      return;
    }

    addDocumentNonBlocking(convRef, {
      participantIds: [user.uid, targetUserId],
      lastMessage: '',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    router.push('/messages');
  };

  const isVerified = profile?.isVerified || profile?.verificationStatus === 'verified';
  const currentMatch = matchProfiles[currentIndex];

  return (
    <div className="max-w-4xl mx-auto p-4 pt-8 md:pt-24 mb-20 min-h-screen flex flex-col">
      <Navigation />
      
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2">
            Matches
            <Sparkles className="text-primary w-6 h-6" />
          </h1>
          <p className="text-muted-foreground text-sm">AI Compatibility Score</p>
        </div>
        
        {profile?.personalityProfile && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleScanForMatches} 
            disabled={isScanning}
            className="rounded-full bg-accent/50"
          >
            {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
          </Button>
        )}
      </header>

      {!profile?.personalityProfile ? (
        <Card className="flex-1 rounded-[3rem] border-dashed border-2 bg-muted/20 p-12 text-center flex flex-col items-center justify-center">
          <BrainCircuit className="w-16 h-16 text-primary/30 mb-6" />
          <h2 className="text-2xl font-bold mb-3">Build your profile</h2>
          <p className="text-muted-foreground mb-8 max-w-xs">Complete the HarmonyAI interview to find people who truly match your values.</p>
          <Link href="/bot">
            <Button className="rounded-2xl bg-primary text-white font-bold h-14 px-10 shadow-lg shadow-primary/20">
              Start AI Interview
            </Button>
          </Link>
        </Card>
      ) : matchesLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      ) : !currentMatch ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div className="bg-muted rounded-full p-8">
            <Sparkles className="w-12 h-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">That's everyone for now!</h3>
          <p className="text-muted-foreground max-w-xs">Try scanning for new members or check back later.</p>
          <Button variant="outline" className="rounded-2xl" onClick={() => setCurrentIndex(0)}>
            Start Over
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-sm mx-auto w-full">
          <Card className="relative flex-1 rounded-[2.5rem] overflow-hidden shadow-2xl border-none group bg-white">
            <Image 
              src={currentMatch.photoURL || `https://picsum.photos/seed/${currentMatch.id}/800/1000`} 
              alt={currentMatch.name} 
              fill 
              className={cn(
                "object-cover transition-all duration-700 group-hover:scale-105", 
                !isVerified && "blur-2xl grayscale scale-125"
              )}
            />
            
            {!isVerified && (
              <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center text-white">
                <Lock className="w-16 h-16 mb-6 opacity-80" />
                <h4 className="text-2xl font-extrabold mb-3">Verified Area</h4>
                <p className="text-sm text-white/80 mb-8 leading-relaxed">Identity verification is mandatory to unlock full profiles and messaging.</p>
                <Link href="/verification">
                  <Button className="rounded-2xl bg-white text-primary hover:bg-white/90 font-bold h-12 px-8">Verify My Identity</Button>
                </Link>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
            
            <div className="absolute top-6 left-6 z-10">
              <div className="bg-primary/90 backdrop-blur-md text-white font-black text-lg px-4 py-2 rounded-2xl flex items-center gap-2 shadow-xl">
                <Heart className="w-5 h-5 fill-current" />
                {currentMatch.matchData.score}%
              </div>
            </div>

            <div className="absolute bottom-0 left-0 p-8 w-full text-white z-10">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-3xl font-black">{isVerified ? (currentMatch.displayName || currentMatch.name) : "Harmony Member"}</h3>
                {currentMatch.isVerified && (
                  <div className="bg-verified p-1 rounded-full shadow-lg">
                    <Check className="w-4 h-4 text-white stroke-[4]" />
                  </div>
                )}
              </div>
              <p className="text-white/80 text-sm leading-relaxed line-clamp-3 mb-6">
                {isVerified ? (currentMatch.personalityProfile?.summary || currentMatch.bio) : "Connect and verify to see detailed personality summary."}
              </p>
              
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleSkip}
                  className="w-16 h-16 rounded-full border-white/20 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all active:scale-90"
                >
                  <X className="w-8 h-8" />
                </Button>
                <Button 
                  onClick={() => handleLike(currentMatch.id)}
                  className="flex-1 h-16 rounded-[2rem] bg-primary text-white font-black text-xl shadow-xl shadow-primary/40 transition-all active:scale-95"
                >
                  Like
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => isVerified && handleStartChat(currentMatch.id)}
                  className="w-16 h-16 rounded-full border-white/20 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all active:scale-90"
                  disabled={!isVerified}
                >
                  <MessageCircle className="w-8 h-8" />
                </Button>
              </div>
            </div>
          </Card>
          
          <div className="flex justify-center mt-6 gap-2">
            {matchProfiles.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1.5 transition-all rounded-full",
                  i === currentIndex ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
                )} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
