
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
import { Edit3, X, Save, Camera, Plus, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
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

export default function ProfilePage() {
  const { profile, user, loading } = useProfileAuth();
  const db = useFirestore();

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
      
      <Card className="overflow-hidden border-none shadow-xl rounded-[2.5rem] bg-white">
        <div className="relative h-64 w-full bg-primary/10 group">
          <Image 
            src={profile.photoURL} 
            alt={profile.displayName} 
            fill 
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button variant="secondary" className="rounded-full" onClick={() => setShowPhotoSelector(true)}>
              <Camera className="w-4 h-4 mr-2" /> Change Photo
            </Button>
          </div>
        </div>
        
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="font-bold text-xl h-12 rounded-xl" />
                  <Textarea value={editedBio} onChange={(e) => setEditedBio(e.target.value)} className="rounded-xl" />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveProfile} className="rounded-xl flex-1"><Save className="w-4 h-4 mr-2" /> Save</Button>
                    <Button variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl"><X className="w-4 h-4" /></Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl font-bold">{profile.displayName}</h1>
                    {profile.identityVerified ? (
                      <Badge className="bg-verified text-white rounded-full">VERIFIED</Badge>
                    ) : (
                      <Badge variant="outline" className="text-unverified border-unverified">UNVERIFIED</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">{profile.bio}</p>
                </>
              )}
            </div>
            {!isEditing && (
              <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="rounded-full">
                <Edit3 className="w-5 h-5 text-primary" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg rounded-[2rem] bg-white">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Share an update
          </h3>
          <div className="flex gap-3">
            <Avatar className="w-10 h-10 rounded-xl">
              <AvatarImage src={profile.photoURL} />
              <AvatarFallback>{profile.displayName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <Textarea 
                placeholder="What's on your mind?" 
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="min-h-[100px] border-none bg-muted/30 rounded-2xl resize-none focus-visible:ring-primary/20"
              />
              <div className="flex justify-between items-center">
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground">
                  <ImageIcon className="w-4 h-4 mr-2" /> Add Image
                </Button>
                <Button onClick={handleCreatePost} disabled={!newPostContent.trim()} className="rounded-full px-6">
                  Post
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-xl font-bold px-2">My Posts</h3>
        {posts?.map((post) => (
          <Card key={post.id} className="border-none shadow-md rounded-[2rem] bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 rounded-xl">
                    <AvatarImage src={profile.photoURL} />
                    <AvatarFallback>{profile.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-sm">{profile.displayName}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'users', user.uid, 'posts', post.id))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">{post.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showPhotoSelector && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Choose Profile Photo</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowPhotoSelector(false)}><X /></Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {PlaceHolderImages.map((img) => (
                <button key={img.id} className="relative aspect-square rounded-2xl overflow-hidden" onClick={() => handleUpdatePhoto(img.imageUrl)}>
                  <Image src={img.imageUrl} alt={img.description} fill className="object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
