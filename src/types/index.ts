
export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  name: string;
  photoURL: string;
  profilePhotoUrl: string;
  bio: string;
  gender?: string;
  dateOfBirth?: string;
  location?: string;
  emailVerified: boolean;
  identityVerified: boolean;
  verificationStatus: 'not_verified' | 'pending' | 'verified' | 'rejected' | 'none';
  profileCompleted: boolean;
  lastLogin: string;
  createdAt: string;
  updatedAt: string;
  tier: 'free' | 'lite' | 'premium';
  personalityProfile?: {
    traits: any;
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
  participantIds: string[];
  score: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface BotChatMessage {
  id: string;
  userId: string;
  message: string;
  role: 'user' | 'model';
  timestamp: string;
}
