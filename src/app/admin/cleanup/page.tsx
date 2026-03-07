
"use client";

import { useState } from 'react';
import { useUser, useFirestore, useAuth as useFirebaseAuth } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Navigation } from '@/components/Navigation';
import { Loader2, Trash2, AlertTriangle, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function CleanupPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useFirebaseAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handlePurgeAccount = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not Authenticated",
        description: "You must be logged in to the test account you wish to purge.",
      });
      return;
    }

    setIsDeleting(true);

    try {
      // 1. Delete Firestore User Documents
      // We delete the specific user profile and its known sub-collections
      const userRef = doc(db, 'users', user.uid);
      const personalityRef = doc(db, 'users', user.uid, 'personality', 'personality_data');
      
      // Deleting sub-collection data first
      await deleteDoc(personalityRef).catch(() => {});
      // Deleting main profile
      await deleteDoc(userRef).catch(() => {});

      // 2. Delete Auth User Record
      // This is the critical step that allows re-registration with the same email.
      await deleteUser(user);

      toast({
        title: "Test Account Purged",
        description: "Auth record and Firestore profile removed successfully. You can now re-register.",
      });

      // Redirect to signup after a short delay
      setTimeout(() => {
        window.location.href = '/auth/signup';
      }, 1500);

    } catch (error: any) {
      console.error("Cleanup Error:", error);
      
      if (error.code === 'auth/requires-recent-login') {
        toast({
          variant: "destructive",
          title: "Security Delay",
          description: "For security, please log out and log back in, then try purging again immediately.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Cleanup Failed",
          description: error.message || "An unexpected error occurred.",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isUserLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative">
      <Navigation />
      
      <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white/90 backdrop-blur-xl">
        <div className="bg-destructive/10 h-2" />
        <CardHeader className="space-y-4 text-center pt-8">
          <div className="mx-auto bg-destructive/10 w-20 h-20 rounded-3xl flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tighter">Developer Utility</CardTitle>
            <CardDescription className="font-medium">
              Purge current test account to reset authentication flow.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-6 rounded-3xl border border-border/50 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                This will permanently delete your **Auth record** and **Firestore profile**. 
                Global data like matches and messages will remain in the system for integrity.
              </p>
            </div>
            
            {user ? (
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Target Account</p>
                <p className="text-sm font-bold truncate">{user.email}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{user.uid}</p>
              </div>
            ) : (
              <p className="text-sm font-bold text-destructive text-center">No user logged in.</p>
            )}
          </div>

          <Button 
            variant="destructive"
            className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-destructive/20 border-none transition-all active:scale-95"
            onClick={handlePurgeAccount}
            disabled={isDeleting || !user}
          >
            {isDeleting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-6 h-6 mr-2" /> Purge Account
              </>
            )}
          </Button>
        </CardContent>

        <CardFooter className="pb-10 flex justify-center">
          <Link href="/profile" className="text-xs font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 uppercase tracking-widest">
            <ArrowLeft className="w-3 h-3" /> Back to Profile
          </Link>
        </CardFooter>
      </Card>

      <div className="fixed top-0 left-0 w-full h-full -z-10 opacity-5 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-destructive rounded-full blur-[100px]" />
      </div>
    </div>
  );
}
