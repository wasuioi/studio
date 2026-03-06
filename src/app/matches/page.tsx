
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MapPin, Sparkles, BrainCircuit, Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function MatchesPage() {
  const { profile } = useAuth();

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
    },
    { 
      id: 'm4', 
      name: 'David', 
      age: 31, 
      match: '89%', 
      bio: 'Fitness coach and wellness advocate. Always learning.',
      photo: PlaceHolderImages[3].imageUrl,
      verified: true
    }
  ];

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
                  className="object-cover transition-transform group-hover:scale-105"
                  data-ai-hint="dating profile photo"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                
                <div className="absolute bottom-0 left-0 p-6 w-full">
                  <div className="flex justify-between items-end">
                    <div className="text-white">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold">{match.name}, {match.age}</h3>
                        {match.verified && (
                          <div className="bg-verified p-0.5 rounded-full">
                            <Check className="w-3 h-3 text-white stroke-[4]" />
                          </div>
                        )}
                      </div>
                      <p className="text-white/80 text-xs flex items-center gap-1 mb-2">
                        <MapPin className="w-3 h-3" /> 2 miles away
                      </p>
                      <p className="text-sm line-clamp-2 text-white/90">{match.bio}</p>
                    </div>
                    <div className="bg-primary/90 backdrop-blur-sm text-white font-bold text-xs px-3 py-2 rounded-2xl flex flex-col items-center">
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
