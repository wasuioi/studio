"use client";

import { useState } from 'react';
import { supabase } from '@/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter both first name and last name.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const displayName = `${firstName.trim()} ${lastName.trim()}`;

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify`,
          data: {
            display_name: displayName,
          },
        },
      });

      if (signUpError) {
        const msg = signUpError.message.toLowerCase().includes('already')
          ? "This email is already registered."
          : signUpError.message || "Could not create account.";
        setError(msg);
        toast({ variant: "destructive", title: "Signup Error", description: msg });
        return;
      }

      toast({
        title: "Account Created!",
        description: "Please check your email to verify your account.",
      });

      router.push('/auth/verify');
    } catch (err: any) {
      const msg = err.message || "Could not create account.";
      setError(msg);
      toast({ variant: "destructive", title: "Signup Error", description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0">
        <div className="w-[120vw] h-[120vh] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15),transparent_70%)] opacity-50" />
      </div>

      <Card className="w-full max-w-md rounded-[3rem] border border-white/10 shadow-2xl bg-white/95 backdrop-blur-2xl z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-700">
        <CardHeader className="space-y-4 text-center pt-10 px-8">
          <Logo size="md" className="mx-auto mb-2" />
          <div>
            <CardTitle className="text-4xl font-black tracking-tighter text-slate-900">Join TrueVibe</CardTitle>
            <CardDescription className="text-slate-500 font-bold text-sm">Create an account to start syncing frequencies.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8">
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-[10px] font-black p-4 rounded-2xl border border-destructive/20 uppercase tracking-wider animate-pulse">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 ml-1">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="First"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="rounded-2xl h-14 bg-slate-50 border-slate-200 text-slate-900 font-medium focus-visible:ring-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 ml-1">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="rounded-2xl h-14 bg-slate-50 border-slate-200 text-slate-900 font-medium focus-visible:ring-primary/40"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 ml-1">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@vibe.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-2xl h-14 bg-slate-50 border-slate-200 text-slate-900 font-medium focus-visible:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 ml-1">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-2xl h-14 bg-slate-50 border-slate-200 text-slate-900 font-medium focus-visible:ring-primary/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 ml-1">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="rounded-2xl h-14 bg-slate-50 border-slate-200 text-slate-900 font-medium focus-visible:ring-primary/40"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-primary/20 truevibe-gradient border-none mt-4 transition-all active:scale-95 text-white"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Sync Your Soul"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pb-10 px-8">
          <p className="text-sm font-bold text-slate-500">
            Already a member?{" "}
            <Link href="/auth/login" className="text-primary font-black hover:underline underline-offset-4">
              Sign In
            </Link>
          </p>
          <div className="flex items-center gap-3 text-[9px] text-slate-400 bg-slate-50 px-6 py-3 rounded-2xl font-black uppercase tracking-[0.2em] border border-slate-100">
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
