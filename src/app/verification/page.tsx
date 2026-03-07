
"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, Camera, CheckCircle, ShieldCheck, FileText, X, Sparkles, Loader2 } from 'lucide-react';
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

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (profile?.identityVerified && step !== 4) {
    return (
      <div className="max-w-md mx-auto p-4 pt-24 text-center">
        <Navigation />
        <div className="bg-verified/10 p-8 rounded-[3rem]">
          <CheckCircle className="w-16 h-16 text-verified mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Verified!</h1>
          <p className="text-muted-foreground">You are verified. Matching unlocked.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 pt-8 md:pt-24 mb-20">
      <Navigation />
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Identity Verification</h1>
        <p className="text-muted-foreground">Keep HarmonyAI safe and genuine.</p>
      </header>

      {step === 1 && (
        <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8">
            <ShieldCheck className="w-12 h-12 text-primary mb-4" />
            <CardTitle className="text-2xl">Trust First</CardTitle>
            <CardDescription>AI comparison between ID and Selfie.</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="flex gap-4 items-start">
              <div className="bg-accent p-2 rounded-xl"><FileText className="text-primary w-5 h-5" /></div>
              <div>
                <h4 className="font-bold">ID Document</h4>
                <p className="text-sm text-muted-foreground">Valid Passport or ID.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-accent p-2 rounded-xl"><Camera className="text-primary w-5 h-5" /></div>
              <div>
                <h4 className="font-bold">Live Selfie</h4>
                <p className="text-sm text-muted-foreground">A quick verification photo.</p>
              </div>
            </div>
            <Button className="w-full h-14 rounded-2xl" onClick={() => setStep(2)}>
              Get Started
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card className="rounded-3xl p-6">
            <h3 className="font-bold mb-4">ID Card</h3>
            {idCardUrl ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden">
                <Image src={idCardUrl} alt="ID" fill className="object-cover" />
                <Button size="icon" variant="destructive" className="absolute top-2 right-2 rounded-full" onClick={() => setIdCardUrl(null)}><X /></Button>
              </div>
            ) : (
              <label className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer block">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p>Upload ID Photo</p>
              </label>
            )}
          </Card>

          <Card className="rounded-3xl p-6">
            <h3 className="font-bold mb-4">Selfie</h3>
            {selfieUrl ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden">
                <Image src={selfieUrl} alt="Selfie" fill className="object-cover" />
                <Button size="icon" variant="destructive" className="absolute top-2 right-2 rounded-full" onClick={() => setSelfieUrl(null)}><X /></Button>
              </div>
            ) : isCameraActive ? (
              <div className="space-y-4">
                <video ref={videoRef} className="w-full aspect-video rounded-2xl bg-black" autoPlay muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                <Button className="w-full h-12 rounded-xl" onClick={handleCaptureSelfie}>Capture</Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer" onClick={() => setIsCameraActive(true)}>
                <Camera className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                <p>Take Selfie</p>
              </div>
            )}
          </Card>

          <Button className="w-full h-14 rounded-2xl" onClick={handleSubmit} disabled={isSubmitting || !idCardUrl || !selfieUrl}>
            {isSubmitting ? "Processing..." : "Submit for AI Review"}
          </Button>
        </div>
      )}

      {step === 3 && (
        <Card className="rounded-3xl p-12 text-center">
          <Sparkles className="w-16 h-16 text-primary mx-auto mb-6 animate-pulse" />
          <h2 className="text-2xl font-bold mb-2">AI Analyzing</h2>
          <p className="text-muted-foreground">Checking matches...</p>
        </Card>
      )}

      {step === 4 && aiResult && (
        <Card className="rounded-[2.5rem] p-8 text-center">
          {aiResult.isMatch ? (
            <CheckCircle className="w-16 h-16 text-verified mx-auto mb-4" />
          ) : (
            <X className="w-16 h-16 text-destructive mx-auto mb-4" />
          )}
          <h2 className="text-2xl font-bold mb-2">{aiResult.isMatch ? "Successful" : "Failed"}</h2>
          <p className="text-sm text-muted-foreground mb-6">{aiResult.reason}</p>
          <Button className="w-full h-12 rounded-xl" onClick={() => aiResult.isMatch ? router.push('/profile') : setStep(2)}>
            {aiResult.isMatch ? "Continue" : "Try Again"}
          </Button>
        </Card>
      )}
    </div>
  );
}
