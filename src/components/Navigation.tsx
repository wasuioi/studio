"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, MessageCircle, Heart, ShieldCheck, LogOut, Zap, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth as useFirebaseAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { collection, query, where } from 'firebase/firestore';
import Image from 'next/image';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useFirebaseAuth();
  const { user } = useUser();
  const db = useFirestore();

  const requestsQuery = useMemoFirebase(() => {
    // Guard against unverified users querying protected collections
    if (!user || !user.emailVerified) return null;
    return query(
      collection(db, 'chat_requests'),
      where('receiverId', '==', user.uid),
      where('status', '==', 'pending')
    );
  }, [db, user]);

  const { data: incomingRequests } = useCollection(requestsQuery);
  const pendingCount = incomingRequests?.length || 0;

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/auth/login');
  };

  const authPaths = ['/', '/auth/login', '/auth/signup', '/auth/verify'];
  const isAuthPage = authPaths.includes(pathname);

  if (isAuthPage && !user) return null;

  const navItems = [
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Vera AI', href: '/bot', icon: Zap },
    { label: 'Matches', href: '/matches', icon: Heart },
    { label: 'Invite', href: '/requests', icon: Inbox, showBadge: true },
    { label: 'Chat', href: '/messages', icon: MessageCircle },
    { label: 'Verify', href: '/verification', icon: ShieldCheck },
  ];

  return (
    <>
      {/* 📱 Mobile Top Header */}
      <nav className="fixed top-0 left-0 right-0 z-[100] md:hidden flex h-16 items-center justify-between px-4 bg-black/40 backdrop-blur-3xl border-b border-white/5">
        <Link href="/" className="flex items-center justify-center shrink-0">
          <Image 
            src="/finallogo.png" 
            alt="Truevibe Nav Logo" 
            width={32} 
            height={32} 
            className="object-contain"
            priority
          />
        </Link>
        
        <div className="flex items-center gap-2">
          {user && (
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-white/30 h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </nav>

      {/* 📱 Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] md:hidden flex items-center justify-around h-16 px-2 bg-black/60 backdrop-blur-3xl border-t border-white/10">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 transition-all duration-300 relative",
                isActive ? "text-primary" : "text-white/40"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all",
                isActive && "bg-primary/10"
              )}>
                <Icon className={cn("w-5 h-5", isActive && "fill-current")} />
              </div>
              <span className="text-[8px] font-black uppercase tracking-tighter mt-0.5">{item.label}</span>
              {item.showBadge && pendingCount > 0 && (
                <span className="absolute top-1 right-1/4 flex h-4 w-4">
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-accent text-[8px] text-white font-black items-center justify-center border border-black shadow-lg">
                    {pendingCount}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 💻 Desktop Nav */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-[100] h-16 items-center justify-between px-8 bg-black/40 backdrop-blur-3xl border-b border-white/5">
        <div className="flex items-center w-[180px]">
          <Link href="/" className="flex items-center">
            <Image 
              src="/alllogo.png" 
              alt="Truevibe Nav Logo" 
              width={40} 
              height={40} 
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <div className="flex items-center justify-center flex-1 gap-2 lg:gap-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "text-[10px] font-bold transition-all duration-300 flex items-center gap-2 px-4 py-2 rounded-full relative uppercase tracking-widest border border-transparent whitespace-nowrap",
                  isActive 
                    ? "bg-white/10 text-white shadow-lg border-white/10" 
                    : "text-white/50 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive && "fill-current")} />
                <span>{item.label}</span>
                {item.showBadge && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5">
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-accent text-[9px] text-white font-black items-center justify-center border-2 border-background shadow-lg">
                      {pendingCount}
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center justify-end w-[180px]">
          {user && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout} 
              className="rounded-full text-white/40 hover:text-white hover:bg-destructive/10 hover:text-destructive gap-2 font-black uppercase tracking-widest text-[10px] h-9"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Button>
          )}
        </div>
      </nav>
    </>
  );
}