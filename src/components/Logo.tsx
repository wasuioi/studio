"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-14 h-16",
    lg: "w-32 h-40",
  };

  const textSizes = {
    sm: "text-xl",
    md: "text-3xl",
    lg: "text-6xl",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className={cn("relative", iconSizes[size])}>
        <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
          {/* Left Petal - Deep Purple Gradient */}
          <path 
            d="M50 110C50 110 40 80 15 50C0 30 10 5 30 10C50 15 50 40 50 60" 
            fill="url(#purple_petal_grad)" 
            className="opacity-95"
          />
          {/* Right Petal - Pink/Coral Gradient (Overlapping) */}
          <path 
            d="M50 110C50 110 60 80 85 50C100 30 90 5 70 10C50 15 50 40 50 60" 
            fill="url(#pink_petal_grad)" 
            className="opacity-95"
          />
          
          {/* Central Sparkle Star */}
          <path 
            d="M50 35C50 35 49 40 45 40C49 40 50 45 50 45C50 45 51 40 55 40C51 40 50 35 50 35Z" 
            fill="#FF6B6B" 
            className="animate-pulse"
          />
          
          <defs>
            <linearGradient id="purple_petal_grad" x1="15" y1="10" x2="50" y2="110" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5B00FF" />
              <stop offset="1" stopColor="#9D00FF" />
            </linearGradient>
            <linearGradient id="pink_petal_grad" x1="85" y1="10" x2="50" y2="110" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF2E8B" />
              <stop offset="1" stopColor="#FF8A5C" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && (
        <span className={cn("font-black tracking-tight truevibe-text-gradient", textSizes[size])}>
          Truevibe
        </span>
      )}
    </div>
  );
}
