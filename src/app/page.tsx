
"use client";

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
    <div className="min-h-screen relative flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      {/* Background radial glow behind the main content area */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0">
        <div className="w-[120vw] h-[120vh] bg-[radial-gradient(circle_at_center,rgba(255,120,180,0.15),transparent_70%)] opacity-50" />
      </div>
      
      <main className="relative z-10 max-w-sm w-full space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        {/* Logo Section */}
        <div className="flex justify-center relative">
          <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full scale-150" />
          <Logo size="md" showText={false} className="relative transform transition-transform hover:scale-110 duration-500" />
        </div>
        
        {/* Text Section */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-white leading-[1.05] drop-shadow-sm">
            Find Your<br />True Vibe
          </h1>
          <p className="text-sm md:text-base text-white/70 font-medium px-6 max-w-[300px] mx-auto leading-relaxed">
            Intentional dating for<br />real connections.
          </p>
        </div>

        {/* Buttons Section */}
        <div className="space-y-4 pt-4">
          <Button 
            size="lg" 
            className="w-full h-14 md:h-16 rounded-full bg-white text-[#6C3BFF] hover:bg-white/95 text-lg font-black shadow-2xl transition-all duration-300 active:scale-95 border-none"
            onClick={handleStart}
          >
            <Rocket className="mr-2 w-5 h-5 fill-current" />
            Start with AI
          </Button>
          
          <Link href="/auth/signup" className="block w-full">
            <Button 
              size="lg" 
              className="w-full h-14 md:h-16 rounded-full bg-gradient-to-r from-[#6A3CFF] to-[#B14BFF] text-white hover:opacity-90 text-lg font-black shadow-xl transition-all duration-300 active:scale-95 border-none"
            >
              Sign Up
            </Button>
          </Link>
        </div>

        {/* Trust Footer */}
        <div className="pt-8 flex flex-col items-center gap-2">
          <div className="inline-flex items-center gap-2 text-white/40 text-[10px] font-bold uppercase tracking-[0.25em]">
            <ShieldCheck className="w-4 h-4 text-[#FF6B6B]" />
            Verified profiles only.<br className="md:hidden" /> No fake accounts.
          </div>
        </div>
      </main>
    </div>
  );
}
