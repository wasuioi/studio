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
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    updateDocumentNonBlocking(userRef, { tier });
    
    const message = tier === 'lite' 
      ? "Credit applied! You can now view this vibe analysis." 
      : "Premium Unlocked! You can now send unlimited requests and messages.";
      
    toast({
      title: "Vibe Sync Successful",
      description: message,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2rem] md:rounded-[2.5rem] sm:max-w-md border-none shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide p-6 md:p-8 bg-[#0F0819]/95 backdrop-blur-2xl">
        <DialogHeader className="items-center text-center space-y-3 md:space-y-4">
          <div className="truevibe-gradient p-3 md:p-4 rounded-2xl shadow-lg inline-block">
            <Crown className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight leading-tight text-white">
              Enhance Your Connection
            </DialogTitle>
            <DialogDescription className="font-medium text-xs md:text-base px-2 text-white/60">
              Access {featureName} to deepen your cosmic bond.
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="grid gap-4 py-6">
          {/* Lite / Per Credit Option */}
          <div className="border border-white/10 p-5 rounded-[2rem] space-y-3 hover:border-primary transition-all duration-300 bg-white/5 group">
            <div className="flex justify-between items-center">
              <h4 className="font-black flex items-center gap-2 group-hover:text-primary transition-colors text-white text-sm md:text-base">
                <Zap className="w-4 h-4 text-primary fill-current" /> VIBE CREDIT
              </h4>
              <span className="font-black text-lg text-white">$2.99</span>
            </div>
            <p className="text-[10px] md:text-xs text-white/50 font-medium leading-relaxed">
              Unlock a single detailed vibe analysis report. Understand exactly why your frequencies align.
            </p>
            <Button 
              className="w-full rounded-xl h-12 font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10" 
              onClick={() => handleUpgrade('lite')}
            >
              Get Insight Credit
            </Button>
          </div>

          {/* Premium Option */}
          <div className="border-2 border-primary p-6 rounded-[2rem] space-y-3 relative bg-primary/10 shadow-xl shadow-primary/10">
            <div className="absolute -top-3 right-6 truevibe-gradient text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
              Full Access
            </div>
            <div className="flex justify-between items-center">
              <h4 className="font-black flex items-center gap-2 text-primary text-sm md:text-base">
                <Star className="w-4 h-4 fill-current" /> PREMIUM
              </h4>
              <span className="font-black text-lg text-white">$19.99</span>
            </div>
            <p className="text-[10px] md:text-xs text-white/70 font-bold leading-relaxed">
              Unlimited Chat Requests, Direct Messaging, and fully unblurred profile reveals.
            </p>
            <Button 
              className="w-full rounded-xl h-12 font-black text-sm md:text-base truevibe-gradient border-none shadow-lg shadow-primary/30 text-white" 
              onClick={() => handleUpgrade('premium')}
            >
              Unlock Premium Viber
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-center border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-[9px] text-white/30 font-black uppercase tracking-widest text-center">
            <ShieldCheck className="w-3 h-3 text-primary" /> Secure Cosmic Encryption
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
