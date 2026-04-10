
"use client";

import { Button } from '@/components/ui/button';
import { useUser } from '@/supabase/hooks/use-user';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  const { user } = useUser();
  const router = useRouter();

  const handleStart = () => {
    if (user) {
      if (!user.email_confirmed_at) {
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

      {/* LEFT floating cards */}
      <div className="hidden md:flex absolute left-6 top-0 bottom-0 flex-col justify-center gap-5 pointer-events-none">
        <div className="animate-float-slow w-36 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 flex flex-col gap-2">
          <div className="w-full h-20 rounded-xl bg-gradient-to-br from-purple-500/40 to-pink-500/40" />
          <div className="h-2 w-3/4 bg-white/20 rounded-full" />
          <div className="h-2 w-1/2 bg-white/10 rounded-full" />
          <div className="flex items-center gap-1 mt-1">
            <div className="w-4 h-4 rounded-full bg-pink-400/60" />
            <div className="h-1.5 w-10 bg-white/15 rounded-full" />
          </div>
        </div>
        <div className="animate-float-mid w-32 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 flex flex-col gap-2 ml-4">
          <div className="w-full h-16 rounded-xl bg-gradient-to-br from-indigo-500/40 to-purple-500/40" />
          <div className="h-2 w-2/3 bg-white/20 rounded-full" />
          <div className="h-2 w-1/3 bg-white/10 rounded-full" />
        </div>
        <div className="animate-float-slow-reverse w-28 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 flex flex-col gap-2">
          <div className="w-full h-14 rounded-xl bg-gradient-to-br from-pink-500/40 to-rose-500/30" />
          <div className="h-2 w-3/4 bg-white/20 rounded-full" />
          <div className="h-2 w-1/2 bg-white/10 rounded-full" />
        </div>
      </div>

      {/* RIGHT floating cards */}
      <div className="hidden md:flex absolute right-6 top-0 bottom-0 flex-col justify-center gap-5 pointer-events-none">
        <div className="animate-float-mid w-32 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 flex flex-col gap-2 mr-4">
          <div className="w-full h-16 rounded-xl bg-gradient-to-br from-fuchsia-500/40 to-pink-400/30" />
          <div className="h-2 w-3/4 bg-white/20 rounded-full" />
          <div className="h-2 w-1/2 bg-white/10 rounded-full" />
        </div>
        <div className="animate-float-slow w-36 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 flex flex-col gap-2">
          <div className="w-full h-20 rounded-xl bg-gradient-to-br from-violet-500/40 to-fuchsia-500/40" />
          <div className="h-2 w-2/3 bg-white/20 rounded-full" />
          <div className="h-2 w-1/3 bg-white/10 rounded-full" />
          <div className="flex items-center gap-1 mt-1">
            <div className="w-4 h-4 rounded-full bg-purple-400/60" />
            <div className="h-1.5 w-10 bg-white/15 rounded-full" />
          </div>
        </div>
        <div className="animate-float-slow-reverse w-28 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 flex flex-col gap-2">
          <div className="w-full h-14 rounded-xl bg-gradient-to-br from-rose-400/30 to-pink-500/40" />
          <div className="h-2 w-3/4 bg-white/20 rounded-full" />
          <div className="h-2 w-1/2 bg-white/10 rounded-full" />
        </div>
      </div>

      <main className="relative z-10 w-full max-w-sm mx-auto px-6 flex flex-col items-center gap-2 py-4">

        {/* Logo */}
        <div className="flex flex-col items-center gap-1">
          <div className="relative animate-float-logo">
            <Logo size="lg" showText={false} className="relative" />
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight drop-shadow-lg">
              Find Your <span className="truevibe-text-gradient">True Vibe</span>
            </h1>
            <p className="text-white/50 text-sm font-medium">
              haha
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="w-full space-y-3">
          <Button
            size="lg"
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#6A3CFF] to-[#FF4DA6] text-white text-base font-black shadow-2xl shadow-purple-900/40 hover:opacity-90 transition-all duration-300 active:scale-95 border-none"
            onClick={handleStart}
          >
            Welcome Back
          </Button>

          <Link href="/auth/signup" className="block w-full">
            <Button
              size="lg"
              variant="ghost"
              className="w-full h-14 rounded-2xl bg-white/8 border border-white/15 text-white text-base font-black backdrop-blur-sm hover:bg-white/15 transition-all duration-300 active:scale-95"
            >
              Sign Up
            </Button>
          </Link>
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
