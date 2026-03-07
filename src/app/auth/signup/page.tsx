
"use client";

import { useState } from 'react';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { BrainCircuit, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useFirebaseAuth();
  const router = useRouter();
  const { toast } = useToast();

  const validatePassword = (pass: string) => {
    return pass.length >= 8 && /[a-zA-Z]/.test(pass) && /[0-9]/.test(pass);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Passwords match error", description: "Passwords do not match." });
      return;
    }

    if (!validatePassword(password)) {
      toast({ 
        variant: "destructive", 
        title: "Weak Password", 
        description: "Password must be at least 8 characters and contain both letters and numbers." 
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      
      toast({
        title: "Account Created",
        description: "Please check your email for a verification link.",
      });
      
      router.push('/auth/verify');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message || "Could not create account.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center">
            <BrainCircuit className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black">Join HarmonyAI</CardTitle>
            <CardDescription>Start your journey towards meaningful connection.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="rounded-xl h-12"
              />
              <p className="text-[10px] text-muted-foreground px-1">Min. 8 chars, must include letters and numbers.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
                className="rounded-xl h-12"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Create Account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary font-bold hover:underline">
              Log in
            </Link>
          </p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-accent/50 px-4 py-2 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Your data is encrypted and secure with HarmonyAI.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
