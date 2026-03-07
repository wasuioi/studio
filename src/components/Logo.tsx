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
    lg: "w-20 h-20",
  };

  const textSizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-5xl",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <div className={cn("relative", iconSizes[size])}>
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-sm">
          {/* Left Petal - Purple */}
          <path 
            d="M50 90C50 90 42 65 25 45C15 33 15 20 25 15C35 10 45 25 50 40C50 40 50 40 50 40" 
            fill="url(#purple_petal)" 
          />
          {/* Right Petal - Pink */}
          <path 
            d="M50 90C50 90 58 65 75 45C85 33 85 20 75 15C65 10 55 25 50 40C50 40 50 40 50 40" 
            fill="url(#pink_petal)" 
          />
          {/* Top Star */}
          <path 
            d="M50 18L51.5 22.5L56 24L51.5 25.5L50 30L48.5 25.5L44 24L48.5 22.5L50 18Z" 
            fill="#FF5E7E" 
          />
          <defs>
            <linearGradient id="purple_petal" x1="25" y1="15" x2="50" y2="90" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6B21A8" />
              <stop offset="1" stopColor="#9333EA" />
            </linearGradient>
            <linearGradient id="pink_petal" x1="75" y1="15" x2="50" y2="90" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F43F5E" />
              <stop offset="1" stopColor="#FB7185" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && (
        <span className={cn("font-black tracking-tight", textSizes[size])}>
          <span className="text-[#31006E]">True</span>
          <span className="text-[#F43F5E]">vibe</span>
        </span>
      )}
    </div>
  );
}
