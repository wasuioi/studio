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
      <DialogContent className="rounded-[3rem] sm:max-w-md border-none shadow-2xl">
        <DialogHeader className="items-center text-center">
          <div className="truevibe-gradient p-5 rounded-3xl mb-4 shadow-lg">
            <Crown className="w-12 h-12 text-white" />
          </div>
          <DialogTitle className="text-3xl font-black tracking-tighter">Elevate Your Vibe</DialogTitle>
          <DialogDescription className="font-medium">
            Unlock {featureName} and experience TrueVibe without limits.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-5 py-4">
          <div className="border border-border/50 p-6 rounded-[2rem] space-y-4 hover:border-primary transition-all duration-300 bg-muted/20 group">
            <div className="flex justify-between items-center">
              <h4 className="font-black flex items-center gap-2 group-hover:text-primary transition-colors">
                <Zap className="w-4 h-4 text-primary fill-current" /> LITE
              </h4>
              <span className="font-black text-xl">$9.99</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">Deep personality analysis & vibe-check explanations.</p>
            <Button className="w-full rounded-2xl h-12 font-bold bg-secondary hover:bg-secondary/90" onClick={() => handleUpgrade('lite')}>Upgrade to Lite</Button>
          </div>

          <div className="border-2 border-primary p-7 rounded-[2rem] space-y-4 relative bg-primary/5 shadow-xl shadow-primary/10">
            <div className="absolute -top-3 right-8 truevibe-gradient text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">Best Value</div>
            <div className="flex justify-between items-center">
              <h4 className="font-black flex items-center gap-2 text-primary">
                <Star className="w-4 h-4 fill-current" /> PREMIUM
              </h4>
              <span className="font-black text-xl">$19.99</span>
            </div>
            <p className="text-xs text-muted-foreground font-bold">Unlimited messaging, unblurred profiles, and priority discovery.</p>
            <Button className="w-full rounded-2xl h-14 font-black text-lg truevibe-gradient border-none shadow-lg shadow-primary/30" onClick={() => handleUpgrade('premium')}>Upgrade to Premium</Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3" /> Secure checkout powered by TrueVibe Pay
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}