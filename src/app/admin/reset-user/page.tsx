"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetUserPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/bot'); }, [router]);
  return null;
}
