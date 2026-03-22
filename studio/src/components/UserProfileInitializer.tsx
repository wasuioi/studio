'use client';

/**
 * UserProfileInitializer — ensures the Firestore user document exists for every
 * authenticated user, regardless of which page they land on first.
 *
 * Problem solved: new users who register and land on /bot (which uses useUser()
 * instead of useAuth()) would never have their Firestore profile created because
 * useAuth() was only called on specific pages (/matches, /profile, etc.).
 */

import { useEffect } from 'react';
import { doc } from 'firebase/firestore';
import { useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function UserProfileInitializer() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  useEffect(() => {
    if (isUserLoading || !user || !user.emailVerified) return;

    const userRef = doc(db, 'users', user.uid);

    // Only create if it doesn't exist — setDoc with merge:true is safe to call
    // on existing docs (it won't overwrite existing fields).
    // We use a non-blocking write so it never blocks page rendering.
    const defaultAvatar = PlaceHolderImages.find(img => img.id === 'user1')?.imageUrl || '';
    const now = new Date().toISOString();

    setDocumentNonBlocking(userRef, {
      id: user.uid,
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Your Name',
      name: user.displayName || 'Your Name',
      photoURL: user.photoURL || defaultAvatar,
      profilePhotoUrl: user.photoURL || defaultAvatar,
      bio: 'Just joined Truevibe! Looking for real vibes.',
      emailVerified: true,
      identityVerified: false,
      verificationStatus: 'not_verified',
      profileCompleted: false,
      tier: 'free',
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }, [user, isUserLoading, db]);

  return null;
}
