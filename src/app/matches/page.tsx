
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Sparkles, BrainCircuit, Check, Lock, MessageCircle, Loader2 } from 'lucide-react';
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
    if (!dbMatches) return;

    const fetchProfiles = async () => {
      const profiles = await Promise.all(
        dbMatches.map(async (m) => {
          const otherId = m.participantIds.find((id: string) => id !== user?.uid);
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
      // 1. Fetch other potential users
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

      // 2. Call AI matching engine
      const results = await findMatches({
        currentUser: {
          id: user.uid,
          name: profile.name || profile.displayName,
          traits: profile.personalityProfile.traits,
          summary: profile.personalityProfile.summary
        },
        potentialMatches
      });

      // 3. Save matches > 75
      let newMatchCount = 0;
      for (const result of results.matches) {
        if (result.score >= 75) {
          // Check if already exists
          const existing = dbMatches?.find(m => m.participantIds.includes(result.targetUserId));
          if (!existing) {
            const matchRef = collection(db, 'matches');
            addDocumentNonBlocking(matchRef, {
              participantIds: [user.uid, result.targetUserId],
              score: result.score,
              status: 'pending',
              createdAt: new Date().toISOString()
            });

            // Create notification for user
            const notifRef = collection(db, 'user_profiles', user.uid, 'notifications');
            addDocumentNonBlocking(notifRef, {
              userId: user.uid,
              type: 'match',
              title: 'New AI Match!',
              message: `HarmonyAI found a high compatibility match for you: ${result.score}%!`,
              read: false,
              createdAt: new Date().toISOString()
            });
            newMatchCount++;
          }
        }
      }

      toast({ 
        title: "Scan Complete", 
        description: newMatchCount > 0 ? `Found ${newMatchCount} high-compatibility matches!` : "No new high-compatibility matches found." 
      });

    } catch (error) {
      console.error("Match Scan error", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to scan for matches." });
    } finally {
      setIsScanning(false);
    }
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

  return (
    <div className="max-w-4xl mx-auto p-4 pt-8 md:pt-24 mb-20">
      <Navigation />
      
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Your Matches
            <Sparkles className="text-primary w-6 h-6" />
          </h1>
          <p className="text-muted-foreground">Based on HarmonyAI personality compatibility</p>
        </div>
        
        {profile?.personalityProfile && (
          <Button 
            onClick={handleScanForMatches} 
            disabled={isScanning}
            className="rounded-2xl h-12 px-6 gap-2 shadow-lg shadow-primary/20"
          >
            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            Scan for New Matches
          </Button>
        )}
      </header>

      {!profile?.personalityProfile ? (
        <Card className="rounded-[3rem] border-dashed border-2 bg-muted/30 p-12 text-center flex flex-col items-center">
          <BrainCircuit className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Complete your AI interview</h2>
          <p className="text-muted-foreground mb-6 max-w-xs mx-auto">To see matches tailored to your personality, HarmonyAI needs to understand who you are first.</p>
          <Link href="/bot">
            <Button className="rounded-2xl bg-primary text-white font-bold h-12 px-8">
              Start Interview
            </Button>
          </Link>
        </Card>
      ) : matchesLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      ) : matchProfiles.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">No matches yet. Click "Scan" above to find compatible members!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {matchProfiles.map((m) => (
            <Card key={m.id} className="group relative overflow-hidden rounded-[2.5rem] border-none shadow-md hover:shadow-xl transition-all duration-300">
              <div className="relative aspect-[4/5] w-full">
                <Image 
                  src={m.photoURL || `https://picsum.photos/seed/${m.id}/600/800`} 
                  alt={m.name} 
                  fill 
                  className={cn("object-cover transition-all duration-500", !isVerified && "blur-xl grayscale scale-110")}
                />
                
                {!isVerified && (
                  <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center text-white">
                    <Lock className="w-12 h-12 mb-4 opacity-80" />
                    <h4 className="text-xl font-bold mb-2">Verified Only</h4>
                    <Link href="/verification">
                      <Button className="rounded-2xl bg-white text-primary hover:bg-white/90 font-bold">Verify Now</Button>
                    </Link>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-0 left-0 p-6 w-full">
                  <div className="flex justify-between items-end">
                    <div className="text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold">{isVerified ? m.name : "Member"}</h3>
                        {m.isVerified && (
                          <div className="bg-verified p-0.5 rounded-full">
                            <Check className="w-3 h-3 text-white stroke-[4]" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2 text-white/90 mb-4">
                        {isVerified ? (m.personalityProfile?.summary || m.bio) : "Connect to see details."}
                      </p>
                      
                      {isVerified && (
                        <Button 
                          onClick={() => handleStartChat(m.id)}
                          className="rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 gap-2 h-9 text-xs"
                        >
                          <MessageCircle className="w-4 h-4" /> Message
                        </Button>
                      )}
                    </div>
                    <div className="bg-primary/90 backdrop-blur-sm text-white font-bold text-xs px-3 py-2 rounded-2xl flex flex-col items-center shrink-0">
                      <Heart className="w-4 h-4 mb-0.5 fill-current" />
                      {m.matchData.score}%
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
