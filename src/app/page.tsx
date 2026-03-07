"use client";

import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Heart, ShieldCheck, Zap, ArrowRight, Star } from 'lucide-react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const { user } = useUser();
  const router = useRouter();

  const handleStart = () => {
    if (user) {
      router.push('/bot');
    } else {
      router.push('/auth/login');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center overflow-x-hidden">
      <Navigation />
      
      <div className="max-w-5xl mx-auto space-y-16 py-24">
        {/* Hero Section */}
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-6 py-2 rounded-full text-primary font-black text-xs uppercase tracking-widest border border-primary/20">
            <Star className="w-4 h-4 fill-current" />
            Real Vibes Only
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight text-foreground leading-[1.1]">
            Find Your <span className="truevibe-text-gradient">True Vibe</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium">
            Tired of surface-level swiping? TrueVibe uses AI-powered personality analysis to find connections that actually match your energy.
          </p>
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="rounded-[2rem] h-20 px-16 text-2xl font-black shadow-2xl shadow-primary/40 hover:scale-105 transition-all duration-300 truevibe-gradient border-none"
              onClick={handleStart}
            >
              Start Your Journey
              <ArrowRight className="ml-2 w-8 h-8" />
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left pt-12">
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-primary fill-current" />}
            title="Vera AI Agent"
            description="Chat with Vera, your personal vibe companion, to reveal the true depth of your personality."
          />
          <FeatureCard 
            icon={<ShieldCheck className="w-8 h-8 text-verified fill-current" />}
            title="Total Authenticity"
            description="Mandatory identity verification means zero catfishing. Just real people looking for real vibes."
          />
          <FeatureCard 
            icon={<Heart className="w-8 h-8 text-destructive fill-current" />}
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
    <Card className="rounded-[3rem] border-none shadow-2xl shadow-primary/5 bg-white/70 backdrop-blur-md p-10 flex flex-col items-start text-left hover:translate-y-[-8px] transition-all duration-300">
      <div className="mb-6 bg-accent w-20 h-20 rounded-3xl flex items-center justify-center shadow-inner">
        {icon}
      </div>
      <h3 className="text-2xl font-black mb-3 tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-base leading-relaxed font-medium">{description}</p>
    </Card>
  );
}