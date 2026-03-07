
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MapPin, Sparkles, BrainCircuit, Check, ShieldAlert, Lock, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function MatchesPage() {
  const { profile, user } = useAuth();
  const db = useFirestore();
  const router = useRouter();

  // Mock matches data
  const matches = [
    { 
      id: 'm1', 
      name: 'Elena', 
      age: 26, 
      match: '98%', 
      bio: 'Loves hiking and digital art. Values authenticity above all.',
      photo: PlaceHolderImages[0].imageUrl,
      verified: true
    },
    { 
      id: 'm2', 
      name: 'Marcus', 
      age: 29, 
      match: '94%', 
      bio: 'Chef by day, philosopher by night. Looking for deep conversations.',
      photo: PlaceHolderImages[1].imageUrl,
      verified: true
    },
    { 
      id: 'm3', 
      name: 'Sarah', 
      age: 24, 
      match: '91%', 
      bio: 'Travel enthusiast and tech geek. Let\'s explore the world together.',
      photo: PlaceHolderImages[2].imageUrl,
      verified: false
    }
  ];

  const isVerified = profile?.isVerified || profile?.verificationStatus === 'verified';

  const handleStartChat = async (matchId: string) => {
    if (!user || !isVerified) return;

    // Check if conversation already exists (simplified for MVP)
    const convRef = collection(db, 'conversations');
    const q = query(convRef, where('participantIds', 'array-contains', user.uid));
    const snapshot = await getDocs(q);
    
    let existingConv = snapshot.docs.find(doc => 
      doc.data().participantIds.includes(matchId)
    );

    if (existingConv) {
      router.push('/messages');
      return;
    }

    // Create new conversation
    const newConv = {
      participantIds: [user.uid, matchId],
      lastMessage: '',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(convRef, newConv);
    router.push('/messages');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pt-8 md:pt-24 mb-20">
      <Navigation />
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          Your Matches
          <Sparkles className="text-primary w-6 h-6" />
        </h1>
        <p className="text-muted-foreground">Based on your HarmonyAI personality analysis</p>
      </header>

      {!profile?.personalityProfile ? (
        <Card className="rounded-3xl border-dashed border-2 bg-muted/30 p-12 text-center flex flex-col items-center">
          <BrainCircuit className="w-12 h-12 text-primary/40 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Complete your AI interview</h2>
          <p className="text-muted-foreground mb-6 max-w-xs mx-auto">To see matches tailored to your personality, you need to chat with HarmonyAI first.</p>
          <Link href="/bot">
            <Button className="rounded-2xl bg-primary text-white font-bold h-12 px-8">
              Start Now
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
          {matches.map((match) => (
            <Card key={match.id} className="group relative overflow-hidden rounded-[2.5rem] border-none shadow-md hover:shadow-xl transition-all duration-300">
              <div className="relative aspect-[4/5] w-full">
                <Image 
                  src={match.photo} 
                  alt={match.name} 
                  fill 
                  className={cn("object-cover transition-all duration-500", !isVerified && "blur-xl grayscale scale-110")}
                  data-ai-hint="dating profile photo"
                />
                
                {/* Overlay for unverified users */}
                {!isVerified && (
                  <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center text-white">
                    <Lock className="w-12 h-12 mb-4 opacity-80" />
                    <h4 className="text-xl font-bold mb-2">Verified Members Only</h4>
                    <p className="text-sm text-white/80 mb-6">Complete identity verification to unlock match profiles and social posts.</p>
                    <Link href="/verification">
                      <Button className="rounded-2xl bg-white text-primary hover:bg-white/90 font-bold">
                        Verify Now
                      </Button>
                    </Link>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-0 left-0 p-6 w-full">
                  <div className="flex justify-between items-end">
                    <div className="text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold">{isVerified ? `${match.name}, ${match.age}` : "Harmony Member"}</h3>
                        {match.verified && (
                          <div className="bg-verified p-0.5 rounded-full">
                            <Check className="w-3 h-3 text-white stroke-[4]" />
                          </div>
                        )}
                      </div>
                      <p className="text-white/80 text-xs flex items-center gap-1 mb-2">
                        <MapPin className="w-3 h-3" /> {isVerified ? "2 miles away" : "Hidden location"}
                      </p>
                      <p className="text-sm line-clamp-2 text-white/90 mb-4">
                        {isVerified ? match.bio : "Connect with verified users to see their full profile and posts."}
                      </p>
                      
                      {isVerified && (
                        <Button 
                          onClick={() => handleStartChat(match.id)}
                          className="rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 gap-2 h-9 text-xs"
                        >
                          <MessageCircle className="w-4 h-4" /> Message
                        </Button>
                      )}
                    </div>
                    <div className="bg-primary/90 backdrop-blur-sm text-white font-bold text-xs px-3 py-2 rounded-2xl flex flex-col items-center shrink-0">
                      <Heart className="w-4 h-4 mb-0.5 fill-current" />
                      {match.match}
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
