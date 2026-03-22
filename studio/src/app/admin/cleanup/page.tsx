"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminCleanupPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/bot'); }, [router]);
  return null;
}
