'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { startManualCheckIn } from '@/app/post-date/actions';

interface PostDateButtonProps {
  chatRequestId: string;
}

export function PostDateButton({ chatRequestId }: PostDateButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    start(async () => {
      try {
        const { feedbackId } = await startManualCheckIn(chatRequestId);
        router.push(`/bot?postDate=${feedbackId}`);
      } catch (e) {
        const msg = (e as Error).message ?? 'Could not open check-in';
        setError(msg);
        toast({ variant: 'destructive', title: 'Could not open check-in', description: msg });
      }
    });
  };

  return (
    <Button size="sm" variant="default" onClick={onClick} disabled={pending}>
      {pending ? 'Opening…' : 'I went on this date'}
    </Button>
  );
}
