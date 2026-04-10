// Hand-written to match supabase/migrations/*.sql.
// Regenerate with `npx supabase gen types typescript --project-id <ref> --schema public`
// once the live Supabase project is available.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          bio: string | null;
          photo_url: string | null;
          identity_verified: boolean;
          verification_status: 'not_verified' | 'pending' | 'verified' | 'rejected';
          profile_completed: boolean;
          tier: 'free' | 'premium';
          last_login: string | null;
          created_at: string;
          updated_at: string;
          location: string | null;
          personality_profile: Json | null;
          top_matches: Json | null;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          bio?: string | null;
          photo_url?: string | null;
          identity_verified?: boolean;
          verification_status?: 'not_verified' | 'pending' | 'verified' | 'rejected';
          profile_completed?: boolean;
          tier?: 'free' | 'premium';
          last_login?: string | null;
          created_at?: string;
          updated_at?: string;
          location?: string | null;
          personality_profile?: Json | null;
          top_matches?: Json | null;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          bio?: string | null;
          photo_url?: string | null;
          identity_verified?: boolean;
          verification_status?: 'not_verified' | 'pending' | 'verified' | 'rejected';
          profile_completed?: boolean;
          tier?: 'free' | 'premium';
          last_login?: string | null;
          created_at?: string;
          updated_at?: string;
          location?: string | null;
          personality_profile?: Json | null;
          top_matches?: Json | null;
        };
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          content: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
      };
      personality_profiles: {
        Row: {
          user_id: string;
          partner_vision: string | null;
          traits: Json | null;
          summary: string | null;
          completed_at: string | null;
        };
        Insert: {
          user_id: string;
          partner_vision?: string | null;
          traits?: Json | null;
          summary?: string | null;
          completed_at?: string | null;
        };
        Update: {
          user_id?: string;
          partner_vision?: string | null;
          traits?: Json | null;
          summary?: string | null;
          completed_at?: string | null;
        };
      };
      bot_chats: {
        Row: {
          id: string;
          user_id: string;
          phase: number;
          messages: Json;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          phase?: number;
          messages?: Json;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          phase?: number;
          messages?: Json;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_requests: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          status: 'pending' | 'accepted' | 'rejected';
          message: string | null;
          created_at: string;
          updated_at: string;
          match_score: number | null;
          reason: string | null;
          date_status: string | null;
          sender_name: string | null;
          sender_photo_url: string | null;
          receiver_name: string | null;
          expires_at: string | null;
          payment_intent_id: string | null;
          suggested_date_time: string | null;
          suggested_location: string | null;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          status?: 'pending' | 'accepted' | 'rejected';
          message?: string | null;
          created_at?: string;
          updated_at?: string;
          match_score?: number | null;
          reason?: string | null;
          date_status?: string | null;
          sender_name?: string | null;
          sender_photo_url?: string | null;
          receiver_name?: string | null;
          expires_at?: string | null;
          payment_intent_id?: string | null;
          suggested_date_time?: string | null;
          suggested_location?: string | null;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string;
          status?: 'pending' | 'accepted' | 'rejected';
          message?: string | null;
          created_at?: string;
          updated_at?: string;
          match_score?: number | null;
          reason?: string | null;
          date_status?: string | null;
          sender_name?: string | null;
          sender_photo_url?: string | null;
          receiver_name?: string | null;
          expires_at?: string | null;
          payment_intent_id?: string | null;
          suggested_date_time?: string | null;
          suggested_location?: string | null;
        };
      };
      conversations: {
        Row: {
          id: string;
          participant_ids: string[];
          last_message_at: string | null;
          last_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          participant_ids: string[];
          last_message_at?: string | null;
          last_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          participant_ids?: string[];
          last_message_at?: string | null;
          last_message?: string | null;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string;
          read_at?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_email_verified: { Args: Record<string, never>; Returns: boolean };
      is_conversation_participant: { Args: { conv_id: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
  };
}
