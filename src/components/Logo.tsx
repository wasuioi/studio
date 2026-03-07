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
    md: "w-12 h-12",
    lg: "w-24 h-24",
  };

  const textSizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-5xl",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <div className={cn("relative", iconSizes[size])}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
          {/* Left Petal - Heart/V Shape Component */}
          <path 
            d="M50 85C50 85 45 60 20 40C5 25 10 10 25 10C40 10 50 25 50 45" 
            fill="url(#purple_petal)" 
          />
          {/* Right Petal - Heart/V Shape Component */}
          <path 
            d="M50 85C50 85 55 60 80 40C95 25 90 10 75 10C60 10 50 25 50 45" 
            fill="url(#pink_petal)" 
          />
          {/* Central Glow for V-Shape interaction */}
          <circle cx="50" cy="45" r="8" fill="white" className="opacity-20 blur-sm" />
          
          <defs>
            <linearGradient id="purple_petal" x1="25" y1="10" x2="50" y2="85" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6C3BFF" />
              <stop offset="1" stopColor="#4B1FAF" />
            </linearGradient>
            <linearGradient id="pink_petal" x1="75" y1="10" x2="50" y2="85" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FF6B6B" />
              <stop offset="1" stopColor="#FF8A5C" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && (
        <span className={cn("font-black tracking-tight", textSizes[size])}>
          <span className="text-[#6C3BFF]">True</span>
          <span className="text-[#FF6B6B]">vibe</span>
        </span>
      )}
    </div>
  );
}
