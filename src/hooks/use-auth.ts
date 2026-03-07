
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

    if (!user) {
      setProfile(null);
      setLoading(false);
      const publicPaths = ['/', '/auth/login', '/auth/signup', '/auth/verify'];
      if (!publicPaths.includes(pathname)) {
        router.push('/auth/login');
      }
      return;
    }

    if (!user.emailVerified && pathname !== '/auth/verify') {
      router.push('/auth/verify');
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
          displayName: user.displayName || 'Harmony User',
          name: user.displayName || 'Harmony User',
          photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/400/400`,
          profilePhotoUrl: user.photoURL || `https://picsum.photos/seed/${user.uid}/400/400`,
          bio: "Looking for connection...",
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
      const permissionError = new FirestorePermissionError({
        path: userRef.path,
        operation: 'get',
      });
      errorEmitter.emit('permission-error', permissionError);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, db, pathname, router]);

  return { user, profile, loading: authLoading || loading };
}
