"use client";

import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useUser, useFirestore } from '@/firebase';
import { UserProfile } from '@/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useAuth() {
  const { user, isUserLoading: authLoading } = useUser();
  const db = useFirestore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userRef = doc(db, 'user_profiles', user.uid);
    
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
        setLoading(false);
      } else {
        const now = new Date().toISOString();
        const newProfile: UserProfile = {
          id: user.uid, // CRITICAL: Security rules check request.resource.data.id
          uid: user.uid,
          displayName: user.displayName || 'Guest User',
          name: user.displayName || 'Guest User',
          photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/400/400`,
          profilePhotoUrl: user.photoURL || `https://picsum.photos/seed/${user.uid}/400/400`,
          bio: "Searching for connection...",
          gender: "prefer not to say",
          dateOfBirth: "1990-01-01",
          location: "Unknown",
          isVerified: false,
          verificationStatus: 'not_verified',
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
  }, [user, authLoading, db]);

  return { user, profile, loading: authLoading || loading };
}
