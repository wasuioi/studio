"use client";

import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { Rocket, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

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
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 text-center overflow-hidden bg-[#0F0819]">
      {/* Immersive Nebula Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#6C3BFF] rounded-full blur-[120px] opacity-20" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#FF6B6B] rounded-full blur-[120px] opacity-20" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&q=80')] opacity-10 mix-blend-overlay bg-cover" />
      </div>

      <Navigation />
      
      <main className="relative z-10 max-w-lg w-full space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="space-y-8">
          <div className="flex justify-center">
            <Logo size="lg" showText={false} className="transform scale-110 md:scale-125" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-tight">
              Find Your<br />True Vibe
            </h1>
            <p className="text-lg md:text-xl text-white/70 font-medium px-4">
              Intentional dating for<br />value real connection.
            </p>
          </div>
        </div>

        <div className="space-y-4 px-6">
          <Button 
            size="lg" 
            className="w-full h-16 rounded-full bg-white text-[#4B1FAF] hover:bg-white/90 text-xl font-black shadow-2xl transition-all duration-300 active:scale-95 border-none"
            onClick={handleStart}
          >
            <Rocket className="mr-2 w-6 h-6 fill-current" />
            Start with AI
          </Button>
          
          <Link href="/auth/signup" className="block">
            <Button 
              size="lg" 
              variant="outline"
              className="w-full h-16 rounded-full bg-[#4B1FAF]/30 border-white/10 text-white hover:bg-[#4B1FAF]/50 text-xl font-black transition-all duration-300 active:scale-95"
            >
              Sign Up
            </Button>
          </Link>
        </div>

        <div className="pt-8">
          <div className="inline-flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" />
            Verified profiles only. No fake accounts.
          </div>
        </div>
      </main>

      {/* Decorative Stars */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i}
            className="absolute bg-white rounded-full animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 3}px`,
              height: `${Math.random() * 3}px`,
              animationDelay: `${Math.random() * 5}s`,
              opacity: Math.random() * 0.5
            }}
          />
        ))}
      </div>
    </div>
  );
}
