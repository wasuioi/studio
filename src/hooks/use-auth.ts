"use client";

import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { UserProfile } from '@/types';

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
      } else {
        // Create default profile if it doesn't exist
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || 'Guest User',
          photoURL: user.photoURL || `https://picsum.photos/seed/${user.uid}/400/400`,
          bio: "Searching for connection...",
          isVerified: false,
          verificationStatus: 'none',
        };
        // Non-blocking set
        setDoc(userRef, newProfile, { merge: true });
        setProfile(newProfile);
      }
      setLoading(false);
    }, (error) => {
      console.error("Profile sync error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, db]);

  return { user, profile, loading: authLoading || loading };
}
