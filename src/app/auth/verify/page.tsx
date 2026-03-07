
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useAuth as useFirebaseAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Mail, Loader2, ArrowLeft, RefreshCw, CheckCircle, ShieldCheck } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

function VerifyContent() {
  const { user, isUserLoading } = useUser();
  const auth = useFirebaseAuth();
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const urlCode = searchParams.get('code');

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  // Handle automatic verification if code is in URL
  useEffect(() => {
    if (urlCode && user && !verifying) {
      handleVerify(urlCode);
    }
  }, [urlCode, user]);

  const handleVerify = async (verificationCode: string) => {
    if (!user) return;
    setVerifying(true);
    try {
      const verificationRef = doc(db, 'users', user.uid, 'private', 'verification');
      const snap = await getDoc(verificationRef);
      
      if (snap.exists() && snap.data().code === verificationCode) {
        // Update Firestore profile status
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          emailVerified: true,
          updatedAt: new Date().toISOString()
        });
        
        toast({
          title: "Email Verified!",
          description: "Welcome to the TrueVibe community.",
        });
        
        router.push('/bot');
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Code",
          description: "The verification code is incorrect or has expired.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationRef = doc(db, 'users', user.uid, 'private', 'verification');
      await updateDoc(verificationRef, { code: newCode, createdAt: new Date().toISOString() });

      const emailResponse = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          code: newCode,
          displayName: user.displayName || 'TrueVibe User',
        }),
      });

      if (!emailResponse.ok) throw new Error('Failed to resend');

      toast({
        title: "Verification Sent",
        description: "A new professional link has been sent to your email.",
      });
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
        <div className="truevibe-gradient h-2" />
        <CardHeader className="space-y-4 text-center pt-8">
          <div className="mx-auto bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tight">Verify Your Email</CardTitle>
            <CardDescription>Enter the 6-digit code sent to <b>{user?.email}</b></CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Input 
              placeholder="000000" 
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-3xl font-black h-20 rounded-3xl tracking-[1rem] bg-muted/30 border-none shadow-inner"
              maxLength={6}
            />
          </div>
          
          <Button 
            className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-primary/20 truevibe-gradient border-none"
            onClick={() => handleVerify(code)}
            disabled={verifying || code.length < 6}
          >
            {verifying ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify Account"}
          </Button>

          <Button 
            variant="ghost"
            className="w-full h-12 rounded-xl gap-2 font-bold text-muted-foreground hover:text-primary"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Resend Professional Email
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-6 pb-10 border-t pt-6 bg-muted/10">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Enterprise-Grade Security
          </div>
          <Button variant="ghost" onClick={handleSignOut} className="text-muted-foreground gap-2 font-bold">
            <ArrowLeft className="w-4 h-4" /> Sign out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <VerifyContent />
    </Suspense>
  );
}
