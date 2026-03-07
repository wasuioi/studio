"use client";

import { useState, useEffect } from 'react';
import { useAuth as useProfileAuth } from '@/hooks/use-auth';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Edit3, X, Save, Camera, Plus, Trash2, Image as ImageIcon, Loader2, ShieldCheck, Heart, User } from 'lucide-react';
import Image from 'next/image';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { 
  useFirestore, 
  updateDocumentNonBlocking, 
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useCollection,
  useMemoFirebase
} from '@/firebase';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { profile, user, loading } = useProfileAuth();
  const db = useFirestore();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [showPhotoSelector, setShowPhotoSelector] = useState(false);

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
    updateDocumentNonBlocking(userRef, {
      name: editedName,
      displayName: editedName,
      bio: editedBio,
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  const handleUpdatePhoto = (url: string) => {
    if (!user || !profile) return;
    const userRef = doc(db, 'users', user.uid);
    updateDocumentNonBlocking(userRef, {
      photoURL: url,
      profilePhotoUrl: url,
      updatedAt: new Date().toISOString(),
    });
    setShowPhotoSelector(false);
  };

  const handleCreatePost = () => {
    if (!user || !newPostContent.trim()) return;
    const postsRef = collection(db, 'users', user.uid, 'posts');
    addDocumentNonBlocking(postsRef, {
      userId: user.uid,
      content: newPostContent,
      createdAt: new Date().toISOString(),
    });
    setNewPostContent('');
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto p-4 min-h-screen pb-32 space-y-8">
      <Navigation />
      
      {/* Top Section: Cover & Avatar */}
      <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500 mt-8">
        <div className="relative h-40 md:h-60 w-full bg-gradient-to-r from-[#6A5CFF] to-[#FF4DA6] rounded-[2rem] overflow-hidden group">
          <Image 
            src={profile.photoURL} 
            alt="Cover" 
            fill 
            className="object-cover opacity-30 blur-sm"
          />
          <div className="absolute inset-0 bg-black/20" />
        </div>
        
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="relative group">
            <Avatar className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background shadow-2xl">
              <AvatarImage src={profile.photoURL} className="object-cover" />
              <AvatarFallback className="font-black bg-primary/20">{profile.displayName[0]}</AvatarFallback>
            </Avatar>
            <button 
              onClick={() => setShowPhotoSelector(true)}
              className="absolute bottom-1 right-1 bg-white p-2 rounded-full shadow-lg text-primary hover:scale-110 transition-transform"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="pt-12 text-center space-y-2">
        {isEditing ? (
          <div className="max-w-md mx-auto space-y-4">
            <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="text-center font-black text-xl md:text-2xl h-12 rounded-xl bg-white/10 border-none shadow-inner" />
            <Textarea value={editedBio} onChange={(e) => setEditedBio(e.target.value)} className="text-center rounded-xl bg-white/10 border-none shadow-inner min-h-[80px]" />
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
                <Badge className="bg-verified text-white rounded-full font-black px-3 py-0.5 text-[10px] uppercase tracking-widest">VERIFIED</Badge>
              ) : (
                <button onClick={() => router.push('/verification')} className="text-[10px] font-black uppercase text-accent hover:underline">Verify Soul</button>
              )}
            </div>
            <p className="text-sm md:text-base text-white/60 max-w-md mx-auto font-medium">{profile.bio || "Just joined TrueVibe! Looking for real vibes."}</p>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="rounded-full text-white/40 hover:text-white mt-2">
              <Edit3 className="w-4 h-4 mr-2" /> Edit Profile
            </Button>
          </>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase mb-1">Partner Vision</p>
              <p className="text-sm font-medium text-white/90 line-clamp-3">
                {profile.personalityProfile?.ideal_partner.summary || "Awaiting AI analysis..."}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Feed Section */}
      <div className="space-y-6">
        <Card className="glass-card rounded-[2rem] p-6">
          <div className="flex gap-4">
            <Avatar className="w-10 h-10 rounded-full border border-white/10">
              <AvatarImage src={profile.photoURL} />
              <AvatarFallback className="font-black">{profile.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <Textarea 
                placeholder="Share your current vibe..." 
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[100px] border-none bg-white/5 rounded-2xl resize-none focus-visible:ring-primary/20 p-4 text-sm font-medium"
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
                      <Avatar className="w-10 h-10 rounded-full border border-white/10">
                        <AvatarImage src={profile.photoURL} />
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

      {showPhotoSelector && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">Choose Avatar</h3>
              <Button variant="ghost" size="icon" className="rounded-full text-white/40" onClick={() => setShowPhotoSelector(false)}><X className="w-6 h-6" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-4 overflow-y-auto scrollbar-hide py-2">
              {PlaceHolderImages.map((img) => (
                <button 
                  key={img.id} 
                  className="relative aspect-square rounded-[1.5rem] overflow-hidden group border-2 border-transparent hover:border-primary transition-all shadow-lg" 
                  onClick={() => handleUpdatePhoto(img.imageUrl)}
                >
                  <Image src={img.imageUrl} alt={img.description} fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
