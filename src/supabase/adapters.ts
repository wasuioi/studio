// Adapter functions that map Supabase snake_case rows to the legacy camelCase
// types used across the TrueVibe UI. Lets us keep the existing JSX/component
// code unchanged while switching the data layer.

import type { Tables } from '@/supabase/types';
import type { ChatRequest, UserProfile } from '@/types';

type ProfileRow = Tables<'profiles'>;
type ChatRequestRow = Tables<'chat_requests'>;

export function rowToUserProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    uid: row.id,
    email: row.email,
    displayName: row.display_name ?? '',
    name: row.display_name ?? '',
    photoURL: row.photo_url ?? '',
    profilePhotoUrl: row.photo_url ?? '',
    bio: row.bio ?? '',
    location: row.location ?? undefined,
    emailVerified: true, // Supabase email_confirmed_at is checked at the auth layer
    identityVerified: row.identity_verified,
    verificationStatus: row.verification_status,
    profileCompleted: row.profile_completed,
    lastLogin: row.last_login ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tier: row.tier,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topMatches: (row.top_matches as any) ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    personalityProfile: (row.personality_profile as any) ?? undefined,
  };
}

export function rowToChatRequest(row: ChatRequestRow): ChatRequest {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name ?? '',
    senderPhotoURL: row.sender_photo_url ?? '',
    receiverId: row.receiver_id,
    receiverName: row.receiver_name ?? undefined,
    matchScore: row.match_score ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: row.status as any,
    reason: row.reason ?? '',
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? '',
    paymentIntentId: row.payment_intent_id ?? undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dateStatus: (row.date_status as any) ?? undefined,
    suggestedLocation: row.suggested_location ?? undefined,
    suggestedDateTime: row.suggested_date_time ?? undefined,
  };
}

// Reverse adapter — used when inserting a ChatRequest into Supabase.
export function chatRequestToRow(
  req: Partial<ChatRequest> & { senderId: string; receiverId: string }
): Partial<ChatRequestRow> {
  return {
    id: req.id,
    sender_id: req.senderId,
    receiver_id: req.receiverId,
    sender_name: req.senderName ?? null,
    sender_photo_url: req.senderPhotoURL ?? null,
    receiver_name: req.receiverName ?? null,
    match_score: req.matchScore ?? null,
    status: (req.status as 'pending' | 'accepted' | 'rejected') ?? 'pending',
    reason: req.reason ?? null,
    expires_at: req.expiresAt ?? null,
    payment_intent_id: req.paymentIntentId ?? null,
    date_status: req.dateStatus ?? null,
    suggested_date_time: req.suggestedDateTime ?? null,
    suggested_location: req.suggestedLocation ?? null,
  };
}
