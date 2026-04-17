"use client";

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/supabase/client';
import { useSupabaseAuth } from '@/supabase/provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, RefreshCw, ShieldCheck, Mail, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';

function VerifyLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyLoader />}>
      <VerifyPageContent />
    </Suspense>
  );
}

function VerifyPageContent() {
  const { user, isUserLoading } = useSupabaseAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verifying, setVerifying] = useState(false);

  // Handle click-through from Supabase verification email (token_hash in URL)
  useEffect(() => {
    const tokenHash = searchParams?.get('token_hash');
    const type = searchParams?.get('type');
    if (!tokenHash || !type) return;

    setVerifying(true);
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: type as 'email' | 'signup' | 'invite' | 'recovery' | 'email_change' })
      .then(({ error }) => {
        setVerifying(false);
        if (error) {
          toast({
            variant: "destructive",
            title: "Verification Failed",
            description: error.message,
          });
          return;
        }
        toast({
          title: "Account Activated!",
          description: "Welcome to the TrueVibe community.",
        });
        router.push('/bot');
      });
  }, [searchParams, router, toast]);

  useEffect(() => {
    if (!isUserLoading && !user && !verifying) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router, verifying]);

  useEffect(() => {
    if (user?.email_confirmed_at) {
      router.push('/bot');
    }
  }, [user, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (!user?.email || countdown > 0) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/bot`,
        },
      });
      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to resend email.",
        });
        return;
      }
      toast({
        title: "Verification Sent",
        description: "Check your inbox (and spam) for a new verification link.",
      });
      setCountdown(60);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to resend email.",
      });
    } finally {
      setResending(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (data.user?.email_confirmed_at) {
        toast({
          title: "Account Activated!",
          description: "Welcome to the TrueVibe community.",
        });
        router.push('/bot');
      } else {
        toast({
          description: "Still waiting! Please click the link in your email.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  if (isUserLoading || verifying) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px] opacity-40" />
      </div>

      <Card className="w-full max-w-sm rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white/95 backdrop-blur-2xl z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="truevibe-gradient h-1.5 w-full" />
        <CardHeader className="space-y-3 text-center pt-8 px-6">
          <Logo size="sm" className="mx-auto mb-2" />
          <div className="bg-primary/5 p-3 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-1 animate-bounce">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-black tracking-tight text-slate-900">Activate Account</CardTitle>
            <CardDescription className="text-sm font-bold text-slate-500 leading-tight">
              Link sent to:<br/>
              <span className="font-black text-primary break-all text-xs">{user?.email}</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-6 pb-6">
          <div className="bg-amber-100/80 p-4 rounded-2xl border border-amber-200 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-black text-amber-900 uppercase tracking-tight">
                Can&apos;t find the mail?
              </p>
              <p className="text-[11px] font-bold text-amber-800 leading-tight">
                Check your <span className="underline decoration-2">Spam or Junk folder</span>. Sometimes vibes get filtered!
              </p>
            </div>
          </div>

          <Button
            className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 truevibe-gradient border-none transition-all active:scale-95 text-white"
            onClick={handleCheckStatus}
          >
            I&apos;ve Verified
          </Button>

          <Button
            variant="ghost"
            className="w-full h-10 rounded-xl gap-2 font-black text-slate-400 hover:text-primary transition-all uppercase tracking-widest text-[9px]"
            onClick={handleResend}
            disabled={resending || countdown > 0}
          >
            {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {countdown > 0 ? `Resend in ${countdown}s` : "Resend Link"}
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pb-8 border-t border-slate-100 pt-5 bg-slate-50/50">
          <div className="flex items-center gap-2 text-[8px] text-slate-400 font-black uppercase tracking-[0.2em]">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Vibe Protection Active
          </div>
          <Button variant="ghost" onClick={handleSignOut} className="text-slate-400 h-8 gap-2 font-black hover:text-slate-900 hover:bg-transparent uppercase tracking-widest text-[9px]">
            <ArrowLeft className="w-3.5 h-3.5" /> Sign out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
