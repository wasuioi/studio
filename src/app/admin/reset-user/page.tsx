
"use client";

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Loader2, RotateCcw, ShieldCheck, UserMinus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Navigation } from '@/components/Navigation';
import { useRouter } from 'next/navigation';

export default function ResetUserPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isResetting, setIsResetting] = useState(false);

  const handleFullReset = async () => {
    if (!user || !profile) return;
    setIsResetting(true);

    try {
      const userRef = doc(db, 'users', user.uid);
      const personalityRef = doc(db, 'users', user.uid, 'personality', 'personality_data');

      // 1. Wipe personality interview
      deleteDocumentNonBlocking(personalityRef);

      // 2. Wipe user profile matching state
      updateDocumentNonBlocking(userRef, {
        profileCompleted: false,
        personalityProfile: null,
        topMatches: null,
        updatedAt: new Date().toISOString()
      });

      // 3. Cleanup my requests (sent and received)
      const requestsRef = collection(db, 'chat_requests');
      const qSender = query(requestsRef, where('senderId', '==', user.uid));
      const qReceiver = query(requestsRef, where('receiverId', '==', user.uid));
      
      const [snap1, snap2] = await Promise.all([
        getDocs(qSender),
        getDocs(qReceiver)
      ]);

      snap1.forEach(d => deleteDocumentNonBlocking(doc(db, 'chat_requests', d.id)));
      snap2.forEach(d => deleteDocumentNonBlocking(doc(db, 'chat_requests', d.id)));

      // 4. Cleanup my conversations
      const convRef = collection(db, 'conversations');
      const qConv = query(convRef, where('participantIds', 'array-contains', user.uid));
      const snapConv = await getDocs(qConv);
      snapConv.forEach(d => deleteDocumentNonBlocking(doc(db, 'conversations', d.id)));

      toast({
        title: "Profile Reset",
        description: "Your frequency has been cleared. Restarting vibe check.",
      });

      router.push('/bot');
    } catch (e) {
      toast({ variant: 'destructive', title: "Reset Failed", description: "Internal error." });
    } finally {
      setIsResetting(false);
    }
  };

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-md mx-auto p-6 pt-32 min-h-screen">
      <Navigation />
      <Card className="glass-card rounded-[2.5rem] border-white/10 bg-white/5 overflow-hidden">
        <CardHeader className="text-center pb-4">
          <div className="bg-primary/10 p-5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <RotateCcw className="text-primary w-10 h-10" />
          </div>
          <CardTitle className="text-2xl font-black text-white">Personal Reset</CardTitle>
          <CardDescription className="text-white/40 font-bold text-xs">Wipe your vibe history and start over.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4 pb-10">
          <div className="bg-white/5 p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Safe Reset</span>
            </div>
            <p className="text-xs text-white/60 font-medium leading-relaxed">
              This will clear your interview data, previous matches, and active conversations. Your account remains active, but your profile state is reset to "New User".
            </p>
          </div>
          <Button 
            className="w-full h-14 rounded-2xl font-black text-lg gap-2 truevibe-pill-button"
            onClick={handleFullReset}
            disabled={isResetting}
          >
            {isResetting ? <Loader2 className="animate-spin w-5 h-5" /> : <UserMinus className="w-5 h-5" />}
            Reset My Profile
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
