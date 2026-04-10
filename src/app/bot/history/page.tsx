"use client";

import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { BrainCircuit, Calendar, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';

export default function BotHistoryPage() {
  const { user, loading } = useAuth();
  const db = useFirestore();

  const historyQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(db, 'bot_chats'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
  }, [db, user]);

  const { data: history, isLoading } = useCollection(historyQuery);

  if (loading || isLoading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto h-screen flex flex-col p-4 relative pt-20">
      <Navigation />
      
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="bg-primary/20 p-2 rounded-2xl">
          <BrainCircuit className="text-primary w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Bot Chat History</h1>
          <p className="text-sm text-white/50">All your past interactions with Vera AI</p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 pb-10 px-2">
          {history?.length === 0 ? (
            <div className="text-center py-20 glass-card rounded-[3rem]">
              <p className="text-white/40 font-bold">No chat history yet.</p>
            </div>
          ) : (
            history?.map((chat) => (
              <Card key={chat.id} className="p-6 rounded-[2rem] border-none shadow-sm bg-white/5 backdrop-blur-md overflow-hidden">
                <div className="flex items-center gap-2 mb-3 text-[10px] text-white/30 font-medium uppercase tracking-wider">
                  <Calendar className="w-3 h-3" />
                  {new Date(chat.timestamp).toLocaleString()}
                </div>
                <div className={cn(
                  "p-4 rounded-2xl text-sm leading-relaxed",
                  chat.role === 'user' 
                    ? "truevibe-gradient text-white border-none" 
                    : "bg-white/10 text-white border border-white/10"
                )}>
                  <span className="font-black text-[10px] block mb-1 uppercase opacity-50">
                    {chat.role === 'user' ? 'You' : 'Vera AI'}
                  </span>
                  {chat.message}
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
