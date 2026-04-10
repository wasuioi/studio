"use client";

import { useState } from 'react';
import { supabase } from '@/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase().includes('invalid')
          ? "Invalid email or password."
          : error.message || "An unexpected error occurred.";
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: msg,
        });
        return;
      }

      const user = data.user;
      if (!user?.email_confirmed_at) {
        toast({
          title: "Account Unverified",
          description: "Please check your inbox to verify your email address.",
        });
        router.push('/auth/verify');
      } else {
        toast({
          title: "Welcome Back!",
          description: "Re-syncing your frequency now.",
        });
        router.push('/bot');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[80vw] h-[80vh] bg-[radial-gradient(circle_at_center,rgba(144,102,204,0.3),transparent_65%)] opacity-60" />
      </div>

      <Card className="w-full max-w-md rounded-[3rem] border border-white/10 shadow-2xl bg-white/95 backdrop-blur-2xl z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        <div className="truevibe-gradient h-1.5 w-full opacity-50" />
        <CardHeader className="space-y-4 text-center pt-10 px-8">
          <Logo size="md" className="mx-auto mb-2" />
          <div>
            <CardTitle className="text-4xl font-black tracking-tighter text-slate-900">Welcome Back</CardTitle>
            <CardDescription className="text-slate-500 font-bold text-sm">Enter your credentials to find your vibe.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-4">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 ml-1">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-2xl h-14 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-300 font-medium focus-visible:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" title="password" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 ml-1">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-2xl h-14 bg-slate-50 border-slate-200 text-slate-900 font-medium focus-visible:ring-primary/40"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-primary/20 truevibe-gradient border-none mt-4 transition-all active:scale-95 text-white"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-6 pb-10 px-8">
          <p className="text-sm font-bold text-slate-500">
            New to TrueVibe?{" "}
            <Link href="/auth/signup" className="text-primary font-black hover:underline underline-offset-4">
              Join now
            </Link>
          </p>
          <div className="flex items-center gap-2 text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Verified Secure Connection
          </div>
          <Link href="/" className="text-[10px] font-black text-slate-400 hover:text-primary transition-colors flex items-center gap-2 uppercase tracking-[0.2em]">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
