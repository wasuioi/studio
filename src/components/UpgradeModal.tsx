"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Zap, ShieldCheck, Star, Sparkles, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  featureName: string;
  targetMatchName?: string;
  onPaymentSuccess: (type: 'insight' | 'connection') => void;
}

export function UpgradeModal({ isOpen, onClose, userId, featureName, targetMatchName, onPaymentSuccess }: UpgradeModalProps) {
  const { toast } = useToast();

  const handlePayment = (type: 'insight' | 'connection') => {
    // Simulate payment processing
    const message = type === 'insight' 
      ? `Payment successful! $2.99 applied for ${targetMatchName}'s vibe insight.` 
      : `Payment successful! $19.99 applied to connect with ${targetMatchName}.`;
      
    toast({
      title: "Cosmic Transaction Complete",
      description: message,
    });
    
    onPaymentSuccess(type);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-lg border-none shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide p-8 bg-[#0F0819]/95 backdrop-blur-3xl">
        <DialogHeader className="items-center text-center space-y-4">
          <div className="truevibe-gradient p-4 rounded-3xl shadow-xl inline-block animate-pulse">
            <Sparkles className="w-10 h-10 text-white fill-current" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-3xl font-black tracking-tight leading-tight text-white">
              Unlock the Frequency
            </DialogTitle>
            <DialogDescription className="font-bold text-base text-white/60">
              Deepen your bond with <span className="text-primary">{targetMatchName || 'this soul'}</span>.
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="grid gap-6 py-8">
          {/* Vibe Insight Option - $2.99 */}
          <div className="border-2 border-white/5 p-6 rounded-[2rem] space-y-4 hover:border-primary/50 transition-all duration-300 bg-white/5 group relative overflow-hidden">
            <div className="flex justify-between items-center relative z-10">
              <div className="space-y-1">
                <h4 className="font-black flex items-center gap-2 group-hover:text-primary transition-colors text-white text-lg">
                  <Zap className="w-5 h-5 text-primary fill-current" /> VIBE INSIGHT
                </h4>
                <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Per Insight</p>
              </div>
              <span className="font-black text-2xl text-white">$2.99</span>
            </div>
            <p className="text-sm text-white/50 font-medium leading-relaxed relative z-10">
              Reveal the detailed AI analysis. Understand exactly why your frequencies align and how to nurture the connection.
            </p>
            <Button 
              className="w-full rounded-2xl h-14 font-black text-base bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all active:scale-95" 
              onClick={() => handlePayment('insight')}
            >
              Unlock Insight
            </Button>
            {/* Decorative background glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10" />
          </div>

          {/* Connection Option - $19.99 */}
          <div className="border-2 border-primary p-6 rounded-[2rem] space-y-4 relative bg-primary/10 shadow-2xl shadow-primary/20 group">
            <div className="absolute -top-4 right-8 truevibe-gradient text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg border border-white/20">
              Most Popular
            </div>
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h4 className="font-black flex items-center gap-2 text-primary text-lg">
                  <MessageCircle className="w-5 h-5 fill-current" /> CONNECT
                </h4>
                <p className="text-xs text-primary/60 font-bold uppercase tracking-widest">Per Connection</p>
              </div>
              <span className="font-black text-2xl text-white">$19.99</span>
            </div>
            <p className="text-sm text-white/70 font-bold leading-relaxed">
              Initiate a direct connection request and unlock unlimited messaging with this specific profile. 
            </p>
            <Button 
              className="w-full rounded-2xl h-14 font-black text-lg truevibe-gradient border-none shadow-xl shadow-primary/40 text-white transition-all active:scale-95 hover:shadow-primary/60" 
              onClick={() => handlePayment('connection')}
            >
              Send Request Now
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-center border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 text-[10px] text-white/30 font-black uppercase tracking-widest text-center">
            <ShieldCheck className="w-4 h-4 text-primary" /> Secure Cosmic Encryption Verified
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
