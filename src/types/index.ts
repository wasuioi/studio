export interface UserProfile {
  id: string; // Required by security rules
  uid: string;
  displayName: string;
  name: string; // Alias for displayName to match backend schema
  photoURL: string;
  profilePhotoUrl: string; // Alias for photoURL to match backend schema
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

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  matchScore: number;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  isMutual: boolean;
  createdAt: string;
  user?: UserProfile; // Joined profile for display
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  sentAt: string;
}
