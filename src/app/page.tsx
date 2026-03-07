"use client";

import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { Rocket, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

interface StarProps {
  top: string;
  left: string;
  width: string;
  height: string;
  delay: string;
  opacity: number;
}

export default function LandingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [stars, setStars] = useState<StarProps[]>([]);

  useEffect(() => {
    // Generate star properties only on the client to avoid hydration mismatch
    const generatedStars = [...Array(30)].map(() => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      width: `${Math.random() * 2 + 1}px`,
      height: `${Math.random() * 2 + 1}px`,
      delay: `${Math.random() * 5}s`,
      opacity: Math.random() * 0.7
    }));
    setStars(generatedStars);
  }, []);

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
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 text-center overflow-hidden bg-[#0F0819]">
      {/* Immersive Nebula Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Deep Purple Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-[#6C3BFF] rounded-full blur-[150px] opacity-30" />
        {/* Coral/Pink Glow */}
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-[#FF6B6B] rounded-full blur-[150px] opacity-30" />
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&q=80')] opacity-5 mix-blend-overlay bg-cover" />
      </div>

      <Navigation />
      
      <main className="relative z-10 max-w-lg w-full space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="space-y-10">
          <div className="flex justify-center relative">
            {/* Logo Glow */}
            <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full scale-150" />
            <Logo size="lg" showText={false} className="relative z-10 transform scale-125 md:scale-150 transition-transform hover:scale-135 duration-500" />
          </div>
          
          <div className="space-y-4 pt-4">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-[1.1]">
              Find Your<br />True Vibe
            </h1>
            <p className="text-lg md:text-xl text-white/80 font-medium px-4 max-w-sm mx-auto leading-relaxed">
              Intentional dating for<br />value real connection.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-6 pt-4">
          <Button 
            size="lg" 
            className="w-full h-16 rounded-full bg-white text-[#6C3BFF] hover:bg-white/90 text-xl font-black shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all duration-300 active:scale-95 border-none"
            onClick={handleStart}
          >
            <Rocket className="mr-3 w-6 h-6 fill-current" />
            Start with AI
          </Button>
          
          <Link href="/auth/signup" className="block">
            <Button 
              size="lg" 
              variant="outline"
              className="w-full h-16 rounded-full bg-[#1A1A1A]/40 backdrop-blur-md border-white/20 text-white hover:bg-white/10 text-xl font-black transition-all duration-300 active:scale-95 shadow-lg"
            >
              Sign Up
            </Button>
          </Link>
        </div>

        <div className="pt-10">
          <div className="inline-flex items-center gap-2.5 text-white/50 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em]">
            <ShieldCheck className="w-4 h-4 text-[#FF6B6B]" />
            Verified profiles only. No fake accounts.
          </div>
        </div>
      </main>

      {/* Decorative Stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {stars.map((star, i) => (
          <div 
            key={i}
            className="absolute bg-white rounded-full animate-pulse"
            style={{
              top: star.top,
              left: star.left,
              width: star.width,
              height: star.height,
              animationDelay: star.delay,
              opacity: star.opacity
            }}
          />
        ))}
      </div>
    </div>
  );
}
