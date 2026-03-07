
"use client";

import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { UserProfile } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useRouter, usePathname } from 'next/navigation';

export function useAuth() {
  const { user, isUserLoading: authLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    const publicPaths = ['/', '/auth/login', '/auth/signup'];
    const isPublicPath = publicPaths.includes(pathname);

    if (!user) {
      setProfile(null);
      setLoading(false);
      if (!isPublicPath) {
        router.push('/auth/login');
      }
      return;
    }

    // Mandatory Email Verification Protection
    if (!user.emailVerified && pathname !== '/auth/verify') {
      router.push('/auth/verify');
      return;
    }

    // If verified and trying to access verify page, move to dashboard
    if (user.emailVerified && pathname === '/auth/verify') {
      router.push('/bot');
      return;
    }

    setLoading(true);
    const userRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        setLoading(false);
      } else {
        const now = new Date().toISOString();
        const newProfile: UserProfile = {
          id: user.uid,
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'TrueVibe User',
          name: user.displayName || 'TrueVibe User',
          photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/400/400`,
          profilePhotoUrl: user.photoURL || `https://picsum.photos/seed/${user.uid}/400/400`,
          bio: "Just joined TrueVibe! Looking for real vibes.",
          emailVerified: user.emailVerified,
          identityVerified: false,
          verificationStatus: 'not_verified',
          profileCompleted: false,
          tier: 'free',
          lastLogin: now,
          createdAt: now,
          updatedAt: now,
        };

        setDoc(userRef, newProfile, { merge: true })
          .then(() => {
            setProfile(newProfile);
            setLoading(false);
          })
          .catch((err) => {
            const permissionError = new FirestorePermissionError({
              path: userRef.path,
              operation: 'create',
              requestResourceData: newProfile,
            });
            errorEmitter.emit('permission-error', permissionError);
            setLoading(false);
          });
      }
    }, (error) => {
      // Don't emit error if we're just loading or on a public path
      if (!isPublicPath) {
        const permissionError = new FirestorePermissionError({
          path: userRef.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, db, pathname, router]);

  return { user, profile, loading: authLoading || loading };
}
