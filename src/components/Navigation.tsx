
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, MessageCircle, Heart, ShieldCheck, LogOut, Zap } from 'lucide-react';
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

  // Fetch pending requests for the badge
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
    { label: 'Matches', href: '/matches', icon: Heart, showBadge: true },
    { label: 'Chat', href: '/messages', icon: MessageCircle },
    { label: 'Verify', href: '/verification', icon: ShieldCheck },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 md:top-0 md:bottom-auto md:h-20 flex items-center justify-around px-4 md:px-20 shadow-lg md:shadow-sm">
      {/* Mobile Nav */}
      <div className="flex md:hidden w-full justify-between items-center py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative",
                isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-primary"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "fill-current")} />
              {item.showBadge && pendingCount > 0 && (
                <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-primary text-[10px] text-white font-black items-center justify-center">
                    {pendingCount}
                  </span>
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Desktop Nav */}
      <div className="hidden md:flex w-full justify-between items-center">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-10">
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
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-primary hover:bg-muted/50"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive && "fill-current")} />
                {item.label}
                {item.showBadge && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-primary text-[10px] text-white font-black items-center justify-center border-2 border-white">
                      {pendingCount}
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
          {user && (
            <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full hover:bg-destructive/10 hover:text-destructive ml-4">
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
