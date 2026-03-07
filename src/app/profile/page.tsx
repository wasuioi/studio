
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
import { Edit3, X, Save, Camera, Plus, Trash2, Image as ImageIcon, Loader2, ShieldCheck } from 'lucide-react';
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
    <div className="max-w-2xl mx-auto p-4 pt-8 md:pt-24 min-h-screen pb-32 space-y-8">
      <Navigation />
      
      <Card className="overflow-hidden border-none shadow-xl rounded-[2.5rem] bg-white animate-in fade-in slide-in-from-bottom-4">
        <div className="relative h-64 w-full bg-primary/10 group">
          <Image 
            src={profile.photoURL} 
            alt={profile.displayName} 
            fill 
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button variant="secondary" className="rounded-full font-bold h-12" onClick={() => setShowPhotoSelector(true)}>
              <Camera className="w-4 h-4 mr-2" /> Change Photo
            </Button>
          </div>
        </div>
        
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="font-black text-xl h-14 rounded-2xl border-none shadow-inner bg-muted/30" />
                  <Textarea value={editedBio} onChange={(e) => setEditedBio(e.target.value)} className="rounded-2xl border-none shadow-inner bg-muted/30 min-h-[100px]" />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveProfile} className="rounded-xl flex-1 h-12 font-bold"><Save className="w-4 h-4 mr-2" /> Save</Button>
                    <Button variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl h-12"><X className="w-4 h-4" /></Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h1 className="text-3xl font-black tracking-tight">{profile.displayName}</h1>
                    {profile.identityVerified ? (
                      <Badge className="bg-verified text-white rounded-full font-black px-3 py-1 text-[10px] uppercase tracking-widest border-none">VERIFIED</Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-unverified border-unverified rounded-full font-black px-3 py-1 text-[10px] uppercase tracking-widest">UNVERIFIED</Badge>
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] font-black uppercase text-primary hover:text-primary hover:bg-primary/10 px-2 rounded-full border border-primary/20" onClick={() => router.push('/verification')}>
                          <ShieldCheck className="w-3 h-3 mr-1" /> Verify Now
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-muted-foreground font-medium leading-relaxed">{profile.bio}</p>
                </>
              )}
            </div>
            {!isEditing && (
              <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="rounded-full hover:bg-primary/10">
                <Edit3 className="w-5 h-5 text-primary" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg rounded-[2rem] bg-white">
        <CardContent className="p-6">
          <h3 className="text-lg font-black mb-4 flex items-center gap-2 uppercase tracking-tight">
            <Plus className="w-5 h-5 text-primary" /> Share your vibe
          </h3>
          <div className="flex gap-4">
            <Avatar className="w-12 h-12 rounded-2xl shadow-md">
              <AvatarImage src={profile.photoURL} />
              <AvatarFallback className="font-black">{profile.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <Textarea 
                placeholder="What's happening today?" 
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[120px] border-none bg-muted/30 rounded-[1.5rem] resize-none focus-visible:ring-primary/20 p-4 text-base font-medium shadow-inner"
              />
              <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground font-bold hover:bg-muted">
                  <ImageIcon className="w-4 h-4 mr-2" /> Media
                </Button>
                <Button onClick={handleCreatePost} disabled={!newPostContent.trim()} className="rounded-full px-8 h-12 font-black truevibe-gradient border-none shadow-lg shadow-primary/20">
                  Post Update
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <h3 className="text-xl font-black px-2 uppercase tracking-tight">Recent Vibes</h3>
        {posts?.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-[3rem] border-2 border-dashed border-muted/50">
            <p className="text-muted-foreground font-bold italic">No posts yet. Start the vibe!</p>
          </div>
        ) : (
          posts?.map((post) => (
            <Card key={post.id} className="border-none shadow-md rounded-[2.5rem] bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12 rounded-2xl border shadow-sm">
                      <AvatarImage src={profile.photoURL} />
                      <AvatarFallback className="font-black">{profile.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight">{profile.displayName}</p>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={() => deleteDocumentNonBlocking(doc(db, 'users', user.uid, 'posts', post.id))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-base leading-relaxed text-foreground/90 font-medium">{post.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showPhotoSelector && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black tracking-tight">Choose Vibe Portrait</h3>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowPhotoSelector(false)}><X className="w-6 h-6" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
              {PlaceHolderImages.map((img) => (
                <button 
                  key={img.id} 
                  className="relative aspect-square rounded-[2rem] overflow-hidden group border-4 border-transparent hover:border-primary transition-all shadow-lg" 
                  onClick={() => handleUpdatePhoto(img.imageUrl)}
                >
                  <Image src={img.imageUrl} alt={img.description} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
            <Button className="w-full mt-8 h-14 rounded-2xl font-black uppercase tracking-widest bg-muted text-muted-foreground hover:bg-muted/80" onClick={() => setShowPhotoSelector(false)}>Cancel Selection</Button>
          </div>
        </div>
      )}
    </div>
  );
}
