"use client";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ className, size = "md", showText = false }: LogoProps) {
  // 💡 ปรับสัดส่วนให้เป็นผืนผ้า (กว้างกว่าสูง) เพื่อให้แสงและดาวขยับเข้ามาแนบชิดกับตัว V พอดี
  const iconSizes = {
    sm: "w-[140px] h-[110px]",
    md: "w-[280px] h-[200px]", // ขยายความกว้างขึ้น แต่ลดความสูงลง แสงจะได้ไม่ลอย
    lg: "w-[360px] h-[260px]",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      
      <div className={cn("relative flex items-center justify-center mt-6 mb-4", iconSizes[size])}>
        
        {/* --- 🌟 LAYER 1: รัศมีแสงวงกว้างด้านหลังสุด (Cosmic Aura) --- */}
        {/* ปรับให้เป็นวงกลมฟุ้งๆ ดันอยู่เบื้องหลังโลโก้แบบในภาพต้นแบบ */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-pink-500/20 blur-[50px] rounded-full z-0 pointer-events-none"></div>

        {/* --- 💥 LAYER 2: แสงสว่างจ้าที่ฐาน (Bottom Flare) --- */}
        {/* เปลี่ยนจาก -bottom-3 เป็น bottom-0 เพื่อให้แสงดูดเข้ามาแนบขอบล่างโลโก้ */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[130%] h-8 bg-white/40 blur-[16px] rounded-[100%] z-0 pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-12 bg-pink-300/60 blur-[20px] rounded-full z-0 pointer-events-none"></div>
        <div className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-14 h-14 bg-white/90 blur-[16px] rounded-full z-0 pointer-events-none"></div>

        {/* --- ✨ LAYER 3: ดวงดาว (Stars) --- */}
        {/* ดาวดวงใหญ่ด้านบน เลื่อนลงมาให้แนบชิดร่องตัว V และขยายขนาดให้เด่นขึ้น */}
        <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 text-[#FFF3D3] z-20 animate-pulse drop-shadow-[0_0_20px_rgba(255,255,255,1)] pointer-events-none">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0L13.5 8.5L22 10L13.5 11.5L12 20L10.5 11.5L2 10L10.5 8.5L12 0Z" />
          </svg>
        </div>
        {/* ดาวดวงเล็กประดับ (ซ้าย-ขวา) ขยับเข้ามาแนบตัวโลโก้ */}
        <div className="absolute top-[10%] left-0 text-white/70 animate-pulse delay-75 w-6 h-6 pointer-events-none">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13 9L20 10L13 11L12 18L11 11L4 10L11 9L12 2Z"/></svg>
        </div>
        <div className="absolute bottom-[20%] right-[-10px] text-white/50 animate-pulse delay-150 w-4 h-4 pointer-events-none">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13 9L20 10L13 11L12 18L11 11L4 10L11 9L12 2Z"/></svg>
        </div>

        {/* --- 🦋 LAYER 4: ตัวโลโก้หลัก --- */}
        <Image 
          src="/superlogo.png" 
          alt="Truevibe Logo" 
          fill 
          className="object-contain relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
          priority 
        />
      </div>

      {showText && (
        <span className="font-black tracking-tight text-white text-4xl z-10 mt-2">
          Truevibe
        </span>
      )}
    </div>
  );
}