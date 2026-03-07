
"use client";

import { useState } from 'react';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { BrainCircuit, Loader2, ArrowRight } from 'lucide-react';
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
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/bot');
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center">
            <BrainCircuit className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black">Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to continue your journey.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
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
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-primary font-bold hover:underline">
              Create one
            </Link>
          </p>
          <Link href="/" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            Back to home <ArrowRight className="w-3 h-3" />
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
