"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Upload, Camera, CheckCircle, Clock, ShieldCheck, FileText, X, Sparkles } from 'lucide-react';
import { doc } from 'firebase/firestore';
import { useFirestore, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { verifyIdentity } from '@/ai/flows/verify-identity-flow';

export default function VerificationPage() {
  const { profile } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1); // 1: Info, 2: Upload, 3: Processing, 4: Result
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
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use this app.',
          });
        }
      };
      getCameraPermission();
    }
  }, [isCameraActive, toast]);

  const handleCaptureSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setSelfieUrl(dataUrl);
        setIsCameraActive(false);
        const stream = video.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdCardUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!profile || !idCardUrl || !selfieUrl) return;
    setIsSubmitting(true);
    setStep(3); // Show processing state
    
    try {
      // 1. Call AI Verification Flow
      const result = await verifyIdentity({
        idCardPhotoUri: idCardUrl,
        selfiePhotoUri: selfieUrl,
      });

      setAiResult(result);

      // 2. Prepare Firestore updates
      const requestId = crypto.randomUUID();
      const requestRef = doc(db, 'user_profiles', profile.uid, 'verification_requests', requestId);
      const userRef = doc(db, 'user_profiles', profile.uid);

      const status = result.isMatch ? 'verified' : 'rejected';
      
      const verificationData = {
        id: requestId,
        userId: profile.uid,
        status: status,
        aiScore: result.confidenceScore,
        aiReason: result.reason,
        submittedAt: new Date().toISOString(),
      };

      // 3. Save result (non-blocking)
      setDocumentNonBlocking(requestRef, verificationData, { merge: true });
      updateDocumentNonBlocking(userRef, {
        verificationStatus: status,
        isVerified: result.isMatch,
        updatedAt: new Date().toISOString(),
      });

      setStep(4); // Show final result screen
    } catch (error) {
      console.error("AI Verification failed", error);
      toast({
        variant: 'destructive',
        title: 'Verification Error',
        description: 'The AI service encountered an error. Please try again later.',
      });
      setStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (profile?.verificationStatus === 'verified' && step !== 4) {
    return (
      <div className="max-w-md mx-auto p-4 pt-24 text-center">
        <Navigation />
        <div className="bg-verified/10 p-8 rounded-[3rem] border border-verified/20">
          <CheckCircle className="w-16 h-16 text-verified mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Verified!</h1>
          <p className="text-muted-foreground">Your account is fully verified. Enjoy secure matching.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 pt-8 md:pt-24 mb-20">
      <Navigation />
      
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Identity Verification</h1>
        <p className="text-muted-foreground">Protecting our community from bots and fake profiles.</p>
      </header>

      {step === 1 && (
        <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8">
            <ShieldCheck className="w-12 h-12 text-primary mb-4" />
            <CardTitle className="text-2xl">Trust is Key</CardTitle>
            <CardDescription>Our AI will instantly verify your identity by comparing your ID with a live selfie.</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <div className="flex gap-4 items-start">
              <div className="bg-accent p-2 rounded-xl"><FileText className="text-primary w-5 h-5" /></div>
              <div>
                <h4 className="font-bold">ID Verification</h4>
                <p className="text-sm text-muted-foreground">Valid Passport, Driver's License or National ID.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-accent p-2 rounded-xl"><Camera className="text-primary w-5 h-5" /></div>
              <div>
                <h4 className="font-bold">Live Selfie</h4>
                <p className="text-sm text-muted-foreground">A quick photo to match your ID.</p>
              </div>
            </div>
            
            <Button className="w-full h-14 rounded-2xl bg-primary font-bold text-lg" onClick={() => setStep(2)}>
              Get Started
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card className="rounded-3xl p-6 border-none shadow-md">
            <h3 className="font-bold mb-4">Upload ID Card</h3>
            {idCardUrl ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden group">
                <Image src={idCardUrl} alt="ID Card" fill className="object-cover" />
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute top-2 right-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setIdCardUrl(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-muted rounded-2xl p-8 text-center bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors block">
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Click to upload photo of ID</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
              </label>
            )}
          </Card>

          <Card className="rounded-3xl p-6 border-none shadow-md">
            <h3 className="font-bold mb-4">Take Selfie</h3>
            {selfieUrl ? (
              <div className="relative aspect-video rounded-2xl overflow-hidden group">
                <Image src={selfieUrl} alt="Selfie" fill className="object-cover" />
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute top-2 right-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setSelfieUrl(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : isCameraActive ? (
              <div className="space-y-4">
                <video ref={videoRef} className="w-full aspect-video rounded-2xl bg-black" autoPlay muted playsInline />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2">
                  <Button className="flex-1 rounded-xl" onClick={handleCaptureSelfie} disabled={hasCameraPermission === false}>
                    Capture Photo
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => setIsCameraActive(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed border-muted rounded-2xl p-8 text-center bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setIsCameraActive(true)}
              >
                <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">Take a live selfie</p>
                <p className="text-xs text-muted-foreground mt-1">Make sure your face is visible</p>
              </div>
            )}
          </Card>

          <Button 
            className="w-full h-14 rounded-2xl bg-primary font-bold text-lg shadow-lg" 
            onClick={handleSubmit}
            disabled={isSubmitting || !idCardUrl || !selfieUrl}
          >
            {isSubmitting ? "Submitting..." : "Submit for AI Review"}
          </Button>
        </div>
      )}

      {step === 3 && (
        <Card className="rounded-3xl p-12 text-center border-none shadow-lg">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <Sparkles className="w-full h-full text-primary animate-pulse" />
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-2xl font-bold mb-2">AI is Verifying</h2>
          <p className="text-muted-foreground">Comparing your ID with your selfie. This usually takes a few seconds...</p>
        </Card>
      )}

      {step === 4 && aiResult && (
        <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden">
          <div className={cn(
            "p-8 text-center",
            aiResult.isMatch ? "bg-verified/10" : "bg-destructive/10"
          )}>
            {aiResult.isMatch ? (
              <CheckCircle className="w-16 h-16 text-verified mx-auto mb-4" />
            ) : (
              <X className="w-16 h-16 text-destructive mx-auto mb-4" />
            )}
            <h2 className="text-2xl font-bold mb-2">
              {aiResult.isMatch ? "Verification Successful!" : "Verification Failed"}
            </h2>
            <p className="text-sm text-muted-foreground">{aiResult.reason}</p>
          </div>
          <CardContent className="p-8">
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Confidence Score</span>
                <span className="font-bold">{Math.round(aiResult.confidenceScore * 100)}%</span>
              </div>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full", aiResult.isMatch ? "bg-verified" : "bg-destructive")} 
                  style={{ width: `${aiResult.confidenceScore * 100}%` }}
                />
              </div>
              
              <Button 
                className="w-full h-12 rounded-xl mt-4" 
                onClick={() => aiResult.isMatch ? router.push('/profile') : setStep(2)}
              >
                {aiResult.isMatch ? "Go to Profile" : "Try Again"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { cn } from '@/lib/utils';
