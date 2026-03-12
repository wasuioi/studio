'use client';

import { useState, useEffect } from 'react';

export function BackgroundEffects() {
  const [stars, setStars] = useState<{ top: string; left: string; size: string; delay: string; opacity: number }[]>([]);

  useEffect(() => {
    // Generate star properties only on the client to avoid hydration mismatch
    const generatedStars = [...Array(50)].map(() => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 2 + 1}px`,
      delay: `${Math.random() * 5}s`,
      opacity: Math.random() * 0.4,
    }));
    setStars(generatedStars);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden select-none">
      {/* Center Soft Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vh] bg-[radial-gradient(circle_at_center,rgba(255,120,180,0.12),transparent_65%)]" />
      
      {/* Warm Bottom Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[100vw] h-[60vh] bg-[radial-gradient(circle_at_bottom,rgba(255,122,107,0.18),transparent_60%)]" />
      
      {/* Dreamy Bokeh / Light Flares */}
      <div className="absolute top-[15%] right-[5%] w-[40vw] h-[40vw] bg-primary/10 rounded-full blur-[140px] opacity-40 animate-pulse transition-opacity duration-[3s]" />
      <div className="absolute bottom-[25%] left-[5%] w-[50vw] h-[50vw] bg-accent/10 rounded-full blur-[160px] opacity-30 animate-pulse transition-opacity duration-[4s]" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[40%] left-[20%] w-[30vw] h-[30vw] bg-secondary/10 rounded-full blur-[120px] opacity-20 animate-pulse transition-opacity duration-[5s]" style={{ animationDelay: '1s' }} />

      {/* Cosmic Stars */}
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute bg-white rounded-full animate-pulse"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            opacity: star.opacity,
          }}
        />
      ))}
    </div>
  );
}
