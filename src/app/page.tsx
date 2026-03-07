
"use client";

import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BrainCircuit, Heart, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <Navigation />
      
      <div className="max-w-4xl mx-auto space-y-12 py-20">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-primary font-bold text-sm animate-bounce mx-auto">
            <Sparkles className="w-4 h-4" />
            The Future of Connection
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground">
            Find Harmony with <span className="text-primary">AI</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            HarmonyAI is the world's first dating experience designed for meaningful connections, powered by advanced personality analysis.
          </p>
          <div className="pt-4">
            <Button 
              size="lg" 
              className="rounded-2xl h-16 px-12 text-xl font-bold shadow-2xl shadow-primary/30 hover:scale-105 transition-transform"
              onClick={handleStart}
            >
              Get Started
              <ArrowRight className="ml-2 w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <FeatureCard 
            icon={<BrainCircuit className="w-8 h-8 text-primary" />}
            title="AI Interview"
            description="Chat with HarmonyAI to build a deep profile based on your values and communication style."
          />
          <FeatureCard 
            icon={<ShieldCheck className="w-8 h-8 text-verified" />}
            title="Verified Safety"
            description="Our mandatory identity verification ensures you only connect with real, genuine people."
          />
          <FeatureCard 
            icon={<Heart className="w-8 h-8 text-destructive" />}
            title="Smart Matches"
            description="Receive curated match suggestions with compatibility scores tailored to your personality."
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="rounded-[2rem] border-none shadow-md bg-white/50 backdrop-blur-sm p-8 flex flex-col items-start text-left">
      <div className="mb-4 bg-background w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </Card>
  );
}
