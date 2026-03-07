"use client";

import { useState } from 'react';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useFirebaseAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Force status update from server
      await user.reload();
      
      if (!user.emailVerified) {
        toast({
          title: "Verification Required",
          description: "Please verify your email to unlock your TrueVibe account.",
        });
        router.push('/auth/verify');
      } else {
        router.push('/bot');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid email or password.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary rounded-full blur-[100px]" />
      </div>

      <Card className="w-full max-w-md rounded-[3rem] border-none shadow-2xl bg-white/90 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center pt-10">
          <div className="mx-auto truevibe-gradient w-20 h-20 rounded-[1.5rem] flex items-center justify-center shadow-xl">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div>
            <CardTitle className="text-4xl font-black tracking-tighter">Welcome Back</CardTitle>
            <CardDescription className="font-medium">Enter your credentials to find your vibe.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-bold text-xs uppercase tracking-widest ml-1">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="rounded-2xl h-14 bg-muted/30 border-none shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" title="password" className="font-bold text-xs uppercase tracking-widest ml-1">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="rounded-2xl h-14 bg-muted/30 border-none shadow-inner"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-primary/20 truevibe-gradient border-none mt-4 transition-all active:scale-95"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-6 pb-10">
          <p className="text-sm font-medium text-muted-foreground">
            New to TrueVibe?{" "}
            <Link href="/auth/signup" className="text-primary font-black hover:underline underline-offset-4">
              Join now
            </Link>
          </p>
          <Link href="/" className="text-xs font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 uppercase tracking-widest">
            Back to Home <ArrowRight className="w-3 h-3" />
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}