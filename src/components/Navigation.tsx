"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, MessageCircle, Heart, ShieldCheck, LogOut, Zap, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth as useFirebaseAuth, useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { collection, query, where } from 'firebase/firestore';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useFirebaseAuth();
  const { user } = useUser();
  const db = useFirestore();

  const requestsQuery = useMemoFirebase(() => {
    if (!user) return null;
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
    { label: 'Inbox', href: '/requests', icon: Inbox, showBadge: true },
    { label: 'Chat', href: '/messages', icon: MessageCircle },
    { label: 'Verify', href: '/verification', icon: ShieldCheck },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] w-full bg-black/40 backdrop-blur-3xl border-b border-white/5 shadow-2xl h-16">
      {/* Mobile Nav - Top Header */}
      <nav className="md:hidden flex h-full items-center justify-between px-4">
        <Link href="/" className="shrink-0">
          <Logo size="sm" showText={false} />
        </Link>
        <div className="flex flex-1 justify-center items-center gap-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "relative flex items-center justify-center transition-all duration-300",
                  isActive ? "text-primary" : "text-white/40 hover:text-white"
                )}
              >
                <div className={cn("p-1.5 rounded-lg", isActive && "bg-white/10")}>
                  <Icon className={cn("w-5 h-5", isActive && "fill-current")} />
                </div>
                {item.showBadge && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-accent text-[7px] text-white font-black items-center justify-center border border-black/50 shadow-sm">
                      {pendingCount}
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="w-8 flex justify-end">
          {user && (
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-white/30 h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </nav>

      {/* Desktop Nav - Centered Flexbox */}
      <nav className="hidden md:flex h-full items-center justify-between px-8">
        {/* Left Section: Logo */}
        <div className="flex items-center w-[180px]">
          <Link href="/" className="flex items-center">
            <Logo size="sm" />
          </Link>
        </div>

        {/* Center Section: Tabs */}
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

        {/* Right Section: Sign Out */}
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
    </div>
  );
}
