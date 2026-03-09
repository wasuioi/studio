
"use client";

import { useState } from 'react';
import { useFirestore, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, getDocs, doc, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Loader2, Trash2, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Navigation } from '@/components/Navigation';

export default function AdminCleanupPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [isCleaning, setIsCleaning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'cleaning' | 'complete'>('idle');
  const [count, setCount] = useState(0);

  const purgeBots = async () => {
    setIsCleaning(true);
    setStatus('cleaning');
    setCount(0);
    
    try {
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);
      
      let deletedCount = 0;
      
      const promises = snap.docs.map(async (uDoc) => {
        const data = uDoc.data();
        
        // Identify bots by common testing patterns
        const isBot = 
          data.isBot === true || 
          data.name?.toLowerCase().includes('test') || 
          data.displayName?.toLowerCase().includes('bot') ||
          data.email?.includes('example.com') ||
          data.email?.includes('test.com') ||
          data.photoURL?.includes('seed/vibe_user'); 

        if (isBot) {
          // 1. Delete user profile
          deleteDocumentNonBlocking(doc(db, 'users', uDoc.id));
          
          // 2. Cleanup their outgoing requests
          const requestsRef = collection(db, 'chat_requests');
          const qSender = query(requestsRef, where('senderId', '==', uDoc.id));
          const qReceiver = query(requestsRef, where('receiverId', '==', uDoc.id));
          
          const [snapSender, snapReceiver] = await Promise.all([
            getDocs(qSender),
            getDocs(snapReceiver) // Note: using snapReceiver from scoped query
          ]).catch(() => [null, null]);

          snapSender?.forEach(d => deleteDocumentNonBlocking(doc(db, 'chat_requests', d.id)));
          
          // Re-query correctly for receiver
          const snapReceiverReal = await getDocs(qReceiver).catch(() => null);
          snapReceiverReal?.forEach(d => deleteDocumentNonBlocking(doc(db, 'chat_requests', d.id)));

          // 3. Cleanup conversations
          const convRef = collection(db, 'conversations');
          const qConv = query(convRef, where('participantIds', 'array-contains', uDoc.id));
          const snapConv = await getDocs(qConv).catch(() => null);
          snapConv?.forEach(d => deleteDocumentNonBlocking(doc(db, 'conversations', d.id)));

          deletedCount++;
        }
      });

      await Promise.all(promises);
      setCount(deletedCount);
      setStatus('complete');
      
      toast({
        title: "Cleanup Success",
        description: `Permanently removed ${deletedCount} simulated accounts.`,
      });
    } catch (e) {
      console.error(e);
      setStatus('idle');
      toast({ 
        variant: 'destructive', 
        title: "Purge Failed", 
        description: "An error occurred during database cleanup." 
      });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 pt-32 min-h-screen">
      <Navigation />
      
      <Card className="glass-card rounded-[3rem] border-destructive/20 bg-destructive/5 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="truevibe-gradient h-2 w-full opacity-50" />
        <CardHeader className="text-center pb-4 pt-10">
          <div className="bg-destructive/10 p-5 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-destructive/10">
            <ShieldAlert className="text-destructive w-10 h-10" />
          </div>
          <CardTitle className="text-3xl font-black text-white tracking-tighter">Database Purge</CardTitle>
          <CardDescription className="text-[10px] font-black text-destructive uppercase tracking-[0.3em] mt-2">
            Danger Zone: Administrative Tool
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-8 pt-4 px-10 pb-12">
          {status === 'complete' ? (
            <div className="text-center space-y-4 py-6 animate-in fade-in slide-in-from-bottom-4">
              <CheckCircle className="w-16 h-16 text-verified mx-auto" />
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">Purge Complete</h3>
                <p className="text-white/60 font-medium">Removed {count} simulated profiles from your universe.</p>
              </div>
              <Button 
                variant="ghost" 
                className="text-white/40 hover:text-white"
                onClick={() => setStatus('idle')}
              >
                Run Again
              </Button>
            </div>
          ) : (
            <>
              <div className="bg-black/20 p-6 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-amber-500 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Read Carefully</span>
                </div>
                <p className="text-sm text-white/70 font-medium leading-relaxed">
                  This tool scans your Firestore <code className="text-primary font-bold">users</code> collection and deletes profiles matching bot patterns:
                </p>
                <ul className="text-xs text-white/50 space-y-2 list-disc pl-5 font-medium">
                  <li>Names containing "Bot" or "Test"</li>
                  <li>Email domains like "example.com" or "test.com"</li>
                  <li>Simulated "vibe_user" image seeds</li>
                  <li>Associated Chat Requests & Conversations</li>
                </ul>
              </div>

              <Button 
                variant="destructive" 
                className="w-full h-16 rounded-[1.5rem] font-black text-xl gap-3 shadow-2xl shadow-destructive/20 active:scale-95 transition-all"
                onClick={purgeBots}
                disabled={isCleaning}
              >
                {isCleaning ? (
                  <>
                    <Loader2 className="animate-spin w-6 h-6" />
                    <span>Purging Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-6 h-6" />
                    <span>Execute Purge</span>
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
