
export interface UserProfile {
  id: string;
  uid: string;
  displayName: string;
  name: string;
  photoURL: string;
  profilePhotoUrl: string;
  bio: string;
  gender: string;
  dateOfBirth: string;
  location: string;
  isVerified: boolean;
  verificationStatus: 'not_verified' | 'pending' | 'verified' | 'rejected' | 'none';
  createdAt: string;
  updatedAt: string;
  personalityProfile?: {
    datingPreferences: string[];
    values: string[];
    communicationStyle: string;
    summary: string;
  };
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
}

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  matchScore: number;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  isMutual: boolean;
  createdAt: string;
  user?: UserProfile;
}
