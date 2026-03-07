"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, Camera, CheckCircle, ShieldCheck, FileText, X, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { verifyIdentity } from '@/ai/flows/verify-identity-flow';
import { cn } from '@/lib/utils';

export default function VerificationPage() {
  const { profile, loading } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idCardUrl, setIdCardUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isCameraActive) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Error',
            description: 'Please enable camera permissions.',
          });
        }
      };
      getCameraPermission();
    }
  }, [isCameraActive, toast]);

  const handleCaptureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      setSelfieUrl(canvas.toDataURL('image/jpeg'));
      setIsCameraActive(false);
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setIdCardUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!profile || !idCardUrl || !selfieUrl) return;
    setIsSubmitting(true);
    setStep(3);
    
    try {
      const result = await verifyIdentity({
        idCardPhotoUri: idCardUrl,
        selfiePhotoUri: selfieUrl,
      });

      setAiResult(result);

      const requestId = crypto.randomUUID();
      const requestRef = doc(db, 'users', profile.uid, 'verification_requests', requestId);
      const userRef = doc(db, 'users', profile.uid);

      const status = result.isMatch ? 'verified' : 'rejected';
      
      setDocumentNonBlocking(requestRef, {
        id: requestId,
        userId: profile.uid,
        status,
        aiScore: result.confidenceScore,
        aiReason: result.reason,
        submittedAt: new Date().toISOString(),
      }, { merge: true });

      updateDocumentNonBlocking(userRef, {
        verificationStatus: status,
        identityVerified: result.isMatch,
        updatedAt: new Date().toISOString(),
      });

      setStep(4);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Verification failed.' });
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetVerification = () => {
    setIdCardUrl(null);
    setSelfieUrl(null);
    setAiResult(null);
    setStep(2);
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (profile?.identityVerified && step !== 4) {
    return (
      <div className="max-w-md mx-auto p-4 text-center">
        <Navigation />
        <div className="bg-verified/10 p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] mx-4 mt-8">
          <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-verified mx-auto mb-4" />
          <h1 className="text-xl md:text-2xl font-bold mb-2">Verified!</h1>
          <p className="text-muted-foreground text-sm md:text-base">You are verified. Matching unlocked.</p>
          <Button variant="ghost" className="mt-6 rounded-xl font-bold" onClick={() => router.push('/profile')}>Back to Profile</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 mb-24 min-h-screen">
      <Navigation />
      
      <header className="mb-6 md:mb-8 px-2 mt-8">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">Vibe Check Verification</h1>
        <p className="text-muted-foreground font-medium text-sm md:text-base">Keep TrueVibe safe and genuine for everyone.</p>
      </header>

      {profile?.verificationStatus === 'rejected' && step === 1 && (
        <Card className="rounded-2xl md:rounded-[2.5rem] border-none shadow-xl bg-destructive/5 mb-6 overflow-hidden animate-in fade-in slide-in-from-top-4 mx-2">
          <div className="p-5 md:p-6 flex items-start gap-4">
            <div className="bg-destructive/10 p-2 rounded-xl text-destructive flex-shrink-0"><AlertCircle className="w-5 h-5" /></div>
            <div>
              <h4 className="font-black text-destructive uppercase tracking-wider text-[10px] md:text-xs mb-1">Attempt Rejected</h4>
              <p className="text-xs md:text-sm text-muted-foreground font-medium leading-relaxed">Our AI couldn't match your ID with your selfie. Please try again with better lighting and a clear ID photo.</p>
            </div>
          </div>
          <Button variant="destructive" className="w-full rounded-none h-12 font-black uppercase text-[10px] md:text-xs tracking-widest" onClick={handleResetVerification}>Retry Verification Now</Button>
        </Card>
      )}

      {step === 1 && (
        <Card className="rounded-[2rem] md:rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white mx-2">
          <CardHeader className="bg-primary/5 pb-6 md:pb-8">
            <ShieldCheck className="w-10 h-10 md:w-12 md:h-12 text-primary mb-4" />
            <CardTitle className="text-xl md:text-2xl font-black">Identity Verification</CardTitle>
            <CardDescription className="font-medium text-muted-foreground text-sm">We use AI to compare your official ID with a live selfie.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 md:pt-8 space-y-4 md:space-y-6">
            <div className="flex gap-4 items-start">
              <div className="bg-accent p-2 rounded-xl shadow-inner flex-shrink-0"><FileText className="text-primary w-5 h-5" /></div>
              <div>
                <h4 className="font-black text-xs md:text-sm uppercase tracking-tight">Valid ID Document</h4>
                <p className="text-[10px] md:text-xs text-muted-foreground font-medium leading-relaxed">Passport, National ID, or Driver's License.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-accent p-2 rounded-xl shadow-inner flex-shrink-0"><Camera className="text-primary w-5 h-5" /></div>
              <div>
                <h4 className="font-black text-xs md:text-sm uppercase tracking-tight">Live Selfie</h4>
                <p className="text-[10px] md:text-xs text-muted-foreground font-medium leading-relaxed">A quick photo taken now to confirm it's you.</p>
              </div>
            </div>
            <Button className="w-full h-14 md:h-16 rounded-xl md:rounded-[1.5rem] font-black text-base md:text-lg truevibe-gradient border-none shadow-xl" onClick={() => setStep(2)}>
              Start Verification
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 px-2">
          <Card className="rounded-2xl md:rounded-3xl p-4 md:p-6 border-none shadow-lg bg-white">
            <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest mb-4">Step 1: Upload ID Card</h3>
            {idCardUrl ? (
              <div className="relative aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-inner">
                <Image src={idCardUrl} alt="ID" fill className="object-cover" />
                <Button size="icon" variant="destructive" className="absolute top-2 right-2 rounded-full h-8 w-8" onClick={() => setIdCardUrl(null)}><X className="w-4 h-4" /></Button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-primary/20 rounded-xl md:rounded-2xl p-8 md:p-10 text-center cursor-pointer block hover:bg-primary/5 transition-all group">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                <Upload className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-3 text-primary/40 group-hover:text-primary transition-colors" />
                <p className="font-black text-xs md:text-sm uppercase tracking-tight">Click to Upload ID</p>
                <p className="text-[9px] md:text-[10px] text-muted-foreground font-bold mt-1">MAX 5MB, JPG/PNG</p>
              </label>
            )}
          </Card>

          <Card className="rounded-2xl md:rounded-3xl p-4 md:p-6 border-none shadow-lg bg-white">
            <h3 className="font-black text-[10px] md:text-xs uppercase tracking-widest mb-4">Step 2: Live Selfie</h3>
            {selfieUrl ? (
              <div className="relative aspect-video rounded-xl md:rounded-2xl overflow-hidden shadow-inner">
                <Image src={selfieUrl} alt="Selfie" fill className="object-cover" />
                <Button size="icon" variant="destructive" className="absolute top-2 right-2 rounded-full h-8 w-8" onClick={() => setSelfieUrl(null)}><X className="w-4 h-4" /></Button>
              </div>
            ) : isCameraActive ? (
              <div className="space-y-4">
                <div className="relative aspect-video rounded-xl md:rounded-2xl overflow-hidden bg-black shadow-2xl">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  <div className="absolute inset-0 border-[3px] border-primary/30 rounded-xl md:rounded-2xl pointer-events-none" />
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <Button className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs" onClick={handleCaptureSelfie}>Capture Photo</Button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-primary/20 rounded-xl md:rounded-2xl p-8 md:p-10 text-center cursor-pointer hover:bg-primary/5 transition-all group" onClick={() => setIsCameraActive(true)}>
                <Camera className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-3 text-primary/40 group-hover:text-primary transition-colors" />
                <p className="font-black text-xs md:text-sm uppercase tracking-tight">Open Camera</p>
                <p className="text-[9px] md:text-[10px] text-muted-foreground font-bold mt-1">WEBCAM REQUIRED</p>
              </div>
            )}
          </Card>

          <Button className="w-full h-14 md:h-16 rounded-xl md:rounded-[1.5rem] font-black text-base md:text-lg truevibe-gradient border-none shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50" onClick={handleSubmit} disabled={isSubmitting || !idCardUrl || !selfieUrl}>
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Submit for AI Review"}
          </Button>
        </div>
      )}

      {step === 3 && (
        <Card className="rounded-[2.5rem] md:rounded-[3rem] p-10 md:p-16 text-center border-none shadow-2xl bg-white animate-in zoom-in-95 mx-2">
          <Sparkles className="w-16 h-16 md:w-20 md:h-20 text-primary mx-auto mb-8 animate-pulse" />
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Vera is Reviewing</h2>
          <p className="text-muted-foreground font-medium text-sm md:text-base">Verifying your unique vibes... This usually takes a few seconds.</p>
        </Card>
      )}

      {step === 4 && aiResult && (
        <Card className="rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-10 text-center border-none shadow-2xl bg-white animate-in zoom-in-95 mx-2">
          {aiResult.isMatch ? (
            <div className="bg-verified/10 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 md:w-12 md:h-12 text-verified" />
            </div>
          ) : (
            <div className="bg-destructive/10 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-10 h-10 md:w-12 md:h-12 text-destructive" />
            </div>
          )}
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">
            {aiResult.isMatch ? "Verified!" : "Vibe Check Failed"}
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground font-medium leading-relaxed mb-8 px-2">
            {aiResult.reason}
          </p>
          <Button className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl font-black text-base md:text-lg truevibe-gradient border-none" onClick={() => aiResult.isMatch ? router.push('/profile') : handleResetVerification()}>
            {aiResult.isMatch ? "Unlock Features" : "Try Again"}
          </Button>
        </Card>
      )}
    </div>
  );
}
