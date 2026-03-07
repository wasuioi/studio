
"use client";

import { useEffect, useState } from 'react';
import { useAuth as useFirebaseAuth, useUser } from '@/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Mail, Loader2, ArrowLeft, RefreshCw, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function VerifyPage() {
  const { user, isUserLoading } = useUser();
  const auth = useFirebaseAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
    if (user?.emailVerified) {
      router.push('/bot');
    }
  }, [user, isUserLoading, router]);

  const handleResend = async () => {
    if (!user) return;
    setSending(true);
    try {
      await sendEmailVerification(user);
      toast({
        title: "Verification Sent",
        description: "A new link has been sent to your email.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/auth/login');
  };

  const checkStatus = () => {
    window.location.reload();
  };

  if (isUserLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black">Check Your Email</CardTitle>
            <CardDescription>We've sent a verification link to <b>{user?.email}</b>.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-accent/50 p-4 rounded-2xl space-y-3">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              Next Steps
            </h4>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li>1. Click the link in your email.</li>
              <li>2. Return here and click "I've Verified".</li>
              <li>3. Start matching with HarmonyAI!</li>
            </ul>
          </div>
          
          <Button 
            className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg"
            onClick={checkStatus}
          >
            I've Verified
          </Button>

          <Button 
            variant="outline"
            className="w-full h-12 rounded-xl gap-2"
            onClick={handleResend}
            disabled={sending}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Resend Verification Link
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-6">
          <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground gap-2">
            <ArrowLeft className="w-4 h-4" /> Sign out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
