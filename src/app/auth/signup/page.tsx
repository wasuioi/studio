"use client";

import { useState } from 'react';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { 
  createUserWithEmailAndPassword, 
  sendEmailVerification 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const auth = useFirebaseAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return regex.test(pass);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters and include both letters and numbers.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await sendEmailVerification(user);

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        id: user.uid,
        uid: user.uid,
        email: user.email,
        displayName: 'TrueVibe User',
        name: 'TrueVibe User',
        photoURL: `https://picsum.photos/seed/${user.uid}/400/400`,
        emailVerified: false,
        identityVerified: false,
        profileCompleted: false,
        verificationStatus: 'not_verified',
        tier: 'free',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      toast({
        title: "Welcome to TrueVibe!",
        description: "A verification email has been sent to your inbox.",
      });
      
      router.push('/auth/verify');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered.");
      } else {
        setError(err.message || "Could not create account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Page-Specific Radial Glow behind the card */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[80vw] h-[80vh] bg-[radial-gradient(circle_at_center,rgba(255,120,180,0.3),transparent_65%)] opacity-60" />
      </div>

      <Card className="w-full max-w-md rounded-[3rem] border border-white/10 shadow-2xl bg-white/10 backdrop-blur-2xl z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        <div className="truevibe-gradient h-1 w-full opacity-50" />
        <CardHeader className="space-y-4 text-center pt-10">
          <Logo size="md" className="mx-auto mb-2" />
          <div>
            <CardTitle className="text-4xl font-black tracking-tighter text-white">Join TrueVibe</CardTitle>
            <CardDescription className="text-white/60 font-bold text-sm">Discover connections that match your energy.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8">
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="bg-destructive/20 text-white text-xs font-black p-4 rounded-2xl border border-destructive/20 animate-in fade-in slide-in-from-top-1 uppercase tracking-tight">
                {error}
                {error === "This email is already registered." && (
                  <div className="mt-2 text-[10px] flex items-center gap-1 opacity-70">
                    Already a member? 
                    <Link href="/auth/login" className="text-primary hover:underline underline-offset-2 flex items-center gap-1 font-black">
                      Login now <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="font-black text-[10px] uppercase tracking-[0.2em] text-white/50 ml-1">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="you@vibe.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="rounded-2xl h-14 bg-white/5 border-white/10 text-white placeholder:text-white/20 font-medium focus-visible:ring-primary/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" title="password" className="font-black text-[10px] uppercase tracking-[0.2em] text-white/50 ml-1">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-medium focus-visible:ring-primary/40"
              />
              <p className="text-[9px] text-white/30 font-black px-1 uppercase tracking-[0.1em]">Min. 8 chars, letters & numbers.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" title="confirm password" className="font-black text-[10px] uppercase tracking-[0.2em] text-white/50 ml-1">Confirm Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
                className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-medium focus-visible:ring-primary/40"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-primary/20 truevibe-gradient border-none mt-4 transition-all active:scale-95 text-white"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Create Account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pb-10">
          <p className="text-sm font-bold text-white/40">
            Already a member?{" "}
            <Link href="/auth/login" className="text-primary font-black hover:underline underline-offset-4">
              Log in
            </Link>
          </p>
          <div className="flex items-center gap-3 text-[9px] text-white/20 bg-white/5 px-6 py-3 rounded-2xl font-black uppercase tracking-[0.2em] border border-white/5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Verified Secure Connection
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
