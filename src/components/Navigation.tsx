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
    <div className="w-full relative z-[100] bg-transparent">
      {/* Mobile Nav - Top Header */}
      <nav className="md:hidden relative bg-black/40 backdrop-blur-3xl border-b border-white/5 py-2 px-4 shadow-sm h-16 flex items-center justify-between">
        <Logo size="sm" showText={false} className="shrink-0" />
        <div className="flex flex-1 justify-around items-center px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center transition-all duration-300 relative min-w-[36px]",
                  isActive ? "text-primary" : "text-white/40 hover:text-white"
                )}
              >
                <div className={cn("p-1.5 rounded-lg transition-colors", isActive && "bg-white/10")}>
                  <Icon className={cn("w-[18px] h-[18px]", isActive && "fill-current")} />
                </div>
                {item.showBadge && pendingCount > 0 && (
                  <span className="absolute -top-1 right-0 flex h-3.5 w-3.5">
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-accent text-[7px] text-white font-black items-center justify-center border border-black/50">
                      {pendingCount}
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        {user && (
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-white/30 h-8 w-8 rounded-full">
            <LogOut className="w-4 h-4" />
          </Button>
        )}
      </nav>

      {/* Desktop Nav - Centered & Wide Header */}
      <nav className="hidden md:flex relative h-[72px] bg-black/10 backdrop-blur-xl border-b border-white/5 items-center justify-center px-8 lg:px-12 shadow-lg">
        <div className="flex items-center justify-between w-full max-w-[1400px]">
          {/* Logo Section */}
          <Link href="/" className="flex items-center gap-2 group shrink-0 w-[120px]">
            <Logo size="sm" className="opacity-100" />
          </Link>

          {/* Perfectly Centered Nav Items spanning the length */}
          <div className="flex items-center justify-center flex-1 gap-2 lg:gap-6 px-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "text-[10px] lg:text-xs font-black transition-all duration-300 flex items-center gap-2 px-5 py-2.5 rounded-full relative uppercase tracking-[0.15em] border border-transparent whitespace-nowrap",
                    isActive 
                      ? "bg-white/10 text-white shadow-xl shadow-primary/10 border-white/10 scale-105" 
                      : "text-white/40 hover:text-white hover:bg-white/5 hover:border-white/5"
                  )}
                >
                  <Icon className={cn("w-[18px] h-[18px]", isActive && "fill-current")} />
                  <span className="hidden lg:inline">{item.label}</span>
                  {item.showBadge && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5">
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-accent text-[9px] text-white font-black items-center justify-center border-2 border-background shadow-glow">
                        {pendingCount}
                      </span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Action Section */}
          <div className="flex items-center justify-end shrink-0 w-[120px]">
            {user && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout} 
                className="rounded-full text-white/30 hover:text-white hover:bg-destructive/10 hover:text-destructive gap-2 font-black uppercase tracking-widest text-[9px]"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden xl:inline">Exit</span>
              </Button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
