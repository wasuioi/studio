"use client";

import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Zap, MessageCircle, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuth } from 'firebase/auth';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  featureName: string;
  targetMatchName?: string;
  targetMatchId?: string;
  onPaymentSuccess: (type: 'insight' | 'connection', paymentIntentId: string) => void;
}

// Inner payment form — rendered inside <Elements>
function CheckoutForm({
  type,
  targetMatchName,
  onSuccess,
  onBack,
}: {
  type: 'insight' | 'connection';
  targetMatchName?: string;
  onSuccess: (paymentIntentId: string) => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isPaying, setIsPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsPaying(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });

      if (error) {
        toast({ variant: 'destructive', title: 'Payment Failed', description: error.message });
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        setPaid(true);
        setTimeout(() => onSuccess(paymentIntent.id), 800);
      }
    } finally {
      setIsPaying(false);
    }
  };

  const price = type === 'insight' ? '$2.99' : '$29.99';
  const label = type === 'insight' ? 'Unlock Insight' : 'Send Date Invite';

  if (paid) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <CheckCircle2 className="w-16 h-16 text-green-400" />
        <p className="text-white font-black text-xl">Payment Confirmed!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
        <div className="flex justify-between items-center mb-1">
          <span className="text-white/60 text-sm font-bold">
            {type === 'insight' ? 'Vibe Insight' : 'Date Invite'} for {targetMatchName || 'this match'}
          </span>
          <span className="text-white font-black">{price}</span>
        </div>
        {type === 'connection' && (
          <p className="text-white/40 text-xs">Auto-refunded if invite is declined</p>
        )}
      </div>

      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      <div className="flex gap-3">
        <Button
          type="button"
          variant="ghost"
          className="text-white/40 hover:text-white"
          onClick={onBack}
          disabled={isPaying}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isPaying}
          className="flex-1 truevibe-pill-button h-12 font-black text-base"
        >
          {isPaying ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
          ) : (
            `Pay ${price} — ${label}`
          )}
        </Button>
      </div>
    </form>
  );
}

export function UpgradeModal({
  isOpen,
  onClose,
  userId,
  featureName,
  targetMatchName,
  targetMatchId,
  onPaymentSuccess,
}: UpgradeModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'choose' | 'pay'>('choose');
  const [selectedType, setSelectedType] = useState<'insight' | 'connection' | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectType = useCallback(async (type: 'insight' | 'connection') => {
    if (!userId || !targetMatchId) return;
    setIsLoading(true);
    setSelectedType(type);
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) throw new Error('Not signed in');
      const idToken = await currentUser.getIdToken();

      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ type, targetMatchId, targetMatchName, receiverId: targetMatchId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClientSecret(data.clientSecret);
      setStep('pay');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      setSelectedType(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, targetMatchId, targetMatchName, toast]);

  const handlePaymentSuccess = useCallback((intentId: string) => {
    if (!selectedType) return;
    onPaymentSuccess(selectedType, intentId);
    handleClose();
  }, [selectedType, onPaymentSuccess]);

  const handleClose = () => {
    setStep('choose');
    setSelectedType(null);
    setClientSecret(null);
    onClose();
  };

  const handleBack = () => {
    setStep('choose');
    setClientSecret(null);
    setSelectedType(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-lg border-none shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide p-8 bg-[#0F0819]/95 backdrop-blur-3xl">
        <DialogHeader className="items-center text-center space-y-3">
          <DialogTitle className="text-3xl font-black tracking-tight text-white">
            {step === 'choose' ? 'Unlock the Frequency' : 'Complete Payment'}
          </DialogTitle>
          <DialogDescription className="font-bold text-sm text-white/50">
            {step === 'choose'
              ? `Connect deeper with ${targetMatchName || 'this soul'}.`
              : 'Secured by Stripe — your card details are never stored by us.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {step === 'choose' ? (
            <div className="grid gap-4">
              {/* Insight — $2.99 */}
              <div className="border-2 border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-primary/50 transition-all bg-white/5">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-black flex items-center gap-2 text-white text-lg">
                      <Zap className="w-5 h-5 text-primary fill-current" /> VIBE INSIGHT
                    </h4>
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">One-time</p>
                  </div>
                  <span className="font-black text-2xl text-white">$2.99</span>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  Read the full AI match report — why your frequencies align and how to nurture this connection.
                </p>
                <Button
                  className="w-full rounded-2xl h-12 font-black bg-white/10 hover:bg-white/20 text-white border border-white/10"
                  onClick={() => handleSelectType('insight')}
                  disabled={isLoading}
                >
                  {isLoading && selectedType === 'insight' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Unlock Insight
                </Button>
              </div>

              {/* Connection — $29.99 */}
              <div className="border-2 border-primary p-6 rounded-[2rem] space-y-4 relative bg-primary/10 shadow-2xl shadow-primary/20">
                <div className="absolute -top-4 right-8 truevibe-gradient text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg border border-white/20">
                  Most Popular
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-black flex items-center gap-2 text-primary text-lg">
                      <MessageCircle className="w-5 h-5 fill-current" /> DATE INVITE
                    </h4>
                    <p className="text-xs text-primary/60 font-bold uppercase tracking-widest">Per Invite</p>
                  </div>
                  <span className="font-black text-2xl text-white">$29.99</span>
                </div>
                <p className="text-sm text-white/70 leading-relaxed">
                  Send a date invite. If they don't accept, you get a <strong className="text-primary">full refund</strong> — no questions asked.
                </p>
                <Button
                  className="w-full rounded-2xl h-12 font-black truevibe-gradient border-none shadow-xl shadow-primary/40 text-white"
                  onClick={() => handleSelectType('connection')}
                  disabled={isLoading}
                >
                  {isLoading && selectedType === 'connection' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Send Invite Now
                </Button>
              </div>
            </div>
          ) : clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#9066CC',
                    colorBackground: '#1a0f2e',
                    colorText: '#ffffff',
                    borderRadius: '12px',
                  },
                },
              }}
            >
              <CheckoutForm
                type={selectedType!}
                targetMatchName={targetMatchName}
                onSuccess={handlePaymentSuccess}
                onBack={handleBack}
              />
            </Elements>
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
        </div>

        {step === 'choose' && (
          <DialogFooter className="sm:justify-center border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-[10px] text-white/30 font-black uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-primary" /> Payments secured by Stripe
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
