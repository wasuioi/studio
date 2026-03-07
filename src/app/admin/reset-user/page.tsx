"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useAuth as useFirebaseAuth } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { deleteUser, signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navigation } from '@/components/Navigation';
import { Loader2, Trash2, AlertTriangle, ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function ResetUserPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useFirebaseAuth();
  const { toast } = useToast();
  const [emailInput, setEmailInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    // Check if we are in development mode
    if (process.env.NODE_ENV === 'development') {
      setIsDev(true);
    }
  }, []);

  const handleResetUser = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not Authenticated",
        description: "Please log in with the test account you wish to reset.",
      });
      return;
    }

    if (emailInput.toLowerCase() !== user.email?.toLowerCase()) {
      toast({
        variant: "destructive",
        title: "Email Mismatch",
        description: `For security, you can only reset the account you are currently logged in as (${user.email}).`,
      });
      return;
    }

    setIsDeleting(true);

    try {
      // 1. Delete Firestore User Documents
      // As per requirements, we target 'users', 'profiles', and 'user_data' collections
      const userRef = doc(db, 'users', user.uid);
      const personalityRef = doc(db, 'users', user.uid, 'personality', 'personality_data');
      
      // Additional requested collections for total cleanup
      const profileRef = doc(db, 'profiles', user.uid);
      const userDataRef = doc(db, 'user_data', user.uid);

      // Perform deletions (catching errors if collections don't exist yet)
      await Promise.all([
        deleteDoc(personalityRef).catch(() => {}),
        deleteDoc(userRef).catch(() => {}),
        deleteDoc(profileRef).catch(() => {}),
        deleteDoc(userDataRef).catch(() => {}),
      ]);

      // 2. Delete Auth User Record
      // This is the critical step that removes the user from Firebase Auth system,
      // allowing them to register again with the same email address.
      await deleteUser(user);

      toast({
        title: "Account Purged Successfully",
        description: "Auth record and Firestore profiles removed. Redirecting to signup...",
      });

      // Redirect to signup after a short delay to allow background sync
      setTimeout(() => {
        window.location.href = '/auth/signup';
      }, 1500);

    } catch (error: any) {
      console.error("Reset Error:", error);
      
      if (error.code === 'auth/requires-recent-login') {
        toast({
          variant: "destructive",
          title: "Security Verification Required",
          description: "Sensitive operations require a recent login. Please log out and log back in, then retry.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Reset Failed",
          description: error.message || "An unexpected error occurred during account deletion.",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Restrict access in production environments for safety
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="h-screen flex items-center justify-center p-6 text-center">
        <Card className="max-w-md rounded-[3rem] border-none shadow-2xl p-10 bg-white">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-6" />
          <h1 className="text-2xl font-black mb-4 tracking-tighter">Development Utility Only</h1>
          <p className="text-muted-foreground font-medium">
            The Admin Reset Tool is a testing utility and is only available in development environments.
          </p>
          <Link href="/" className="mt-8 block">
            <Button className="rounded-2xl h-12 px-8 font-bold">Return Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isUserLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
      <Navigation />
      
      <Card className="w-full max-w-md rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/90 backdrop-blur-xl">
        <div className="bg-destructive/10 h-2" />
        <CardHeader className="space-y-4 text-center pt-8">
          <div className="mx-auto bg-destructive/10 w-20 h-20 rounded-[1.5rem] flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tighter">Admin Reset Tool</CardTitle>
            <CardDescription className="font-medium">
              Delete a test user account and all profile data to restart the signup flow.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-6 rounded-3xl border border-border/50 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                This will delete the <strong>Authentication record</strong> and <strong>Firestore documents</strong> in: users, profiles, and user_data. 
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-confirm" className="text-[10px] font-black uppercase tracking-widest ml-1">Account Email to Purge</Label>
                <Input 
                  id="email-confirm"
                  placeholder={user?.email || "email@example.com"}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="rounded-2xl h-12 bg-white border-none shadow-inner"
                />
              </div>

              {user ? (
                <div className="bg-white/50 p-3 rounded-2xl border border-border/30">
                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Status: Authenticated</p>
                  <p className="text-sm font-bold truncate">{user.email}</p>
                </div>
              ) : (
                <div className="p-3 rounded-2xl border border-destructive/20 bg-destructive/5 text-center">
                  <p className="text-xs font-bold text-destructive">No user authenticated. Reset requires login.</p>
                </div>
              )}
            </div>
          </div>

          <Button 
            variant="destructive"
            className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-destructive/20 border-none transition-all active:scale-95"
            onClick={handleResetUser}
            disabled={isDeleting || !user || emailInput.toLowerCase() !== user.email?.toLowerCase()}
          >
            {isDeleting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-6 h-6 mr-2" /> Reset Test Account
              </>
            )}
          </Button>
        </CardContent>

        <CardFooter className="pb-10 flex flex-col gap-4 items-center">
          <Link href="/profile" className="text-xs font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 uppercase tracking-widest">
            <ArrowLeft className="w-3 h-3" /> Back to Profile
          </Link>
          <p className="text-[10px] text-muted-foreground font-medium text-center px-6">
            System-wide data like existing matches and messages are preserved to maintain database integrity.
          </p>
        </CardFooter>
      </Card>

      <div className="fixed top-0 left-0 w-full h-full -z-10 opacity-5 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-destructive rounded-full blur-[100px]" />
      </div>
    </div>
  );
}