"use client";

import { useEffect, useState } from 'react';
import { useAuth as useFirebaseAuth, useUser } from '@/firebase';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Mail, Loader2, ArrowLeft, RefreshCw, ShieldCheck, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  }, [user]);

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
      setCountdown(60); // Rate limit resend for 60 seconds
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
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
          title: "Email Verified!",
          description: "Welcome to the TrueVibe community.",
        });
        router.push('/bot');
      } else {
        toast({
          description: "Email is not verified yet. Please check your inbox.",
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
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[100px]" />
      </div>

      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
        <div className="truevibe-gradient h-2" />
        <CardHeader className="space-y-4 text-center pt-8">
          <div className="mx-auto bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center">
            <Mail className="w-10 h-10 text-primary animate-bounce" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tight">Verify Your Email</CardTitle>
            <CardDescription className="text-base">
              We sent a verification link to<br/>
              <span className="font-black text-foreground">{user?.email}</span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/30 p-6 rounded-3xl border border-border/50">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              Please click the link in that email to activate your account. You must verify your email before using TrueVibe.
            </p>
          </div>
          
          <Button 
            className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-primary/20 truevibe-gradient border-none"
            onClick={handleCheckStatus}
          >
            I've Verified My Email
          </Button>

          <Button 
            variant="ghost"
            className="w-full h-12 rounded-xl gap-2 font-bold text-muted-foreground hover:text-primary"
            onClick={handleResend}
            disabled={resending || countdown > 0}
          >
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {countdown > 0 ? `Resend in ${countdown}s` : "Resend Verification Email"}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-6 pb-10 border-t pt-6 bg-muted/5">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Secure Authentication
          </div>
          <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground gap-2 font-bold hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Sign out & Back to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}