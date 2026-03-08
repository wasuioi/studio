"use client";

import { useEffect, useState } from 'react';
import { useAuth as useFirebaseAuth, useUser } from '@/firebase';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Loader2, ArrowLeft, RefreshCw, ShieldCheck, Mail, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';

export default function VerifyPage() {
  const { user, isUserLoading } = useUser();
  const auth = useFirebaseAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (user?.emailVerified) {
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
    if (!user || countdown > 0) return;
    setResending(true);
    try {
      await sendEmailVerification(user);
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
      await user.reload();
      if (user.emailVerified) {
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
    await signOut(auth);
    router.push('/auth/login');
  };

  if (isUserLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Luminous Spots */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px] opacity-40" />
      </div>

      <Card className="w-full max-w-md rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/95 backdrop-blur-2xl z-10">
        <div className="truevibe-gradient h-1.5 w-full" />
        <CardHeader className="space-y-4 text-center pt-8">
          <Logo size="md" className="mx-auto mb-4" />
          <div className="bg-primary/5 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-2 animate-bounce">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tight text-slate-900">Activate Account</CardTitle>
            <CardDescription className="text-base font-bold text-slate-500">
              We sent a verification link to<br/>
              <span className="font-black text-primary break-all">{user?.email}</span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-amber-800 leading-tight uppercase tracking-tight">
              Can&apos;t find the email? Please check your <span className="underline">spam or junk folder</span> in your email app.
            </p>
          </div>

          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <p className="text-sm font-black text-slate-600 leading-relaxed text-center uppercase tracking-tight">
              Safety First: You must verify your email before using TrueVibe features.
            </p>
          </div>
          
          <Button 
            className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-primary/20 truevibe-gradient border-none transition-all active:scale-95 text-white"
            onClick={handleCheckStatus}
          >
            I&apos;ve Verified My Email
          </Button>

          <Button 
            variant="ghost"
            className="w-full h-12 rounded-xl gap-2 font-black text-slate-500 hover:text-primary transition-all uppercase tracking-widest text-[10px]"
            onClick={handleResend}
            disabled={resending || countdown > 0}
          >
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {countdown > 0 ? `Resend in ${countdown}s` : "Resend Verification Link"}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-6 pb-10 border-t border-slate-100 pt-6 bg-slate-50/50">
          <div className="flex items-center gap-2 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Anti-Spam Protection Active
          </div>
          <Button variant="ghost" onClick={handleSignOut} className="text-slate-500 gap-2 font-black hover:text-slate-900 uppercase tracking-widest text-[10px]">
            <ArrowLeft className="w-4 h-4" /> Sign out & Back to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
