"use client";

import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, ShieldCheck, Zap, ArrowRight, Star } from 'lucide-react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';

export default function LandingPage() {
  const { user } = useUser();
  const router = useRouter();

  const handleStart = () => {
    if (user) {
      if (!user.emailVerified) {
        router.push('/auth/verify');
      } else {
        router.push('/bot');
      }
    } else {
      router.push('/auth/login');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-6 text-center overflow-x-hidden">
      <Navigation />
      
      <div className="max-w-5xl mx-auto space-y-12 md:space-y-16 py-12 md:py-24">
        {/* Hero Section */}
        <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="mb-4 md:mb-8">
            <Logo size="lg" className="mx-auto transform scale-75 md:scale-100" />
          </div>
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 md:px-6 py-1.5 md:py-2 rounded-full text-primary font-black text-[10px] md:text-xs uppercase tracking-widest border border-primary/20">
            <Star className="w-3 h-3 md:w-4 md:h-4 fill-current" />
            Real Vibes Only
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tight text-foreground leading-[1.1] px-2">
            Find Your <span className="truevibe-text-gradient">True Vibe</span>
          </h1>
          <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium px-4">
            Tired of surface-level swiping? TrueVibe uses AI-powered personality analysis to find connections that actually match your energy.
          </p>
          <div className="pt-4 md:pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="w-full sm:w-auto rounded-[2rem] h-16 md:h-20 px-10 md:px-16 text-xl md:text-2xl font-black shadow-2xl shadow-primary/40 hover:scale-105 transition-all duration-300 truevibe-gradient border-none"
              onClick={handleStart}
            >
              Get Started
              <ArrowRight className="ml-2 w-6 h-6 md:w-8 md:h-8" />
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 text-left pt-12 px-4">
          <FeatureCard 
            icon={<Zap className="w-6 h-6 md:w-8 md:h-8 text-primary fill-current" />}
            title="Vera AI Agent"
            description="Chat with Vera, your personal vibe companion, to reveal the true depth of your personality."
          />
          <FeatureCard 
            icon={<ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-verified fill-current" />}
            title="Total Authenticity"
            description="Mandatory identity verification means zero catfishing. Just real people looking for real vibes."
          />
          <FeatureCard 
            icon={<Heart className="w-6 h-6 md:w-8 md:h-8 text-destructive fill-current" />}
            title="Vibe Matching"
            description="Our algorithm prioritizes values and energy alignment over superficial filters."
          />
        </div>
      </div>

      {/* Background elements */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary rounded-full blur-[120px]" />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="rounded-[2rem] md:rounded-[3rem] border-none shadow-2xl shadow-primary/5 bg-white/70 backdrop-blur-md p-6 md:p-10 flex flex-col items-start text-left hover:translate-y-[-8px] transition-all duration-300">
      <div className="mb-4 md:mb-6 bg-accent w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-inner">
        {icon}
      </div>
      <h3 className="text-xl md:text-2xl font-black mb-2 md:mb-3 tracking-tight">{title}</h3>
      <p className="text-sm md:text-base text-muted-foreground leading-relaxed font-medium">{description}</p>
    </Card>
  );
}
