
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
  topMatches?: Array<{
    id: string;
    name: string;
    gender: string;
    age: number;
    photoURL: string;
    summary: string;
    score: number;
    reason: string;
  }>;
  personalityProfile?: {
    user_persona: {
      summary: string;
      tags: string[];
    };
    ideal_partner: {
      summary: string;
      tags: string[];
    };
    weights: {
      career: number;
      lifestyle: number;
      emotionalIntelligence: number;
      humor: number;
      physicalActivity: number;
    };
    readiness_score: number;
  };
}

export interface ChatRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  receiverId: string;
  receiverName?: string;
  matchScore: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  reason: string;
  createdAt: string;
  expiresAt: string;
  paymentIntentId?: string;
  // Date planning fields
  dateStatus?: 'pending' | 'planning' | 'waiting_sender' | 'planned';
  receiverLocationPref?: string;
  receiverTimePref?: string;
  senderLocationPref?: string;
  senderTimePref?: string;
  senderActualLocation?: string;
  receiverActualLocation?: string;
  suggestedLocation?: string;
  suggestedDateTime?: string;
  scheduledFor?: string; // ISO string for reminder logic
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
