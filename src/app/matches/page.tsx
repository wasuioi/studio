
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Sparkles, BrainCircuit, Check, Lock, MessageCircle, Loader2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  useFirestore, 
  addDocumentNonBlocking, 
  useCollection, 
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { findMatches } from '@/ai/flows/find-matches-flow';
import { useToast } from '@/hooks/use-toast';

export default function MatchesPage() {
  const { profile, user, loading } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const matchesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(db, 'matches'),
      where('participantIds', 'array-contains', user.uid)
    );
  }, [db, user]);

  const { data: dbMatches, isLoading: matchesLoading } = useCollection(matchesQuery);
  const [matchProfiles, setMatchProfiles] = useState<any[]>([]);

  useEffect(() => {
    if (!dbMatches || !user) return;
    const fetchProfiles = async () => {
      const profiles = await Promise.all(
        dbMatches.map(async (m) => {
          const otherId = m.participantIds.find((id: string) => id !== user.uid);
          const pDoc = await getDocs(query(collection(db, 'users'), where('id', '==', otherId), limit(1)));
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
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(20)));
      const potentialMatches = usersSnap.docs
        .filter(d => d.id !== user.uid && d.data().personalityProfile)
        .map(d => ({
          id: d.id,
          name: d.data().name || d.data().displayName,
          traits: d.data().personalityProfile.traits,
          summary: d.data().personalityProfile.summary
        }));

      if (potentialMatches.length === 0) {
        toast({ title: "No new profiles found." });
        return;
      }

      const results = await findMatches({
        currentUser: {
          id: user.uid,
          name: profile.name,
          traits: profile.personalityProfile.traits,
          summary: profile.personalityProfile.summary
        },
        potentialMatches
      });

      for (const result of results.matches) {
        if (result.score >= 75) {
          const existing = dbMatches?.find(m => m.participantIds.includes(result.targetUserId));
          if (!existing) {
            addDocumentNonBlocking(collection(db, 'matches'), {
              participantIds: [user.uid, result.targetUserId],
              score: result.score,
              status: 'pending',
              createdAt: new Date().toISOString()
            });
          }
        }
      }
      toast({ title: "Scan Complete" });
    } finally {
      setIsScanning(false);
    }
  };

  if (loading || matchesLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  const currentMatch = matchProfiles[currentIndex];

  return (
    <div className="max-w-4xl mx-auto p-4 pt-8 md:pt-24 mb-20 min-h-screen">
      <Navigation />
      
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-black flex items-center gap-2">Matches <Sparkles className="text-primary" /></h1>
        {profile?.personalityProfile && (
          <Button variant="ghost" size="icon" onClick={handleScanForMatches} disabled={isScanning} className="rounded-full bg-accent">
            {isScanning ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
          </Button>
        )}
      </header>

      {!profile?.personalityProfile ? (
        <Card className="p-12 text-center rounded-[3rem]">
          <BrainCircuit className="w-12 h-12 mx-auto mb-4 text-primary opacity-30" />
          <h3 className="text-xl font-bold mb-2">Finish Interview</h3>
          <p className="text-muted-foreground mb-6">Complete the AI interview to find matches.</p>
          <Link href="/bot"><Button className="rounded-xl px-8">Start AI Interview</Button></Link>
        </Card>
      ) : !currentMatch ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">No matches found. Try scanning!</p>
        </div>
      ) : (
        <div className="max-w-sm mx-auto">
          <Card className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden shadow-2xl">
            <Image 
              src={currentMatch.photoURL} 
              alt={currentMatch.name} 
              fill 
              className={cn("object-cover", !profile.identityVerified && "blur-xl")}
            />
            
            {!profile.identityVerified && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 text-white z-20">
                <Lock className="w-12 h-12 mb-4" />
                <h4 className="text-xl font-bold mb-2">Verified Members Only</h4>
                <Link href="/verification"><Button className="bg-white text-primary rounded-xl">Verify Identity</Button></Link>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
            
            <div className="absolute bottom-0 p-8 text-white w-full">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-2xl font-black">{currentMatch.name}</h3>
                {currentMatch.identityVerified && <Check className="w-4 h-4 bg-verified rounded-full p-0.5" />}
              </div>
              <p className="text-white/80 text-sm line-clamp-2 mb-4">{currentMatch.bio}</p>
              
              <div className="flex gap-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentIndex(prev => prev + 1)} className="rounded-full bg-white/10 border-white/20"><X /></Button>
                <Button className="flex-1 rounded-2xl bg-primary">Like</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
