"use client";

import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Edit3, ShieldAlert, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfilePage() {
  const { profile, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Loading Harmony...</div>;
  if (!profile) return <div className="p-8 text-center">Please sign in to view your profile.</div>;

  return (
    <div className="max-w-md mx-auto p-4 pt-8 md:pt-24 min-h-screen">
      <Navigation />
      
      <Card className="overflow-hidden border-none shadow-lg mb-8 rounded-3xl bg-white">
        <div className="relative h-48 w-full bg-primary/10">
          <Image 
            src={profile.photoURL} 
            alt={profile.displayName} 
            fill 
            className="object-cover"
            data-ai-hint="user portrait"
          />
        </div>
        <CardContent className="pt-6">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {profile.displayName}
                {profile.isVerified ? (
                  <Badge variant="outline" className="border-verified text-verified bg-verified/10 gap-1 rounded-full px-2 py-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-unverified text-unverified bg-unverified/10 gap-1 rounded-full px-2 py-0">
                    <AlertCircle className="w-3 h-3" />
                    Unverified
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground text-sm line-clamp-2">{profile.bio}</p>
            </div>
            <Button size="icon" variant="secondary" className="rounded-full">
              <Edit3 className="w-4 h-4" />
            </Button>
          </div>

          {!profile.isVerified && (
            <div className="mt-4 p-3 bg-unverified/10 border border-unverified/20 rounded-xl flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-unverified shrink-0" />
              <p className="text-xs font-medium text-unverified">
                Verify your identity to unlock messaging and trusted matches.
              </p>
            </div>
          )}

          <Button className="w-full mt-6 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold h-12">
            Edit Profile
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <FeatureLinkCard 
          title="AI Personality Bot"
          description="Analyze your communication style and values with our advanced AI."
          href="/bot"
          buttonText="Start Interview"
        />

        <FeatureLinkCard 
          title="My Matches"
          description="Explore curated profiles that resonate with your unique personality."
          href="/matches"
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

function FeatureLinkCard({ title, description, href, buttonText, disabled, disabledMessage }: any) {
  return (
    <Card className={cn("rounded-3xl border-none shadow-sm overflow-hidden", disabled && "opacity-80")}>
      <CardContent className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Link href={disabled ? "#" : href}>
          <Button 
            className={cn(
              "w-full rounded-2xl font-semibold flex items-center justify-between px-6",
              disabled ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-accent text-accent-foreground hover:bg-accent/80"
            )}
            disabled={disabled}
          >
            <span>{disabled ? disabledMessage : buttonText}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}