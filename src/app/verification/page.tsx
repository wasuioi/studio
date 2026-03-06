"use client";

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Upload, Camera, CheckCircle, Clock, ShieldCheck, FileText, X } from 'lucide-react';
import { doc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function VerificationPage() {
  const { profile } = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1); // 1: Info, 2: Upload, 3: Success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idCardUrl, setIdCardUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

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
        // Stop the stream
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

  const handleSubmit = () => {
    if (!profile || !idCardUrl || !selfieUrl) return;
    setIsSubmitting(true);
    
    const requestId = crypto.randomUUID();
    const requestPath = `user_profiles/${profile.uid}/verification_requests/${requestId}`;
    const requestRef = doc(db, requestPath);
    
    const verificationData = {
      id: requestId,
      userId: profile.uid,
      idCardFrontUrl: idCardUrl,
      selfieUrl: selfieUrl,
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    // 1. Create the verification request
    setDoc(requestRef, verificationData)
      .then(() => {
        // 2. Update the user profile status
        const userRef = doc(db, 'user_profiles', profile.uid);
        updateDoc(userRef, {
          verificationStatus: 'pending'
        }).catch(err => console.error("Profile update failed", err));
        
        setStep(3);
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: requestRef.path,
          operation: 'create',
          requestResourceData: verificationData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (profile?.verificationStatus === 'verified') {
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

  if (profile?.verificationStatus === 'pending' || step === 3) {
    return (
      <div className="max-w-md mx-auto p-4 pt-24 text-center">
        <Navigation />
        <Card className="rounded-3xl p-8 border-none shadow-lg">
          <Clock className="w-16 h-16 text-unverified mx-auto mb-4 animate-pulse" />
          <h1 className="text-2xl font-bold mb-2">Verification Pending</h1>
          <p className="text-muted-foreground mb-6">We're reviewing your documents. This usually takes 24-48 hours.</p>
          <Button variant="outline" className="w-full rounded-2xl" onClick={() => router.push('/profile')}>
            Back to Profile
          </Button>
        </Card>
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

      {step === 1 ? (
        <Card className="rounded-[2.5rem] border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8">
            <ShieldCheck className="w-12 h-12 text-primary mb-4" />
            <CardTitle className="text-2xl">Trust is Key</CardTitle>
            <CardDescription>We need to verify that you are a real person before you can start messaging matches.</CardDescription>
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
      ) : (
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
                {hasCameraPermission === false && (
                  <Alert variant="destructive">
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>Please allow camera access to use this feature.</AlertDescription>
                  </Alert>
                )}
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
            {isSubmitting ? "Uploading..." : "Submit for Review"}
          </Button>
        </div>
      )}
    </div>
  );
}
