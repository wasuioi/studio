export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  isVerified: boolean;
  verificationStatus: 'none' | 'pending' | 'verified';
  personalityProfile?: {
    datingPreferences: string[];
    values: string[];
    communicationStyle: string;
    summary: string;
  };
}

export interface Match {
  id: string;
  userIds: string[];
  lastMessage?: string;
  lastMessageTimestamp?: any;
  user?: UserProfile; // Joined profile for display
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  timestamp: any;
}