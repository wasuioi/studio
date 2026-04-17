"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth as useProfileAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Edit3, X, Save, Camera, Trash2, Image as ImageIcon, Loader2, Heart, User, Upload, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { supabase } from '@/supabase/client';
import { useCollection } from '@/supabase/hooks/use-collection';
import type { Tables } from '@/supabase/types';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { canUse } from '@/lib/feature-gates';
import Link from 'next/link';

function PartnerVisionText({ summary }: { summary?: string }) {
  const [expanded, setExpanded] = useState(false);
  const text = summary || "Awaiting AI analysis...";
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black text-white/40 uppercase mb-1">Partner Vision</p>
        <p className={`text-sm font-medium text-white/90 ${expanded ? '' : 'line-clamp-3'}`}>{text}</p>
        {summary && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1 text-[11px] font-bold text-accent/70 hover:text-accent transition-colors"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>
    </div>
  );
}

type Post = Tables<'posts'>;
type PersonalityProfile = Tables<'personality_profiles'>;

export default function ProfilePage() {
  const { profile, user, loading, refetch: refetchProfile } = useProfileAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [personality, setPersonality] = useState<PersonalityProfile | null>(null);
  const [postPhoto, setPostPhoto] = useState<File | null>(null);
  const [postPhotoPreview, setPostPhotoPreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const postPhotoInputRef = useRef<HTMLInputElement>(null);

  // Posts, realtime
  const { data: posts, refetch: refetchPosts } = useCollection<'posts'>({
    table: 'posts',
    query: (q) => (user ? q.eq('user_id', user.id).order('created_at', { ascending: false }) : q),
    realtime: user ? { column: 'user_id', value: user.id } : undefined,
    deps: [user?.id],
  });

  // Personality profile (for Partner Vision card)
  useEffect(() => {
    if (!user) return;
    supabase
      .from('personality_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setPersonality(data));
  }, [user]);

  useEffect(() => {
    if (profile) {
      setEditedName(profile.display_name || '');
      setEditedBio(profile.bio || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: editedName,
        bio: editedBio,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error.message || "Could not save profile.",
      });
      return;
    }
    setIsEditing(false);
    refetchProfile();
    toast({ title: "Profile Updated", description: "Your vibe has been saved." });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
      });
      return;
    }

    setIsUploading(true);
    try {
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, file, { upsert: false });

      if (uploadError) {
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: uploadError.message,
        });
        return;
      }

      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          photo_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: updateError.message,
        });
        return;
      }

      refetchProfile();
      toast({ title: "Avatar Updated", description: "Your photo has been uploaded securely." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: err.message || "Could not upload image.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePostPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
      });
      return;
    }

    if (postPhotoPreview) URL.revokeObjectURL(postPhotoPreview);
    setPostPhoto(file);
    setPostPhotoPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const clearPostPhoto = () => {
    if (postPhotoPreview) URL.revokeObjectURL(postPhotoPreview);
    setPostPhoto(null);
    setPostPhotoPreview(null);
  };

  const handleCreatePost = async () => {
    if (!user) return;
    if (!newPostContent.trim() && !postPhoto) return;

    setIsPosting(true);
    try {
      let photoUrl: string | null = null;

      if (postPhoto) {
        const path = `${user.id}/${Date.now()}_${postPhoto.name}`;
        const { error: uploadError } = await supabase.storage
          .from('post-photos')
          .upload(path, postPhoto, { upsert: false });

        if (uploadError) {
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: uploadError.message,
          });
          return;
        }

        const { data: urlData } = supabase.storage
          .from('post-photos')
          .getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: newPostContent,
        photo_url: photoUrl,
      });
      if (error) {
        toast({
          variant: "destructive",
          title: "Post Failed",
          description: error.message,
        });
        return;
      }

      setNewPostContent('');
      clearPostPhoto();
      refetchPosts();
      toast({ title: "Update Shared", description: "Your vibe has resonated." });
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: error.message,
      });
    } else {
      refetchPosts();
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (!profile || !user) return null;

  const stage = (profile as { stage?: number }).stage ?? 0;

  if (!canUse('view_profile_page', stage)) {
    return (
      <div className="max-w-3xl mx-auto p-4 min-h-screen pb-32 pt-20">
        <Navigation />
        <Card className="glass-card p-10 md:p-20 text-center rounded-[2.5rem] animate-in zoom-in-95 bg-white/5 border-white/10 mt-8">
          <User className="w-12 h-12 md:w-20 md:h-20 mx-auto mb-6 text-primary/40" />
          <h3 className="text-2xl md:text-4xl font-black mb-4 text-white">Let&apos;s finish your introduction first</h3>
          <p className="text-white/60 font-medium mb-8 max-w-xs mx-auto text-sm md:text-lg">
            Chat with Vera a bit more and your profile will unlock.
          </p>
          <Link href="/bot">
            <Button className="truevibe-pill-button h-12 px-10">Keep chatting with Vera</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const displayName = profile.display_name || 'Viber';
  const photoUrl = profile.photo_url || '';

  // personality.traits is JSON — be defensive
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traits: any = personality?.traits ?? null;
  const tags: string[] | undefined = traits?.user_persona?.tags;
  const partnerSummary: string | undefined = traits?.ideal_partner?.summary ?? personality?.summary ?? undefined;

  return (
    <div className="max-w-lg mx-auto px-4 min-h-screen pb-32 pt-20">
      <Navigation />

      {/* Hidden file inputs */}
      <input type="file" ref={fileInputRef} id="profile-photo-input" className="sr-only" accept="image/*" onChange={handleFileChange} />
      <input type="file" ref={postPhotoInputRef} className="sr-only" accept="image/*" onChange={handlePostPhotoChange} />

      {/* ── Profile header ── */}
      <div className="flex flex-col items-center mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Avatar */}
        <div className="relative">
          <Avatar className="w-24 h-24 rounded-full border-[3px] border-primary/30 shadow-2xl overflow-hidden bg-muted">
            {isUploading && (
              <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
            <AvatarImage src={photoUrl} className="object-cover" />
            <AvatarFallback className="font-black text-2xl bg-primary/20 text-primary">{displayName[0]}</AvatarFallback>
          </Avatar>
          <label
            htmlFor="profile-photo-input"
            className="absolute -bottom-1 -right-1 bg-primary p-2 rounded-full shadow-lg text-white hover:scale-110 transition-transform active:scale-95 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
          </label>
        </div>

        {/* Name + Bio */}
        {isEditing ? (
          <div className="w-full max-w-sm mt-4 space-y-3">
            <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="text-center font-black text-xl h-12 rounded-xl bg-white/10 border-none shadow-inner text-white" />
            <Textarea value={editedBio} onChange={(e) => setEditedBio(e.target.value)} className="text-center rounded-xl bg-white/10 border-none shadow-inner min-h-[80px] text-white" />
            <div className="flex gap-2 justify-center">
              <Button onClick={handleSaveProfile} size="sm" className="truevibe-pill-button px-8"><Save className="w-4 h-4 mr-2" /> Save</Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="rounded-full h-10 w-10 p-0 text-white/60"><X className="w-4 h-4" /></Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mt-3">
              <h1 className="text-xl font-black tracking-tight text-white">{displayName}</h1>
              {profile.identity_verified && (
                <Badge className="bg-verified text-white rounded-full font-black px-2 py-0.5 text-[9px] uppercase tracking-widest border-none">VERIFIED</Badge>
              )}
            </div>
            <p className="text-sm text-white/50 font-medium text-center mt-1 max-w-xs leading-relaxed">
              {profile.bio || 'Just joined TrueVibe!'}
            </p>
          </>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="glass-card rounded-2xl mt-6 flex divide-x divide-white/10">
        <div className="flex-1 py-4 text-center">
          <p className="text-lg font-black text-white">{tags?.length ?? 0}</p>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Vibe Tags</p>
        </div>
        <div className="flex-1 py-4 text-center">
          <p className="text-lg font-black text-white">{posts?.length ?? 0}</p>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Posts</p>
        </div>
        <div className="flex-1 py-4 text-center">
          <ShieldCheck className={`w-5 h-5 mx-auto ${profile.identity_verified ? 'text-green-400' : 'text-white/20'}`} />
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mt-1">
            {profile.identity_verified ? 'Verified' : 'Unverified'}
          </p>
        </div>
      </div>

      {/* ── Action buttons ── */}
      {!isEditing && (
        <div className="flex justify-center gap-3 mt-4">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-white/5 px-5 h-9 text-xs font-bold">
            <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
          <label htmlFor="profile-photo-input" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-5 h-9 text-xs font-bold text-white/60 hover:text-white cursor-pointer transition-colors hover:bg-white/5">
            <Upload className="w-3.5 h-3.5" /> Photo
          </label>
          {!profile.identity_verified && (
            <Button variant="ghost" size="sm" onClick={() => router.push('/verification')} className="rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-white/5 px-5 h-9 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Verify
            </Button>
          )}
        </div>
      )}

      {/* ── Vibe tags (inline) ── */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {tags.map((tag: string) => (
            <Badge key={tag} variant="outline" className="rounded-full border-white/10 text-white/60 text-xs px-3 py-1">{tag}</Badge>
          ))}
        </div>
      )}

      {/* ── Partner Vision (compact) ── */}
      {partnerSummary && (
        <div className="glass-card rounded-2xl p-4 mt-4">
          <PartnerVisionText summary={partnerSummary} />
        </div>
      )}

      {/* ── Post composer (compact) ── */}
      <div className="glass-card rounded-2xl p-4 mt-6">
        <Textarea
          placeholder="Share your current vibe..."
          value={newPostContent}
          onChange={(e) => setNewPostContent(e.target.value)}
          className="min-h-[60px] border-none bg-white/5 rounded-xl resize-none focus-visible:ring-primary/20 p-3 text-sm font-medium text-white"
        />
        {postPhotoPreview && (
          <div className="relative inline-block mt-3">
            <img src={postPhotoPreview} alt="Selected preview" className="max-h-32 rounded-xl border border-white/10" />
            <button type="button" onClick={clearPostPhoto} aria-label="Remove photo" className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex justify-between items-center mt-3">
          <Button variant="ghost" size="sm" onClick={() => postPhotoInputRef.current?.click()} disabled={isPosting} className="rounded-full text-white/40 font-bold hover:bg-white/5 hover:text-white h-8 text-xs">
            <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Media
          </Button>
          <Button onClick={handleCreatePost} disabled={isPosting || (!newPostContent.trim() && !postPhoto)} size="sm" className="truevibe-pill-button h-8 px-5 text-xs">
            {isPosting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Post'}
          </Button>
        </div>
      </div>

      {/* ── Posts grid (2 columns) ── */}
      <div className="mt-6">
        <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-3 px-1">Cosmic Updates</h3>
        {posts?.length === 0 ? (
          <div className="text-center py-12 glass-card rounded-2xl border-dashed border-white/10">
            <p className="text-white/30 font-bold italic text-sm">No updates yet. Start the vibe!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {posts?.map((post: Post) => (
              <div key={post.id} className="relative group rounded-[1.25rem] overflow-hidden bg-white/5 border border-white/10 animate-in fade-in duration-500">
                {post.photo_url ? (
                  <div className="relative aspect-[3/4]">
                    <Image src={post.photo_url} alt="Post" fill className="object-cover" sizes="(max-width: 768px) 50vw, 300px" />
                  </div>
                ) : (
                  <div className="aspect-[3/4] p-4 flex items-end">
                    <p className="text-sm text-white/70 font-medium line-clamp-6">{post.content}</p>
                  </div>
                )}
                {/* Text overlay on photo posts */}
                {post.photo_url && post.content && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-xs text-white/90 font-medium line-clamp-2">{post.content}</p>
                  </div>
                )}
                {/* Delete button (visible on hover) */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="bg-black/40 hover:bg-black/60 text-white/60 hover:text-destructive rounded-full h-7 w-7" onClick={() => handleDeletePost(post.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {/* Date (visible on hover) */}
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] font-bold text-white/70 bg-black/40 rounded-full px-2 py-0.5">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
