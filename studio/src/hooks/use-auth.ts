
"use client";

import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { UserProfile } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useRouter, usePathname } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const PROFILE_CACHE_KEY = (uid: string) => `profile_cache_${uid}`;

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

    // 1. Unauthenticated handling
    if (!user) {
      setProfile(null);
      setLoading(false);
      if (!isPublicPath && pathname !== '/auth/verify') {
        router.push('/auth/login');
      }
      return;
    }

    // 2. Email Verification Gate
    if (!user.emailVerified) {
      setProfile(null);
      setLoading(false);
      if (!isPublicPath && pathname !== '/auth/verify') {
        router.push('/auth/verify');
      }
      return;
    }

    // 3. Load cached profile instantly (eliminates spinner on repeat visits)
    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY(user.uid));
      if (cached) {
        setProfile(JSON.parse(cached) as UserProfile);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } catch {
      setLoading(true);
    }

    // 4. Authenticated & Verified profile sync (updates cache in background)
    const userRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        console.log('Firestore profile updated:', data);

        // Sync firestore flag if needed
        if (data.emailVerified !== user.emailVerified) {
          updateDoc(userRef, { emailVerified: true });
        }

        const profileData = { ...data, emailVerified: true };
        setProfile(profileData);
        setLoading(false);

        // Update localStorage cache for next visit
        try {
          localStorage.setItem(PROFILE_CACHE_KEY(user.uid), JSON.stringify(profileData));
          console.log('LocalStorage cache updated');
        } catch {}

        // If they are on verify page but now verified, move them along
        if (pathname === '/auth/verify') {
          router.push('/bot');
        }
      } else {
        // Initialize profile with stable human placeholder
        const defaultAvatar = PlaceHolderImages.find(img => img.id === 'user1')?.imageUrl || '';
        const now = new Date().toISOString();
        const newProfile: UserProfile = {
          id: user.uid,
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Your Name',
          name: user.displayName || 'Your Name',
          photoURL: user.photoURL || defaultAvatar,
          profilePhotoUrl: user.photoURL || defaultAvatar,
          bio: "Just joined Truevibe! Looking for real vibes.",
          emailVerified: true,
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
      if (!isPublicPath && pathname !== '/auth/verify') {
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
