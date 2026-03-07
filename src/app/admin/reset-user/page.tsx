
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
import { Loader2, Trash2, AlertTriangle, ShieldAlert, ArrowLeft, RefreshCw, Search, UserMinus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function ResetUserPage() {
  const { user: currentUser, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useFirebaseAuth();
  const { toast } = useToast();
  
  const [targetEmail, setTargetEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setIsDev(true);
    }
  }, []);

  const handleResetByEmail = async () => {
    if (!targetEmail.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please enter an email address." });
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Find user in Firestore by email
      const usersQuery = query(collection(db, 'users'), where('email', '==', targetEmail.toLowerCase()));
      const userSnap = await getDocs(usersQuery);

      if (userSnap.empty) {
        toast({
          variant: "destructive",
          title: "User Not Found",
          description: `No Firestore record found for ${targetEmail}. Note: This tool cannot search the Auth database directly.`,
        });
        setIsProcessing(false);
        return;
      }

      const targetUserDoc = userSnap.docs[0];
      const targetUid = targetUserDoc.id;
      const batch = writeBatch(db);

      // 2. Queue Firestore Deletions
      // User Profile
      batch.delete(doc(db, 'users', targetUid));
      
      // Personality Data
      batch.delete(doc(db, 'users', targetUid, 'personality', 'personality_data'));

      // Bot Chats
      const chatsQuery = query(collection(db, 'bot_chats'), where('userId', '==', targetUid));
      const chatsSnap = await getDocs(chatsQuery);
      chatsSnap.forEach((doc) => batch.delete(doc.ref));

      // User Posts
      const postsQuery = query(collection(db, 'users', targetUid, 'posts'));
      const postsSnap = await getDocs(postsQuery);
      postsSnap.forEach((doc) => batch.delete(doc.ref));

      await batch.commit();

      // 3. Handle Auth Deletion (Client Side limitation)
      let authMessage = "";
      if (currentUser && currentUser.email?.toLowerCase() === targetEmail.toLowerCase()) {
        await deleteUser(currentUser);
        authMessage = "Auth record also deleted.";
      } else {
        authMessage = "IMPORTANT: You must manually delete this user from the Firebase Authentication Console to allow them to re-register.";
      }

      toast({
        title: "Data Reset Complete",
        description: `Firestore data for ${targetEmail} has been wiped. ${authMessage}`,
      });

      setTargetEmail('');
      if (currentUser?.email?.toLowerCase() === targetEmail.toLowerCase()) {
        setTimeout(() => window.location.href = '/auth/signup', 2000);
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
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
            <UserMinus className="w-10 h-10 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-black tracking-tighter uppercase">Admin Reset Tool</CardTitle>
            <CardDescription className="font-medium">
              Wipe Firestore data for specific test accounts.
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-6 rounded-3xl border border-border/50 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold text-muted-foreground leading-relaxed uppercase tracking-wider">
                This wipes Firestore data (Profile, Chats, Personality). 
                To allow re-registration, you must ALSO delete the user in the Firebase Auth Console.
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target-email" className="text-[10px] font-black uppercase tracking-widest ml-1">Email Address to Reset</Label>
                <div className="relative">
                  <Input 
                    id="target-email"
                    placeholder="e.g. uiuinag@gmail.com"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className="rounded-2xl h-14 bg-white border-none shadow-inner pl-12"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              variant="destructive"
              className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-destructive/20 border-none transition-all active:scale-95"
              onClick={handleResetByEmail}
              disabled={isProcessing || !targetEmail.trim()}
            >
              {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Reset Firestore Data"}
            </Button>
            
            {currentUser && (
              <p className="text-[9px] text-center text-muted-foreground font-bold uppercase tracking-widest px-4">
                Note: Deleting your OWN account ({currentUser.email}) will also remove your Auth record.
              </p>
            )}
          </div>
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
