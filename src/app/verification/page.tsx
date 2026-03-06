"use client";

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, Camera, CheckCircle, Clock, ShieldCheck, FileText } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useRouter } from 'next/navigation';

export default function VerificationPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Info, 2: Upload, 3: Success
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!profile) return;
    setIsSubmitting(true);
    
    try {
      // Simulate backend processing
      await updateDoc(doc(db, 'users', profile.uid), {
        verificationStatus: 'pending'
      });
      setStep(3);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
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
            <div className="border-2 border-dashed border-muted rounded-2xl p-8 text-center bg-muted/20">
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Click to upload photo of ID</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
            </div>
          </Card>

          <Card className="rounded-3xl p-6 border-none shadow-md">
            <h3 className="font-bold mb-4">Take Selfie</h3>
            <div className="border-2 border-dashed border-muted rounded-2xl p-8 text-center bg-muted/20">
              <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Take a live selfie</p>
              <p className="text-xs text-muted-foreground mt-1">Make sure your face is visible</p>
            </div>
          </Card>

          <Button 
            className="w-full h-14 rounded-2xl bg-primary font-bold text-lg shadow-lg" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Uploading..." : "Submit for Review"}
          </Button>
        </div>
      )}
    </div>
  );
}