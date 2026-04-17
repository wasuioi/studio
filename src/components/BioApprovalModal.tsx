// src/components/BioApprovalModal.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getCached, setCached } from '@/lib/dev-tools/response-cache';

interface BioApprovalModalProps {
  open: boolean;
  initialBio: string;
  onSave: (bio: string) => Promise<void>;
  onSkip: () => void;
}

export function BioApprovalModal({ open, initialBio, onSave, onSkip }: BioApprovalModalProps) {
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    // Remembers the first-drafted bio across page reloads so devs iterating
    // on the flow don't re-burn Gemini tokens just to see the modal. Safe in
    // production because nothing seeds the cache except this modal itself.
    const cached = getCached<string>('bio');
    if (cached) {
      setBio(cached);
      return;
    }
    if (initialBio) setCached('bio', initialBio);
    setBio(initialBio);
  }, [open, initialBio]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(bio);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your bio, drafted with Vera</DialogTitle>
          <DialogDescription>
            Here&apos;s what I put together from our chat. Edit anything that doesn&apos;t feel like you.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          className="mt-2"
        />

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onSkip} disabled={saving}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={saving || bio.trim().length === 0}>
            {saving ? 'Saving…' : 'Looks good'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
