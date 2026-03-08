"use client";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = false }: LogoProps) {
  // 1. ปรับขนาด Container ให้เล็กลงจากเดิม (เช่น md จาก 36 ลงมาเหลือ 28)
  const iconSizes = {
    sm: "w-44 h-44",
    md: "w-58 h-58", 
    lg: "w-56 h-56",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      
      <div className={cn("relative flex items-center justify-center mt-6 mb-4", iconSizes[size])}>
        
        {/* --- 🌟 LAYER 1: ฐานแสงโดยรวม (Ambient Glow) --- */}
        <div className="absolute inset-0 bg-pink-500/10 blur-[30px] rounded-full"></div>

        {/* --- 💥 LAYER 2: แสงสว่างจ้าที่ฐาน (Bottom Light Source & Flare) --- */}
        {/* แสงวงกว้างแนวนอน ปรับความสูงลงเล็กน้อยให้รับกับขนาดใหม่ */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[160%] h-10 bg-white/30 blur-[20px] rounded-[100%]"></div>
        {/* แสงสีชมพูขาวตรงกลางฐาน */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-full h-12 bg-pink-200/50 blur-[24px] rounded-full"></div>
        {/* จุดกำเนิดแสงสีขาว ปรับขนาดจาก 16 เหลือ 12 เพื่อไม่ให้จ้ากินตัวโลโก้มากไป */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-12 bg-white/90 blur-[16px] rounded-full z-0"></div>

        {/* --- ✨ LAYER 3: ดวงดาว (Stars) --- */}
        {/* ดาวดวงใหญ่ด้านบน ปรับขนาดจาก 44 เหลือ 36 */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[#FFF3D3] z-20 animate-pulse drop-shadow-[0_0_15px_rgba(255,255,255,1)]">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
          </svg>
        </div>
        {/* ดาวดวงเล็กประดับ (ซ้าย-ขวา) ขยับตำแหน่งให้กระชับขึ้น */}
        <div className="absolute top-2 -left-3 text-white/60 animate-pulse delay-75 w-4 h-4">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13 9L20 10L13 11L12 18L11 11L4 10L11 9L12 2Z"/></svg>
        </div>
        <div className="absolute bottom-6 -right-4 text-white/40 animate-pulse delay-150 w-3 h-3">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13 9L20 10L13 11L12 18L11 11L4 10L11 9L12 2Z"/></svg>
        </div>

        {/* --- 🦋 LAYER 4: ตัวโลโก้หลัก --- */}
        <Image 
          src="/superlogo.png" 
          alt="Truevibe Logo" 
          fill 
          className="object-contain relative z-10 drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]"
          priority 
        />
      </div>

      {showText && (
        // 2. ปรับตัวหนังสือลงจาก text-4xl เหลือ 3xl เพื่อให้รับกับไซส์โลโก้ใหม่
        <span className="font-black tracking-tight text-white text-3xl z-10">
          Truevibe
        </span>
      )}
    </div>
  );
}