
"use client";

import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ShieldCheck, Heart, Zap, Star } from 'lucide-react';
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
    <div className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden">

      {/* Ambient background orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-10%] w-[50vw] h-[50vw] bg-pink-500/20 rounded-full blur-[100px] pointer-events-none" />

      <main className="relative z-10 w-full max-w-sm mx-auto px-6 flex flex-col items-center gap-10 py-16">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-[80px] rounded-full scale-[1.8]" />
            <Logo size="lg" showText={false} className="relative drop-shadow-2xl" />
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Find Your<br />
              <span className="truevibe-text-gradient">True Vibe</span>
            </h1>
            <p className="text-white/50 text-sm font-medium">
              Real connections. Real people. No fakes.
            </p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { icon: Zap, label: 'AI Matching' },
            { icon: ShieldCheck, label: 'Verified Only' },
            { icon: Heart, label: 'Real Vibes' },
            { icon: Star, label: 'Personality AI' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-bold"
            >
              <Icon className="w-3 h-3 text-primary" />
              {label}
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="w-full space-y-3">
          <Link href="/auth/signup" className="block w-full">
            <Button
              size="lg"
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#6A3CFF] to-[#FF4DA6] text-white text-base font-black shadow-2xl shadow-purple-900/40 hover:opacity-90 transition-all duration-300 active:scale-95 border-none"
            >
              Create Account
            </Button>
          </Link>

          <Button
            size="lg"
            variant="ghost"
            className="w-full h-14 rounded-2xl bg-white/8 border border-white/15 text-white text-base font-black backdrop-blur-sm hover:bg-white/15 transition-all duration-300 active:scale-95"
            onClick={handleStart}
          >
            Sign In
          </Button>
        </div>

        {/* Trust badge */}
        <div className="flex items-center gap-2 text-white/30 text-[10px] font-bold uppercase tracking-widest">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Verified profiles only · No fake accounts
        </div>

      </main>
    </div>
  );
}
