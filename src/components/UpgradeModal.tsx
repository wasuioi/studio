
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Zap, ShieldCheck } from "lucide-react";
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
      title: "Success!",
      description: `You are now a ${tier.toUpperCase()} member.`,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <Crown className="w-12 h-12 text-primary" />
          </div>
          <DialogTitle className="text-2xl font-black">Unlock {featureName}</DialogTitle>
          <DialogDescription>
            Choose a plan to continue your journey with HarmonyAI.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="border p-6 rounded-3xl space-y-4 hover:border-primary transition-colors bg-accent/30">
            <div className="flex justify-between items-center">
              <h4 className="font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> LITE
              </h4>
              <span className="font-black text-lg">$9.99</span>
            </div>
            <p className="text-xs text-muted-foreground">Detailed compatibility analysis & deep personality insights.</p>
            <Button className="w-full rounded-xl" onClick={() => handleUpgrade('lite')}>Upgrade to Lite</Button>
          </div>

          <div className="border-2 border-primary p-6 rounded-3xl space-y-4 relative bg-primary/5">
            <div className="absolute -top-3 right-6 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">Best Value</div>
            <div className="flex justify-between items-center">
              <h4 className="font-bold flex items-center gap-2 text-primary">
                <Crown className="w-4 h-4" /> PREMIUM
              </h4>
              <span className="font-black text-lg">$19.99</span>
            </div>
            <p className="text-xs text-muted-foreground">Full messaging, unblurred profiles, and all Lite features.</p>
            <Button className="w-full rounded-xl shadow-lg shadow-primary/20" onClick={() => handleUpgrade('premium')}>Upgrade to Premium</Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="w-3 h-3" /> Secure checkout powered by HarmonyPay
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
