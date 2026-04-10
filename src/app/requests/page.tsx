"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useSupabaseAuth } from '@/supabase/provider';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { useCollection } from '@/supabase/hooks/use-collection';
import { rowToChatRequest } from '@/supabase/adapters';
import { CalendarHeart, Loader2, Inbox, Heart, MapPin, Clock, CheckCircle2, Hourglass, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ChatRequest } from '@/types';
import Link from 'next/link';
import { DatePlannerModal } from '@/components/DatePlannerModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function RequestsPage() {
  const { user: authUser, isUserLoading } = useSupabaseAuth();
  const { user, profile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [planningRequest, setPlanningRequest] = useState<ChatRequest | null>(null);
  const [showVerifyGate, setShowVerifyGate] = useState(false);

  const emailVerified = Boolean(authUser?.email_confirmed_at);

  useEffect(() => {
    if (!isUserLoading && !authUser) {
      router.push('/auth/login');
    }
  }, [isUserLoading, authUser, router]);

  const { data: incomingRows, isLoading } = useCollection<'chat_requests'>({
    table: 'chat_requests',
    query: (q) => (emailVerified && authUser ? q.eq('receiver_id', authUser.id).eq('status', 'pending') : q),
    realtime: authUser ? { column: 'receiver_id', value: authUser.id } : undefined,
    deps: [authUser?.id, emailVerified],
  });

  const { data: acceptedRows, isLoading: isLoadingAccepted } = useCollection<'chat_requests'>({
    table: 'chat_requests',
    query: (q) => (emailVerified && authUser ? q.eq('receiver_id', authUser.id).eq('status', 'accepted') : q),
    realtime: authUser ? { column: 'receiver_id', value: authUser.id } : undefined,
    deps: [authUser?.id, emailVerified],
  });

  const incomingRequests: ChatRequest[] = (incomingRows ?? []).map(rowToChatRequest);
  const acceptedDates: ChatRequest[] = (acceptedRows ?? []).map(rowToChatRequest);

  const isVerified = profile?.identity_verified || profile?.verification_status === 'verified';

  const handleAcceptRequest = (request: ChatRequest) => {
    if (!user) return;
    if (!isVerified) { setShowVerifyGate(true); return; }
    setPlanningRequest(request);
  };

  const handleDeclineRequest = async (request: ChatRequest) => {
    const { error } = await supabase
      .from('chat_requests')
      .update({ status: 'rejected' })
      .eq('id', request.id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    toast({ description: "Date invite declined." });
  };

  if (isUserLoading || (authUser && !emailVerified)) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  const contentLoading = isLoading || isLoadingAccepted;
  const plannedDates = acceptedDates.filter(d => d.dateStatus === 'planned');
  const waitingSenderDates = acceptedDates.filter(d => d.dateStatus === 'waiting_sender');

  return (
    <div className="max-w-4xl mx-auto p-4 mb-24 min-h-screen pt-20">
      <Navigation />

      <header className="mb-10 space-y-1 px-2">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-3 text-white">
          Date Invites <CalendarHeart className="text-primary w-6 h-6 md:w-10 md:h-10" />
        </h1>
        <p className="text-white/60 font-medium max-w-lg text-sm md:text-base">
          Someone wants to take you on a date. Do you accept?
        </p>
      </header>

      {contentLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!contentLoading && plannedDates.length > 0 && (
        <div className="px-2 mb-8">
          <h2 className="text-white font-black text-lg mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" /> Your Upcoming Dates
          </h2>
          <div className="space-y-4">
            {plannedDates.map(date => (
              <Card key={date.id} className="glass-card rounded-[1.5rem] p-5 border border-green-500/20 bg-green-500/5">
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12 rounded-xl border border-white/10 shrink-0">
                    <AvatarImage src={date.senderPhotoURL} className="object-cover" />
                    <AvatarFallback className="font-black bg-primary/20 text-primary">{date.senderName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-sm mb-2">Date with {date.senderName}</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-white/70 text-xs">
                        <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{date.suggestedDateTime}</span>
                      </div>
                      <div className="flex items-start gap-2 text-white/70 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{date.suggestedLocation}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-none text-[10px] font-black shrink-0">Confirmed</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!contentLoading && waitingSenderDates.length > 0 && (
        <div className="px-2 mb-8">
          <h2 className="text-white font-black text-lg mb-3 flex items-center gap-2">
            <Hourglass className="w-5 h-5 text-primary animate-pulse" /> Waiting for them...
          </h2>
          <div className="space-y-4">
            {waitingSenderDates.map(date => (
              <Card key={date.id} className="glass-card rounded-[1.5rem] p-5 border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12 rounded-xl border border-white/10 shrink-0">
                    <AvatarImage src={date.senderPhotoURL} className="object-cover" />
                    <AvatarFallback className="font-black bg-primary/20 text-primary">{date.senderName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-white font-black text-sm">Waiting for {date.senderName}</p>
                    <p className="text-white/50 text-xs mt-0.5">Vera is waiting for their preferences to suggest the perfect date 💕</p>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-none text-[10px] font-black shrink-0">Pending</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!contentLoading && <div className="space-y-6 px-2">
        {incomingRequests.length > 0 ? (
          incomingRequests.map((req) => (
            <Card key={req.id} className="glass-card rounded-[2rem] overflow-hidden animate-in slide-in-from-bottom-4">
              <div className="flex flex-col md:flex-row p-6 md:p-8 gap-6 items-center">
                <Avatar className="w-20 h-20 rounded-2xl shadow-xl border-2 border-white/10 flex-shrink-0">
                  <AvatarImage src={req.senderPhotoURL} className="object-cover" />
                  <AvatarFallback className="text-xl font-black bg-primary/20 text-primary">
                    {req.senderName[0]}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 text-center md:text-left space-y-2">
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <h4 className="text-xl font-black text-white">{req.senderName}</h4>
                    <Badge className="bg-primary/20 text-primary border-none px-3 py-1 text-xs font-black rounded-full">
                      {req.matchScore}% Harmony
                    </Badge>
                  </div>
                  <p className="text-sm text-white/70 font-medium leading-relaxed italic line-clamp-2">
                    &quot;{req.reason}&quot;
                  </p>
                  <p className="text-xs text-primary/80 font-bold uppercase tracking-wider">
                    🌹 Wants to go on a date with you
                  </p>
                </div>

                <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 rounded-full text-white/40 hover:text-destructive font-black uppercase text-[10px] tracking-widest"
                    onClick={() => handleDeclineRequest(req)}
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    className="truevibe-pill-button flex-1"
                    onClick={() => handleAcceptRequest(req)}
                  >
                    Accept Date
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : plannedDates.length === 0 && waitingSenderDates.length === 0 ? (
          <div className="flex justify-center items-center py-20 relative">
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <div className="w-64 h-64 bg-primary blur-[80px] rounded-full" />
            </div>

            <Card className="glass-card p-10 text-center rounded-[2.5rem] w-full max-w-[500px] relative z-10">
              <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Inbox className="w-8 h-8 text-white/20" />
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white mb-2">No Date Invites Yet</h3>
              <p className="text-white/40 font-medium mb-8 text-sm md:text-base px-4">
                The universe is still syncing. Try exploring new profiles!
              </p>
              <Link href="/matches">
                <Button className="truevibe-pill-button h-10 px-8">
                  Explore Matches <Heart className="ml-2 w-4 h-4 fill-current" />
                </Button>
              </Link>
            </Card>
          </div>
        ) : null}
      </div>}

      <Dialog open={showVerifyGate} onOpenChange={setShowVerifyGate}>
        <DialogContent className="glass-card rounded-[2.5rem] border-white/10 max-w-md p-8 bg-[#0F0819]/90">
          <DialogHeader className="items-center text-center space-y-4">
            <div className="bg-primary/20 p-4 rounded-full">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight text-white">Verify First</DialogTitle>
              <DialogDescription className="text-white/60 mt-2 leading-relaxed">
                {profile?.verification_status === 'pending'
                  ? "Your identity verification is under review. You'll be able to accept date invites once approved."
                  : "TrueVibe requires identity verification before accepting date invites. It only takes a minute!"}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 mt-2">
            {profile?.verification_status !== 'pending' && (
              <Link href="/verification" className="w-full">
                <Button className="truevibe-pill-button w-full" onClick={() => setShowVerifyGate(false)}>
                  <ShieldCheck className="w-4 h-4 mr-2" /> Verify My Identity
                </Button>
              </Link>
            )}
            <Button variant="ghost" className="w-full rounded-full text-white/40 font-bold" onClick={() => setShowVerifyGate(false)}>
              Maybe Later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {planningRequest && profile && (
        <DatePlannerModal
          isOpen={!!planningRequest}
          onClose={() => setPlanningRequest(null)}
          request={planningRequest}
          receiverName={profile.display_name ?? ''}
          receiverLocation={profile.location ?? undefined}
        />
      )}
    </div>
  );
}
