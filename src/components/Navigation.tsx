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
    { label: 'Requests', href: '/requests', icon: Inbox, showBadge: true },
    { label: 'Chat', href: '/messages', icon: MessageCircle },
    { label: 'Verify', href: '/verification', icon: ShieldCheck },
  ];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur-2xl border-t border-white/10 z-[100] safe-area-bottom pb-2">
        <div className="flex w-full justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all duration-300 relative min-w-[50px]",
                  isActive ? "text-primary" : "text-white/60 hover:text-white"
                )}
              >
                <div className={cn("p-1.5 rounded-xl transition-colors", isActive && "bg-primary/20 shadow-[0_0_15px_rgba(106,92,255,0.3)]")}>
                  <Icon className={cn("w-5 h-5", isActive && "fill-current")} />
                </div>
                {item.showBadge && pendingCount > 0 && (
                  <span className="absolute top-0 right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-accent text-[9px] text-white font-black items-center justify-center border border-black">
                      {pendingCount}
                    </span>
                  </span>
                )}
                <span className="text-[8px] font-bold uppercase tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className="hidden md:flex fixed top-0 left-0 right-0 h-20 bg-black/20 backdrop-blur-xl border-b border-white/10 z-[100] items-center justify-between px-8 lg:px-20">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo size="sm" className="opacity-100" />
        </Link>
        <div className="flex items-center gap-2 lg:gap-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "text-sm font-bold transition-all duration-300 flex items-center gap-2 px-4 py-2 rounded-xl relative",
                  isActive 
                    ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                    : "text-white/60 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive && "fill-current")} />
                <span className="hidden lg:inline">{item.label}</span>
                {item.showBadge && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-accent text-[10px] text-white font-black items-center justify-center border-2 border-background">
                      {pendingCount}
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
          {user && (
            <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full text-white/60 hover:text-white hover:bg-white/10 ml-2">
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </nav>
    </>
  );
}
