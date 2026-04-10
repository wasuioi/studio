import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SupabaseProvider } from '@/supabase/provider';
import { Toaster } from '@/components/ui/toaster';
import { RequestNotificationListener } from '@/components/RequestNotificationListener';
import { DateReminderListener } from '@/components/DateReminderListener';
import { BackgroundEffects } from '@/components/BackgroundEffects';

export const metadata: Metadata = {
  title: 'TrueVibe - Real Connections, Real Vibes',
  description: 'AI-powered relationship companion helping you find meaningful connections through authentic vibe analysis.',
  icons: {
    icon: '/superlogo2.png',
  },
};

// Prevent iOS rubber-band overscroll showing white background
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen relative pb-20 md:pb-0">
        <SupabaseProvider>
          <BackgroundEffects />
          <RequestNotificationListener />
          <DateReminderListener />
          {children}
          <Toaster />
        </SupabaseProvider>
      </body>
    </html>
  );
}
