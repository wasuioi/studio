
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Edit3, ShieldAlert, ArrowRight, Heart, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { initiateAnonymousSignIn } from '@/firebase';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  const { profile, user, loading } = useAuth();
  const { auth } = (typeof window !== 'undefined') ? require('@/firebase') : { auth: null };

  const handleSignIn = () => {
    if (auth) {
      initiateAnonymousSignIn(auth);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-primary font-medium animate-pulse">Syncing with HarmonyAI...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-8 relative">
          <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <Heart className="w-20 h-20 text-primary relative fill-primary/10" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">HarmonyAI</h1>
        <p className="text-muted-foreground max-w-xs mb-8 text-lg">
          The world's first AI-driven dating experience designed for meaningful connections.
        </p>
        <Button 
          onClick={handleSignIn}
          size="lg" 
          className="rounded-2xl h-14 px-10 text-lg font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
        >
          Get Started
          <Sparkles className="ml-2 w-5 h-5" />
        </Button>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-md mx-auto p-4 pt-8 md:pt-24 min-h-screen pb-32">
      <Navigation />
      
      <Card className="overflow-hidden border-none shadow-lg mb-8 rounded-[2.5rem] bg-white">
        <div className="relative h-64 w-full bg-primary/10">
          <Image 
            src={profile.photoURL} 
            alt={profile.displayName} 
            fill 
            className="object-cover"
            data-ai-hint="user portrait"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
        <CardContent className="pt-6 relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2 mb-1">
                {profile.displayName}
                {profile.isVerified ? (
                  <Badge className="bg-verified hover:bg-verified text-white gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge className="bg-unverified hover:bg-unverified text-white gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider">
                    <AlertCircle className="w-3 h-3" />
                    Unverified
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground text-sm font-medium">{profile.bio}</p>
            </div>
            <Button size="icon" variant="secondary" className="rounded-2xl bg-muted h-12 w-12 hover:bg-primary/10 transition-colors">
              <Edit3 className="w-5 h-5 text-primary" />
            </Button>
          </div>

          {!profile.isVerified && (
            <Link href="/verification">
              <div className="mb-6 p-4 bg-primary/5 border border-primary/10 rounded-3xl flex items-center gap-4 group cursor-pointer hover:bg-primary/10 transition-colors">
                <div className="bg-primary/10 p-2 rounded-2xl group-hover:scale-110 transition-transform">
                  <ShieldAlert className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-primary mb-0.5">Safety First</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    Verify your identity to unlock messaging and trusted matches.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary/40" />
              </div>
            </Link>
          )}

          <Button className="w-full rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold h-14 text-lg shadow-lg shadow-primary/10">
            Edit Profile
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <FeatureLinkCard 
          title="AI Personality Bot"
          description="Analyze your communication style and values with our advanced AI."
          href="/bot"
          icon={<Sparkles className="w-5 h-5" />}
          buttonText="Start Interview"
        />

        <FeatureLinkCard 
          title="My Matches"
          description="Explore curated profiles that resonate with your unique personality."
          href="/matches"
          icon={<Heart className="w-5 h-5" />}
          buttonText="Explore"
        />

        <FeatureLinkCard 
          title="Messages"
          description="Connect and chat with your matches in a secure environment."
          href="/messages"
          buttonText="Open Inbox"
          disabled={!profile.isVerified}
          disabledMessage="Verification required"
        />
      </div>
    </div>
  );
}

function FeatureLinkCard({ title, description, href, buttonText, disabled, disabledMessage, icon }: any) {
  return (
    <Card className={cn("rounded-[2rem] border-none shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm", disabled && "opacity-80")}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-2">
          {icon && <div className="text-primary">{icon}</div>}
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{description}</p>
        <Link href={disabled ? "#" : href} className="block">
          <Button 
            className={cn(
              "w-full rounded-2xl font-bold flex items-center justify-between h-12 px-6 transition-all",
              disabled 
                ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50" 
                : "bg-accent text-accent-foreground hover:bg-primary/10 hover:text-primary"
            )}
            disabled={disabled}
          >
            <span>{disabled ? (disabledMessage || "Locked") : buttonText}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
