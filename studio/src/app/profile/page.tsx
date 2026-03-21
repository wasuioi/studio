"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth as useProfileAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Edit3, X, Save, Camera, Trash2, Image as ImageIcon, Loader2, Heart, User, Upload } from 'lucide-react';
import Image from 'next/image';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  useFirestore,
  updateDocumentNonBlocking,
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useCollection,
  useMemoFirebase,
  initializeFirebase
} from '@/firebase';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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

export default function ProfilePage() {
  const { profile, user, loading } = useProfileAuth();
  const db = useFirestore();
  const { storage } = initializeFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const postsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(db, 'users', user.uid, 'posts'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  const { data: posts } = useCollection(postsQuery);

  useEffect(() => {
    if (profile) {
      setEditedName(profile.displayName || profile.name || '');
      setEditedBio(profile.bio || '');
    }
  }, [profile]);

  const handleSaveProfile = () => {
    if (!user || !profile) return;
    const userRef = doc(db, 'users', user.uid);
    setDocumentNonBlocking(userRef, {
      name: editedName,
      displayName: editedName,
      bio: editedBio,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    setIsEditing(false);
    toast({ title: "Profile Updated", description: "Your vibe has been saved." });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !storage) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        variant: "destructive", 
        title: "File Too Large", 
        description: "Please select an image smaller than 5MB." 
      });
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `profile_pictures/${user.uid}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      const userRef = doc(db, 'users', user.uid);
      updateDocumentNonBlocking(userRef, {
        photoURL: downloadUrl,
        profilePhotoUrl: downloadUrl,
        updatedAt: new Date().toISOString(),
      });
      
      toast({ title: "Avatar Updated", description: "Your photo has been uploaded securely." });
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Upload Failed", 
        description: err.message || "Could not upload image." 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (!profile || !user) return null;

  const coverImage = PlaceHolderImages.find(img => img.id === 'default_cover');

  return (
    <div className="max-w-3xl mx-auto p-4 min-h-screen pb-32 pt-20">
      <Navigation />
      
      <input
        type="file"
        ref={fileInputRef}
        id="profile-photo-input"
        className="sr-only"
        accept="image/*"
        onChange={handleFileChange}
      />

      <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative h-40 md:h-60 w-full bg-gradient-to-r from-[#6A5CFF] to-[#FF4DA6] rounded-[2rem] overflow-hidden group">
          <Image 
            src={coverImage?.imageUrl || "https://picsum.photos/seed/vibe_cover/1200/400"} 
            alt="Cover" 
            fill 
            data-ai-hint="lifestyle blurred background"
            className="object-cover opacity-30 blur-sm"
          />
          <div className="absolute inset-0 bg-black/20" />
        </div>
        
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="relative group">
            <Avatar className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background shadow-2xl overflow-hidden bg-muted relative">
              {isUploading && (
                <div className="absolute inset-0 z-10 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              )}
              <AvatarImage src={profile.photoURL} className="object-cover" />
              <AvatarFallback className="font-black bg-primary/20 text-primary">{profile.displayName[0]}</AvatarFallback>
            </Avatar>
            <label
              htmlFor="profile-photo-input"
              className="absolute bottom-1 right-1 bg-white p-2 rounded-full shadow-lg text-primary hover:scale-110 transition-transform active:scale-95 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </label>
          </div>
        </div>
      </div>

      <div className="pt-12 text-center space-y-2">
        {isEditing ? (
          <div className="max-w-md mx-auto space-y-4">
            <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="text-center font-black text-xl md:text-2xl h-12 rounded-xl bg-white/10 border-none shadow-inner text-white" />
            <Textarea value={editedBio} onChange={(e) => setEditedBio(e.target.value)} className="text-center rounded-xl bg-white/10 border-none shadow-inner min-h-[80px] text-white" />
            <div className="flex gap-2 justify-center">
              <Button onClick={handleSaveProfile} size="sm" className="truevibe-pill-button px-8"><Save className="w-4 h-4 mr-2" /> Save</Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="rounded-full h-10 w-10 p-0 text-white/60"><X className="w-4 h-4" /></Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">{profile.displayName}</h1>
              {profile.identityVerified ? (
                <Badge className="bg-verified text-white rounded-full font-black px-3 py-0.5 text-[10px] uppercase tracking-widest border-none">VERIFIED</Badge>
              ) : (
                <button onClick={() => router.push('/verification')} className="text-[10px] font-black uppercase text-accent hover:underline">Verify Soul</button>
              )}
            </div>
            <p className="text-sm md:text-base text-white/60 max-w-md mx-auto font-medium">{profile.bio || "Just joined TrueVibe! Looking for real vibes."}</p>
            <div className="flex justify-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="rounded-full text-white/40 hover:text-white mt-2">
                <Edit3 className="w-4 h-4 mr-2" /> Edit Info
              </Button>
              <label htmlFor="profile-photo-input" className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm text-white/40 hover:text-white mt-2 cursor-pointer transition-colors hover:bg-white/5">
                <Upload className="w-4 h-4" /> Change Photo
              </label>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <Card className="glass-card rounded-[2rem] p-6 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
            <User className="w-4 h-4" /> About Me
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase mb-1">Looking For</p>
              <p className="text-sm font-medium text-white/90">Long-term connection & shared vibes</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase mb-1">Vibe Tags</p>
              <div className="flex flex-wrap gap-2">
                {profile.personalityProfile?.user_persona.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="rounded-full border-white/10 text-white/70">{tag}</Badge>
                )) || <p className="text-xs text-white/30 italic">Complete Vibe Check to unlock tags</p>}
              </div>
            </div>
          </div>
        </Card>

        <Card className="glass-card rounded-[2rem] p-6 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
            <Heart className="w-4 h-4" /> Ideal Frequency
          </h3>
          <PartnerVisionText summary={profile.personalityProfile?.ideal_partner.summary} />
        </Card>
      </div>

      <div className="space-y-6 mt-8">
        <Card className="glass-card rounded-[2rem] p-6">
          <div className="flex gap-4">
            <Avatar className="w-10 h-10 rounded-full border border-white/10 overflow-hidden">
              <AvatarImage 
                src={profile.photoURL} 
                className="object-cover" 
              />
              <AvatarFallback className="font-black">{profile.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <Textarea 
                placeholder="Share your current vibe..." 
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[100px] border-none bg-white/5 rounded-2xl resize-none focus-visible:ring-primary/20 p-4 text-sm font-medium text-white"
              />
              <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" className="rounded-full text-white/40 font-bold hover:bg-white/5">
                  <ImageIcon className="w-4 h-4 mr-2" /> Media
                </Button>
                <Button onClick={handleCreatePost} disabled={!newPostContent.trim()} size="sm" className="truevibe-pill-button">
                  Post Update
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <h3 className="text-sm font-black text-white/40 uppercase tracking-widest px-2">Cosmic Updates</h3>
          {posts?.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-[2.5rem] border-dashed border-white/10">
              <p className="text-white/30 font-bold italic text-sm">No updates yet. Start the vibe!</p>
            </div>
          ) : (
            posts?.map((post) => (
              <Card key={post.id} className="glass-card rounded-[2rem] overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10 rounded-full border border-white/10 overflow-hidden">
                        <AvatarImage src={profile.photoURL} className="object-cover" />
                        <AvatarFallback className="font-black">{profile.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-black text-xs uppercase text-white/90">{profile.displayName}</p>
                        <p className="text-[9px] text-white/40 font-black uppercase tracking-widest">{new Date(post.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-white/20 hover:text-destructive hover:bg-destructive/10 rounded-full h-8 w-8" onClick={() => deleteDocumentNonBlocking(doc(db, 'users', user.uid, 'posts', post.id))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed text-white/80 font-medium">{post.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );

  function handleCreatePost() {
    if (!user || !newPostContent.trim()) return;
    const postsRef = collection(db, 'users', user.uid, 'posts');
    addDocumentNonBlocking(postsRef, {
      userId: user.uid,
      content: newPostContent,
      createdAt: new Date().toISOString(),
    });
    setNewPostContent('');
    toast({ title: "Update Shared", description: "Your vibe has resonated." });
  }
}