
"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useAuth as useFirebaseAuth } from '@/firebase';
import { deleteDoc, doc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Navigation } from '@/components/Navigation';
import { Loader2, Trash2, AlertTriangle, ShieldAlert, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
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
    if (process.env.NODE_ENV === 'development') {
      setIsDev(true);
    }
  }, []);

  const handleTotalWipe = async () => {
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
        description: `Please enter ${user.email} to confirm the wipe.`,
      });
      return;
    }

    setIsDeleting(true);

    try {
      const batch = writeBatch(db);

      // 1. Target User Document
      const userRef = doc(db, 'users', user.uid);
      batch.delete(userRef);

      // 2. Target Personality Data
      const personalityRef = doc(db, 'users', user.uid, 'personality', 'personality_data');
      batch.delete(personalityRef);

      // 3. Clear all Bot Chats for this user
      const chatsQuery = query(collection(db, 'bot_chats'), where('userId', '==', user.uid));
      const chatsSnap = await getDocs(chatsQuery);
      chatsSnap.forEach((doc) => batch.delete(doc.ref));

      // 4. Clear all Posts for this user
      const postsQuery = query(collection(db, 'users', user.uid, 'posts'));
      const postsSnap = await getDocs(postsQuery);
      postsSnap.forEach((doc) => batch.delete(doc.ref));

      // Commit all Firestore deletions
      await batch.commit();

      // 5. Delete Auth User Record (Allows re-registration)
      await deleteUser(user);

      toast({
        title: "Data Purged Successfully",
        description: "Everything wiped. You can now register again with this email.",
      });

      setTimeout(() => {
        window.location.href = '/auth/signup';
      }, 1500);

    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast({
          variant: "destructive",
          title: "Re-authentication Required",
          description: "For security, please log out and back in to verify it's you.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Reset Failed",
          description: error.message,
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="h-screen flex items-center justify-center p-6 text-center">
        <Card className="max-w-md rounded-[3rem] border-none shadow-2xl p-10 bg-white">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto mb-6" />
          <h1 className="text-2xl font-black mb-4">Development Tool</h1>
          <p className="text-muted-foreground font-medium">This utility is disabled in production.</p>
          <Link href="/" className="mt-8 block"><Button className="rounded-2xl h-12 px-8 font-bold">Return Home</Button></Link>
        </Card>
      </div>
    );
  }

  if (isUserLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
      <Navigation />
      
      <Card className="w-full max-w-md rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/90 backdrop-blur-xl">
        <div className="truevibe-gradient h-2" />
        <CardHeader className="space-y-4 text-center pt-8">
          <div className="mx-auto bg-primary/10 w-20 h-20 rounded-[1.5rem] flex items-center justify-center">
            <RefreshCw className="w-10 h-10 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tighter">Account Total Wipe</CardTitle>
            <CardDescription className="font-medium">
              Delete all personality data, chats, and auth records to start the process from zero.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-6 rounded-3xl border border-border/50 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                This will delete your <strong>Profile</strong>, <strong>AI Chat History</strong>, and <strong>Login Credentials</strong>. 
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-confirm" className="text-[10px] font-black uppercase tracking-widest ml-1">Confirm Email to Purge</Label>
                <Input 
                  id="email-confirm"
                  placeholder={user?.email || "email@example.com"}
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="rounded-2xl h-12 bg-white border-none shadow-inner"
                />
              </div>
            </div>
          </div>

          <Button 
            variant="destructive"
            className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-destructive/20 border-none transition-all active:scale-95"
            onClick={handleTotalWipe}
            disabled={isDeleting || !user || emailInput.toLowerCase() !== user.email?.toLowerCase()}
          >
            {isDeleting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Purge All Data & Reset"}
          </Button>
        </CardContent>

        <CardFooter className="pb-10 flex flex-col gap-4 items-center">
          <Link href="/profile" className="text-xs font-black text-muted-foreground hover:text-primary transition-colors flex items-center gap-2 uppercase tracking-widest">
            <ArrowLeft className="w-3 h-3" /> Back to Profile
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
