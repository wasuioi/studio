"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Zap, ShieldCheck, Star } from "lucide-react";
import { doc } from "firebase/firestore";
import { useFirestore, updateDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  featureName: string;
}

export function UpgradeModal({ isOpen, onClose, userId, featureName }: UpgradeModalProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const handleUpgrade = (tier: 'lite' | 'premium') => {
    const userRef = doc(db, 'users', userId);
    updateDocumentNonBlocking(userRef, { tier });
    toast({
      title: "Vibe Level Up!",
      description: `You are now a ${tier.toUpperCase()} member.`,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader className="items-center text-center space-y-4">
          <div className="truevibe-gradient p-4 rounded-2xl shadow-lg inline-block">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              Elevate Your Vibe
            </DialogTitle>
            <DialogDescription className="font-medium text-sm md:text-base px-2">
              Unlock {featureName} and experience TrueVibe without limits.
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="border border-border/50 p-5 rounded-[2rem] space-y-3 hover:border-primary transition-all duration-300 bg-muted/20 group">
            <div className="flex justify-between items-center">
              <h4 className="font-black flex items-center gap-2 group-hover:text-primary transition-colors text-sm md:text-base">
                <Zap className="w-4 h-4 text-primary fill-current" /> LITE
              </h4>
              <span className="font-black text-lg">$9.99</span>
            </div>
            <p className="text-[11px] md:text-xs text-muted-foreground font-medium leading-relaxed">
              Deep personality analysis & vibe-check explanations.
            </p>
            <Button className="w-full rounded-xl h-12 font-bold bg-secondary hover:bg-secondary/90 text-sm" onClick={() => handleUpgrade('lite')}>
              Upgrade to Lite
            </Button>
          </div>

          <div className="border-2 border-primary p-6 rounded-[2rem] space-y-3 relative bg-primary/5 shadow-xl shadow-primary/10">
            <div className="absolute -top-3 right-6 truevibe-gradient text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
              Best Value
            </div>
            <div className="flex justify-between items-center">
              <h4 className="font-black flex items-center gap-2 text-primary text-sm md:text-base">
                <Star className="w-4 h-4 fill-current" /> PREMIUM
              </h4>
              <span className="font-black text-lg">$19.99</span>
            </div>
            <p className="text-[11px] md:text-xs text-muted-foreground font-bold leading-relaxed">
              Unlimited messaging, unblurred profiles, and priority discovery.
            </p>
            <Button className="w-full rounded-xl h-12 font-black text-base truevibe-gradient border-none shadow-lg shadow-primary/30" onClick={() => handleUpgrade('premium')}>
              Upgrade to Premium
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-center border-t pt-4">
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-black uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3" /> Secure checkout powered by TrueVibe Pay
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
