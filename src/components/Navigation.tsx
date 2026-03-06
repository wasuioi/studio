"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, MessageCircle, Heart, BrainCircuit, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'AI Bot', href: '/bot', icon: BrainCircuit },
    { label: 'Matches', href: '/matches', icon: Heart },
    { label: 'Messages', href: '/messages', icon: MessageCircle },
    { label: 'Verify', href: '/verification', icon: ShieldCheck },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 md:top-0 md:bottom-auto md:h-16 flex items-center justify-around px-4 md:px-20">
      <div className="flex md:hidden w-full justify-between items-center py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="hidden md:flex w-full justify-between items-center">
        <Link href="/" className="text-xl font-bold text-primary flex items-center gap-2">
          <BrainCircuit className="w-8 h-8" />
          <span>HarmonyAI</span>
        </Link>
        <div className="flex gap-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "text-sm font-semibold transition-colors border-b-2 py-1",
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}